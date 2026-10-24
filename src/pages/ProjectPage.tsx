import { useCallback, useEffect, useState, type FormEvent } from "react";
import { LIMITS, type AssignmentRow, type ProjectView } from "../../shared/api";
import { api, errorMessage } from "../api";
import { ProjectForm } from "../components/ProjectForm";
import { formatDateTime } from "../datetime";

// setTimeout が扱える最大遅延（約24.8日）
const MAX_TIMEOUT = 2 ** 31 - 1;

export function ProjectPage({ id }: { id: string }) {
  const [project, setProject] = useState<ProjectView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const reload = useCallback(async () => {
    try {
      setProject(await api.getProject(id));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [id]);

  useEffect(() => {
    reload();
  }, [reload]);

  // ページを開いたままお題締切を迎えたら再取得して割当を表示する
  useEffect(() => {
    if (!project || project.status !== "open") return;
    const delay = project.topicDeadline - project.now + 1000;
    if (delay > MAX_TIMEOUT) return;
    const timer = setTimeout(reload, Math.max(delay, 0));
    return () => clearTimeout(timer);
  }, [project, reload]);

  if (error && !project) return <p className="error">{error}</p>;
  if (!project) return <p className="muted">読み込み中…</p>;

  const open = project.status === "open";

  return (
    <>
      <section className="card">
        <div className="title-row">
          <h1>{project.title}</h1>
          {project.isOwner && !editing && (
            <button className="ghost" onClick={() => setEditing(true)}>
              編集
            </button>
          )}
        </div>

        {editing ? (
          <ProjectForm
            initial={project}
            workDeadlineOnly={!open}
            submitLabel="保存"
            onSubmit={async (input) => {
              await api.updateProject(project.id, open ? input : { workDeadline: input.workDeadline });
              setEditing(false);
              await reload();
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <>
            {project.description && <p className="description">{project.description}</p>}
            <dl className="deadlines">
              <dt>お題提出締め切り</dt>
              <dd>
                {formatDateTime(project.topicDeadline)}
                {!open && <span className="badge">締切済み</span>}
              </dd>
              <dt>作品提出締め切り</dt>
              <dd>
                {project.workDeadline === null ? (
                  <span className="muted">未設定</span>
                ) : (
                  <>
                    {formatDateTime(project.workDeadline)}
                    {project.workDeadline <= project.now && <span className="badge">締切済み</span>}
                  </>
                )}
              </dd>
            </dl>
          </>
        )}
        <ShareUrl id={project.id} />
      </section>

      {error && <p className="error">{error}</p>}

      {open ? <EntrySection project={project} onChange={reload} /> : <AssignmentSection project={project} />}

      {project.participants && (
        <section className="card">
          <h2>参加者（{project.participants.length}人）</h2>
          <p className="muted small">参加者一覧は主催者にのみ表示されています。</p>
          {project.participants.length === 0 ? (
            <p className="muted">まだ参加者はいません。</p>
          ) : (
            <ul className="chips">
              {project.participants.map((name, i) => (
                <li key={i}>{name}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {project.isOwner && project.status === "assigned" && <AllAssignments id={project.id} />}
    </>
  );
}

function ShareUrl({ id }: { id: string }) {
  const url = `${window.location.origin}/p/${id}`;
  const [copied, setCopied] = useState(false);
  return (
    <div className="share">
      <span className="muted small">参加用 URL</span>
      <div className="row">
        <input readOnly value={url} onFocus={(e) => e.target.select()} aria-label="参加用 URL" />
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? "コピーしました" : "コピー"}
        </button>
      </div>
    </div>
  );
}

function EntrySection({ project, onChange }: { project: ProjectView; onChange: () => Promise<void> }) {
  const joined = project.myEntry !== null;
  const [editing, setEditing] = useState(!joined);
  const [nickname, setNickname] = useState(project.myEntry?.nickname ?? "");
  const [topic, setTopic] = useState(project.myEntry?.topic ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await onChange();
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (await run(() => api.submitEntry(project.id, { nickname, topic }))) setEditing(false);
  };

  const withdraw = async () => {
    if (!confirm("参加を取り消しますか？送信したお題も削除されます。")) return;
    if (await run(() => api.withdraw(project.id))) {
      setNickname("");
      setTopic("");
      setEditing(true);
    }
  };

  return (
    <section className="card">
      <h2>{joined ? "参加済み" : "この企画に参加する"}</h2>
      <p className="muted small">
        お題提出締め切り（{formatDateTime(project.topicDeadline)}
        ）を過ぎると、あなた以外の誰かが出したお題が1つ割り当てられます。締め切りまではお題の修正や参加の取り消しができます。
      </p>

      {joined && !editing ? (
        <>
          <dl className="entry">
            <dt>ニックネーム</dt>
            <dd>{project.myEntry!.nickname}</dd>
            <dt>あなたが出したお題</dt>
            <dd className="topic">{project.myEntry!.topic}</dd>
          </dl>
          <div className="row">
            <button onClick={() => setEditing(true)}>修正する</button>
            <button className="ghost danger" onClick={withdraw} disabled={busy}>
              参加を取り消す
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={submit} className="stack">
          <label>
            ニックネーム（任意）
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={LIMITS.nickname}
              placeholder="名無しさん"
            />
          </label>
          <label>
            お題
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={LIMITS.topic}
              rows={3}
              required
            />
          </label>
          <div className="row">
            <button type="submit" className="primary" disabled={busy}>
              {joined ? "保存" : "お題を送信して参加"}
            </button>
            {joined && (
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setNickname(project.myEntry!.nickname);
                  setTopic(project.myEntry!.topic);
                  setEditing(false);
                }}
              >
                キャンセル
              </button>
            )}
          </div>
        </form>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}

function AssignmentSection({ project }: { project: ProjectView }) {
  if (project.status === "insufficient") {
    return (
      <section className="card">
        <h2>お題の割当</h2>
        <p>参加者が2人未満だったため、お題は割り当てられませんでした。</p>
      </section>
    );
  }
  if (!project.myEntry) {
    return (
      <section className="card">
        <h2>お題の割当</h2>
        <p className="muted">お題の募集は締め切られました。この企画には参加していません。</p>
      </section>
    );
  }
  return (
    <section className="card highlight">
      <h2>あなたに割り当てられたお題</h2>
      <p className="assigned-topic">{project.myAssignment?.topic ?? "（割当がありません）"}</p>
      <p className="muted small">あなたが出したお題: {project.myEntry.topic}</p>
    </section>
  );
}

function AllAssignments({ id }: { id: string }) {
  const [rows, setRows] = useState<AssignmentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="card">
      <h2>全員の割当（主催者のみ）</h2>
      {rows === null ? (
        <>
          <p className="muted small">他の参加者に割り当てられたお題を表示します。ネタバレに注意してください。</p>
          <button
            onClick={() =>
              api.assignments(id).then(setRows, (e) => setError(errorMessage(e)))
            }
          >
            全員の割当を見る
          </button>
        </>
      ) : (
        <>
          <table className="table">
            <thead>
              <tr>
                <th>参加者</th>
                <th>割り当てられたお題</th>
                <th>お題の出題者</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.nickname}</td>
                  <td className="topic">{r.topic}</td>
                  <td>{r.topicAuthor}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="ghost" onClick={() => setRows(null)}>
            隠す
          </button>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
