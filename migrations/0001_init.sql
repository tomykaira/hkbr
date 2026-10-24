-- 匿名ユーザ。transfer_token_hash はセッション移行用トークンの SHA-256
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  transfer_token_hash TEXT UNIQUE
);

-- ブラウザごとのセッション。token_hash は Cookie 値の SHA-256
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

-- 時刻はすべて UTC の epoch ミリ秒
-- assigned_at: お題割当を実行した時刻（参加者不足で割当なしの場合も設定する）
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  topic_deadline INTEGER NOT NULL,
  work_deadline INTEGER,
  assigned_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX projects_owner ON projects(owner_id);

-- 参加（1人1お題）。assigned_user_id は割り当てられたお題の投稿者
CREATE TABLE entries (
  project_id TEXT NOT NULL REFERENCES projects(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  nickname TEXT NOT NULL,
  topic TEXT NOT NULL,
  assigned_user_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX entries_user ON entries(user_id);
