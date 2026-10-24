import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { randomId, randomToken, sha256 } from "./random";

export type AppEnv = { Bindings: Env };

const COOKIE = "hkbr_sid";
// ブラウザが許す Cookie の最長有効期限（400日）
const MAX_AGE = 400 * 24 * 60 * 60;

/** Cookie のセッションからユーザ ID を引く。なければ null（DB には書き込まない） */
export async function currentUserId(c: Context<AppEnv>): Promise<string | null> {
  const token = getCookie(c, COOKIE);
  if (!token) return null;
  const row = await c.env.DB.prepare("SELECT user_id FROM sessions WHERE token_hash = ?")
    .bind(await sha256(token))
    .first<{ user_id: string }>();
  return row?.user_id ?? null;
}

/** 現在のユーザを返す。未登録なら匿名ユーザとセッションを作成する */
export async function ensureUserId(c: Context<AppEnv>): Promise<string> {
  const existing = await currentUserId(c);
  if (existing) return existing;
  const userId = randomId(16);
  await c.env.DB.prepare("INSERT INTO users (id, created_at) VALUES (?, ?)")
    .bind(userId, Date.now())
    .run();
  await startSession(c, userId);
  return userId;
}

/** userId に紐づく新しいセッションを発行して Cookie にセットする */
export async function startSession(c: Context<AppEnv>, userId: string): Promise<void> {
  const token = randomToken();
  await c.env.DB.prepare("INSERT INTO sessions (token_hash, user_id, created_at) VALUES (?, ?, ?)")
    .bind(await sha256(token), userId, Date.now())
    .run();
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}
