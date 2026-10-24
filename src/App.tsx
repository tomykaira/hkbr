import { useEffect, useState } from "react";
import { api, SESSION_CHANGE_EVENT } from "./api";
import { Link, usePathname } from "./router";
import { HomePage } from "./pages/HomePage";
import { NewProjectPage } from "./pages/NewProjectPage";
import { ProjectPage } from "./pages/ProjectPage";
import { SessionPage } from "./pages/SessionPage";

export function App() {
  const path = usePathname();
  const projectMatch = path.match(/^\/p\/([^/]+)\/?$/);
  const hasSession = useHasSession(path);

  let page;
  if (path === "/") page = <HomePage />;
  else if (path === "/new") page = <NewProjectPage />;
  else if (path === "/session") page = <SessionPage />;
  else if (projectMatch) page = <ProjectPage key={projectMatch[1]} id={decodeURIComponent(projectMatch[1])} />;
  else page = <p className="muted">ページが見つかりません。</p>;

  return (
    <>
      <header className="site-header">
        <Link href="/" className="brand">
          🎲 お題交換
        </Link>
        {hasSession !== null && (
          <Link href="/session" className="header-link">
            {hasSession ? "引き継ぎトークンを取得する" : "引き継ぎトークンを入力する"}
          </Link>
        )}
      </header>
      <main className="container">{page}</main>
    </>
  );
}

/** セッションの有無。ページ遷移時と更新系リクエストの後に取り直す。取得前は null */
function useHasSession(path: string): boolean | null {
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    let current = true;
    const load = () =>
      api.me().then(
        (me) => current && setHasSession(me.user !== null),
        () => {},
      );
    load();
    window.addEventListener(SESSION_CHANGE_EVENT, load);
    return () => {
      current = false;
      window.removeEventListener(SESSION_CHANGE_EVENT, load);
    };
  }, [path]);

  return hasSession;
}
