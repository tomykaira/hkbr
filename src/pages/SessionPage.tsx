import { useEffect, useState, type FormEvent } from "react";
import type { MeResponse } from "../../shared/api";
import { api, errorMessage } from "../api";
import { navigate } from "../router";

export function SessionPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadMe = () => api.me().then(setMe, (e) => setError(errorMessage(e)));
  useEffect(() => {
    loadMe();
  }, []);

  const issue = async () => {
    if (me?.hasTransferToken && !confirm("トークンを再発行すると、以前のトークンは使えなくなります。よろしいですか？")) return;
    setError(null);
    try {
      setToken((await api.issueTransferToken()).token);
      setCopied(false);
      await loadMe();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const revoke = async () => {
    if (!confirm("トークンを無効にしますか？")) return;
    try {
      await api.revokeTransferToken();
      setToken(null);
      await loadMe();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const redeem = async (e: FormEvent) => {
    e.preventDefault();
    if (me?.user && !confirm("このブラウザの現在のセッションは、入力したトークンのセッションに切り替わります。よろしいですか？"))
      return;
    setBusy(true);
    setError(null);
    try {
      await api.transfer(input);
      navigate("/");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="card">
        <h1>セッション移行</h1>
        <p className="muted">
          このサービスはブラウザごとのセッションで利用者を識別しています。別のブラウザや端末で同じ企画・参加情報を使うには、
          ここで移行用トークンを発行し、移行先のブラウザで入力してください。
        </p>
      </section>

      <section className="card">
        <h2>移行用トークンを発行する</h2>
        <p className="muted small">
          トークンを知っている人は誰でもあなたとして操作できます。他人に見せないでください。
          トークンは発行時に一度だけ表示されます。
        </p>
        {token ? (
          <div className="stack">
            <div className="row">
              <input readOnly value={token} onFocus={(e) => e.target.select()} className="mono" aria-label="移行用トークン" />
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(token);
                  setCopied(true);
                }}
              >
                {copied ? "コピーしました" : "コピー"}
              </button>
            </div>
          </div>
        ) : (
          <div className="row">
            <button className="primary" onClick={issue}>
              {me?.hasTransferToken ? "トークンを再発行" : "トークンを発行"}
            </button>
            {me?.hasTransferToken && (
              <button className="ghost danger" onClick={revoke}>
                トークンを無効にする
              </button>
            )}
          </div>
        )}
        {me?.hasTransferToken && !token && <p className="muted small">発行済みのトークンがあります。</p>}
      </section>

      <section className="card">
        <h2>トークンを入力して移行する</h2>
        <form onSubmit={redeem} className="stack">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="移行用トークン"
            className="mono"
            aria-label="移行用トークン"
            required
          />
          <button type="submit" disabled={busy}>
            このブラウザに移行
          </button>
        </form>
      </section>

      {error && <p className="error">{error}</p>}
    </>
  );
}
