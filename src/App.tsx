import { Link, usePathname } from "./router";
import { HomePage } from "./pages/HomePage";
import { NewProjectPage } from "./pages/NewProjectPage";
import { ProjectPage } from "./pages/ProjectPage";
import { SessionPage } from "./pages/SessionPage";

export function App() {
  const path = usePathname();
  const projectMatch = path.match(/^\/p\/([^/]+)\/?$/);

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
        <Link href="/session" className="header-link">
          セッション移行
        </Link>
      </header>
      <main className="container">{page}</main>
    </>
  );
}
