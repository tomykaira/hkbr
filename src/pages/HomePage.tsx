import { useEffect, useState, type FormEvent } from "react";
import type { ProjectSummary } from "../../shared/api";
import { api, errorMessage } from "../api";
import { formatDateTime } from "../datetime";
import { Link, navigate } from "../router";

/** 企画 URL または企画 ID から ID を取り出す */
function parseProjectRef(value: string): string | null {
  const s = value.trim();
  if (!s) return null;
  const m = s.match(/\/p\/([^/?#]+)/);
  if (m) return decodeURIComponent(m[1]);
  return /^[A-Za-z0-9]+$/.test(s) ? s : null;
}

export function HomePage() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ref, setRef] = useState("");
  const [refError, setRefError] = useState<string | null>(null);

  useEffect(() => {
    api.myProjects().then(setProjects, (e) => setError(errorMessage(e)));
  }, []);

  const join = (e: FormEvent) => {
    e.preventDefault();
    const id = parseProjectRef(ref);
    if (!id) {
      setRefError("企画の URL または ID を入力してください");
      return;
    }
    navigate(`/p/${encodeURIComponent(id)}`);
  };

  return (
    <>
      <section className="hero">
        <h1>お題を出し合って、誰かのお題で作品を作ろう</h1>
        <p className="muted">
          参加者がお題を1つずつ出し、締め切り後に自分以外の誰かのお題がランダムに割り当てられます。
          ユーザ登録は不要です。
        </p>
      </section>

      <div className="grid-2">
        <section className="card">
          <h2>企画を開始する</h2>
          <p className="muted">タイトルと締め切りを決めて、参加用 URL を共有します。</p>
          <Link href="/new" className="button primary">
            新しい企画を作る
          </Link>
        </section>

        <section className="card">
          <h2>企画に参加する</h2>
          <form onSubmit={join} className="stack">
            <input
              value={ref}
              onChange={(e) => {
                setRef(e.target.value);
                setRefError(null);
              }}
              placeholder="企画の URL または ID"
              aria-label="企画の URL または ID"
            />
            {refError && <p className="error">{refError}</p>}
            <button type="submit">企画を開く</button>
          </form>
        </section>
      </div>

      <section className="card">
        <h2>あなたの企画</h2>
        {error && <p className="error">{error}</p>}
        {projects === null && !error && <p className="muted">読み込み中…</p>}
        {projects?.length === 0 && <p className="muted">まだ開始・参加した企画はありません。</p>}
        {projects && projects.length > 0 && (
          <ul className="project-list">
            {projects.map((p) => (
              <li key={p.id}>
                <Link href={`/p/${p.id}`}>{p.title}</Link>
                <span className="badges">
                  {p.isOwner && <span className="badge">主催</span>}
                  {p.joined && <span className="badge">参加</span>}
                </span>
                <span className="muted small">お題締切 {formatDateTime(p.topicDeadline)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
