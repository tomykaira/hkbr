import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import {
  DEFAULT_NICKNAME,
  LIMITS,
  type AssignmentRow,
  type EntryInput,
  type MeResponse,
  type ProjectInput,
  type ProjectStatus,
  type ProjectSummary,
  type ProjectView,
} from "../shared/api";
import { derangement } from "./assign";
import { randomId, randomToken, sha256 } from "./random";
import { currentUserId, ensureUserId, startSession, type AppEnv } from "./session";

interface ProjectRow {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  topic_deadline: number;
  work_deadline: number | null;
  assigned_at: number | null;
}

const app = new Hono<AppEnv>().basePath("/api");

app.use(csrf());

app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message || "リクエストが拒否されました" }, err.status);
  console.error(err);
  return c.json({ error: "サーバーエラーが発生しました" }, 500);
});

function fail(status: 400 | 403 | 404 | 409, message: string): never {
  throw new HTTPException(status, { message });
}

async function readJson(c: { req: { json: () => Promise<unknown> } }): Promise<Record<string, unknown>> {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") fail(400, "リクエストが不正です");
  return body as Record<string, unknown>;
}

function text(value: unknown, name: string, max: number, required: boolean): string {
  const s = typeof value === "string" ? value.trim() : "";
  if (required && !s) fail(400, `${name}を入力してください`);
  if (s.length > max) fail(400, `${name}は${max}文字以内で入力してください`);
  return s;
}

function timestamp(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(400, `${name}を指定してください`);
  return value;
}

function parseProjectInput(body: Record<string, unknown>, now: number): ProjectInput {
  const topicDeadline = timestamp(body.topicDeadline, "お題提出締め切り");
  if (topicDeadline <= now) fail(400, "お題提出締め切りは未来の日時にしてください");
  return {
    title: text(body.title, "タイトル", LIMITS.title, true),
    description: text(body.description, "説明", LIMITS.description, false),
    topicDeadline,
    workDeadline: parseWorkDeadline(body.workDeadline, topicDeadline),
  };
}

function parseWorkDeadline(value: unknown, topicDeadline: number): number | null {
  if (value === null || value === undefined) return null;
  const workDeadline = timestamp(value, "作品提出締め切り");
  if (workDeadline <= topicDeadline) fail(400, "作品提出締め切りはお題提出締め切りより後にしてください");
  return workDeadline;
}

async function loadProject(db: D1Database, id: string): Promise<ProjectRow> {
  const row = await db.prepare("SELECT * FROM projects WHERE id = ?").bind(id).first<ProjectRow>();
  if (!row) fail(404, "企画が見つかりません");
  return row;
}

/**
 * お題締切を過ぎていて未割当なら割当を行う（アクセス時に遅延実行）。
 * 同時アクセスで二重に割り当てないよう、全更新を「未割当かつ参加者数が読み取り時から不変」
 * を条件に1つの batch（トランザクション）で実行する。条件が崩れていれば何も更新されない。
 */
async function ensureAssigned(db: D1Database, project: ProjectRow, now: number): Promise<ProjectRow> {
  if (project.assigned_at !== null || now < project.topic_deadline) return project;

  const { results } = await db
    .prepare("SELECT user_id FROM entries WHERE project_id = ?")
    .bind(project.id)
    .all<{ user_id: string }>();
  const userIds = results.map((r) => r.user_id);
  const guard =
    "EXISTS (SELECT 1 FROM projects WHERE id = ?1 AND assigned_at IS NULL)" +
    " AND (SELECT COUNT(*) FROM entries WHERE project_id = ?1) = ?2";

  const statements: D1PreparedStatement[] = [];
  if (userIds.length >= 2) {
    const perm = derangement(userIds.length);
    userIds.forEach((userId, i) => {
      statements.push(
        db
          .prepare(
            `UPDATE entries SET assigned_user_id = ?4 WHERE project_id = ?1 AND user_id = ?3 AND ${guard}`,
          )
          .bind(project.id, userIds.length, userId, userIds[perm[i]]),
      );
    });
  }
  statements.push(
    db
      .prepare(`UPDATE projects SET assigned_at = ?3 WHERE id = ?1 AND ${guard}`)
      .bind(project.id, userIds.length, now),
  );
  await db.batch(statements);
  return loadProject(db, project.id);
}

function statusOf(project: ProjectRow, participantCount: number): ProjectStatus {
  if (project.assigned_at === null) return "open";
  return participantCount >= 2 ? "assigned" : "insufficient";
}

// ---- セッション ----

app.get("/me", async (c) => {
  const userId = await currentUserId(c);
  let hasTransferToken = false;
  if (userId) {
    const row = await c.env.DB.prepare("SELECT transfer_token_hash FROM users WHERE id = ?")
      .bind(userId)
      .first<{ transfer_token_hash: string | null }>();
    hasTransferToken = !!row?.transfer_token_hash;
  }
  return c.json<MeResponse>({ user: userId ? { id: userId } : null, hasTransferToken });
});

// 移行用トークンを (再)発行する。再発行すると古いトークンは使えなくなる
app.post("/transfer-token", async (c) => {
  const userId = await ensureUserId(c);
  const token = randomToken();
  await c.env.DB.prepare("UPDATE users SET transfer_token_hash = ? WHERE id = ?")
    .bind(await sha256(token), userId)
    .run();
  return c.json({ token });
});

app.delete("/transfer-token", async (c) => {
  const userId = await currentUserId(c);
  if (userId) {
    await c.env.DB.prepare("UPDATE users SET transfer_token_hash = NULL WHERE id = ?").bind(userId).run();
  }
  return c.json({ ok: true });
});

// 移行用トークンを入力したブラウザに、そのユーザのセッションを発行する
app.post("/transfer", async (c) => {
  const body = await readJson(c);
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) fail(400, "トークンを入力してください");
  const row = await c.env.DB.prepare("SELECT id FROM users WHERE transfer_token_hash = ?")
    .bind(await sha256(token))
    .first<{ id: string }>();
  if (!row) fail(400, "トークンが正しくありません");
  await startSession(c, row.id);
  return c.json({ ok: true });
});

// ---- 企画 ----

app.get("/projects", async (c) => {
  const userId = await currentUserId(c);
  if (!userId) return c.json<ProjectSummary[]>([]);
  const { results } = await c.env.DB.prepare(
    `SELECT p.id, p.title, p.topic_deadline, p.work_deadline, p.owner_id = ?1 AS is_owner,
            e.user_id IS NOT NULL AS joined
       FROM projects p
       LEFT JOIN entries e ON e.project_id = p.id AND e.user_id = ?1
      WHERE p.owner_id = ?1 OR e.user_id IS NOT NULL
      ORDER BY p.created_at DESC`,
  )
    .bind(userId)
    .all<{
      id: string;
      title: string;
      topic_deadline: number;
      work_deadline: number | null;
      is_owner: number;
      joined: number;
    }>();
  return c.json<ProjectSummary[]>(
    results.map((r) => ({
      id: r.id,
      title: r.title,
      topicDeadline: r.topic_deadline,
      workDeadline: r.work_deadline,
      isOwner: !!r.is_owner,
      joined: !!r.joined,
    })),
  );
});

app.post("/projects", async (c) => {
  const now = Date.now();
  const input = parseProjectInput(await readJson(c), now);
  const userId = await ensureUserId(c);
  const id = randomId(10);
  await c.env.DB.prepare(
    `INSERT INTO projects (id, owner_id, title, description, topic_deadline, work_deadline, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, userId, input.title, input.description, input.topicDeadline, input.workDeadline, now, now)
    .run();
  return c.json({ id }, 201);
});

app.get("/projects/:id", async (c) => {
  const now = Date.now();
  const db = c.env.DB;
  const userId = await currentUserId(c);
  const project = await ensureAssigned(db, await loadProject(db, c.req.param("id")), now);

  const { results: entries } = await db
    .prepare(
      `SELECT e.user_id, e.nickname, e.topic, a.topic AS assigned_topic
         FROM entries e
         LEFT JOIN entries a ON a.project_id = e.project_id AND a.user_id = e.assigned_user_id
        WHERE e.project_id = ?
        ORDER BY e.created_at`,
    )
    .bind(project.id)
    .all<{ user_id: string; nickname: string; topic: string; assigned_topic: string | null }>();
  const mine = entries.find((e) => e.user_id === userId);
  const status = statusOf(project, entries.length);
  const isOwner = project.owner_id === userId;

  return c.json<ProjectView>({
    id: project.id,
    title: project.title,
    description: project.description,
    topicDeadline: project.topic_deadline,
    workDeadline: project.work_deadline,
    status,
    isOwner,
    participants: isOwner ? entries.map((e) => e.nickname) : null,
    myEntry: mine ? { nickname: mine.nickname, topic: mine.topic } : null,
    myAssignment: status === "assigned" && mine?.assigned_topic ? { topic: mine.assigned_topic } : null,
    now,
  });
});

app.patch("/projects/:id", async (c) => {
  const now = Date.now();
  const db = c.env.DB;
  const userId = await currentUserId(c);
  const project = await loadProject(db, c.req.param("id"));
  if (project.owner_id !== userId) fail(403, "企画を編集できるのは主催者のみです");
  const body = await readJson(c);

  if (project.assigned_at === null && now < project.topic_deadline) {
    // お題締切前: すべて編集可。締切到来と競合した場合に備え、条件付きで更新する
    const input = parseProjectInput(body, now);
    const res = await db
      .prepare(
        `UPDATE projects SET title = ?, description = ?, topic_deadline = ?, work_deadline = ?, updated_at = ?
          WHERE id = ? AND assigned_at IS NULL AND topic_deadline > ?`,
      )
      .bind(input.title, input.description, input.topicDeadline, input.workDeadline, now, project.id, now)
      .run();
    if (res.meta.changes === 0) fail(409, "お題提出締め切りを過ぎたため、作品提出締め切り以外は編集できません");
  } else {
    // お題締切後: 作品提出締め切りのみ編集可
    const workDeadline = parseWorkDeadline(body.workDeadline, project.topic_deadline);
    await db
      .prepare("UPDATE projects SET work_deadline = ?, updated_at = ? WHERE id = ?")
      .bind(workDeadline, now, project.id)
      .run();
  }
  return c.json({ ok: true });
});

// 参加（お題送信）。既に参加済みならニックネーム・お題を更新する
app.put("/projects/:id/entry", async (c) => {
  const now = Date.now();
  const db = c.env.DB;
  const project = await loadProject(db, c.req.param("id"));
  const body = await readJson(c);
  const entry: EntryInput = {
    nickname: text(body.nickname, "ニックネーム", LIMITS.nickname, false) || DEFAULT_NICKNAME,
    topic: text(body.topic, "お題", LIMITS.topic, true),
  };
  if (project.assigned_at !== null || now >= project.topic_deadline) fail(409, "お題提出締め切りを過ぎています");
  const userId = await ensureUserId(c);
  const res = await db
    .prepare(
      `INSERT INTO entries (project_id, user_id, nickname, topic, created_at, updated_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?5
        WHERE EXISTS (SELECT 1 FROM projects WHERE id = ?1 AND assigned_at IS NULL AND topic_deadline > ?5)
       ON CONFLICT (project_id, user_id) DO UPDATE SET
         nickname = excluded.nickname, topic = excluded.topic, updated_at = excluded.updated_at`,
    )
    .bind(project.id, userId, entry.nickname, entry.topic, now)
    .run();
  if (res.meta.changes === 0) fail(409, "お題提出締め切りを過ぎています");
  return c.json({ ok: true });
});

app.delete("/projects/:id/entry", async (c) => {
  const now = Date.now();
  const userId = await currentUserId(c);
  if (!userId) fail(404, "参加していません");
  const res = await c.env.DB.prepare(
    `DELETE FROM entries WHERE project_id = ?1 AND user_id = ?2
        AND EXISTS (SELECT 1 FROM projects WHERE id = ?1 AND assigned_at IS NULL AND topic_deadline > ?3)`,
  )
    .bind(c.req.param("id"), userId, now)
    .run();
  if (res.meta.changes === 0) fail(409, "参加を取り消せませんでした（締め切り後、または未参加です）");
  return c.json({ ok: true });
});

// 主催者が「全員の割当を見る」を選んだときのみ呼ばれる
app.get("/projects/:id/assignments", async (c) => {
  const db = c.env.DB;
  const userId = await currentUserId(c);
  const project = await loadProject(db, c.req.param("id"));
  if (project.owner_id !== userId) fail(403, "割当一覧を見られるのは主催者のみです");
  if (project.assigned_at === null) fail(409, "まだ割当が行われていません");
  const { results } = await db
    .prepare(
      `SELECT e.nickname, a.topic, a.nickname AS topic_author
         FROM entries e
         JOIN entries a ON a.project_id = e.project_id AND a.user_id = e.assigned_user_id
        WHERE e.project_id = ?
        ORDER BY e.created_at`,
    )
    .bind(project.id)
    .all<{ nickname: string; topic: string; topic_author: string }>();
  return c.json<AssignmentRow[]>(
    results.map((r) => ({ nickname: r.nickname, topic: r.topic, topicAuthor: r.topic_author })),
  );
});

app.all("*", (c) => c.json({ error: "Not Found" }, 404));

export default app;
