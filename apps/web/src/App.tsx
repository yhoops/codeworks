/**
 * 前端应用路由装配入口。
 * App 只负责 session gate、路由分支和页面级组件组合，数据加载与业务动作由 hooks 承担，
 * 这样后续 pages/components 拆分可以在稳定路由壳上继续推进。
 * 依赖：hooks 与纯视图组件；被用于：main.tsx。
 */
import { AppShell } from "./components/AppShell.js";
import { useDashboard } from "./hooks/useDashboard.js";
import { useSession } from "./hooks/useSession.js";
import { useWorkspace } from "./hooks/useWorkspace.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { ProjectsPage } from "./pages/ProjectsPage.js";
import { WorkspacePage } from "./pages/WorkspacePage.js";
import "./styles.css";

export function App() {
  const sessionState = useSession();
  const dashboardState = useDashboard({
    api: sessionState.api,
    route: sessionState.route,
    session: sessionState.session,
    setStatus: sessionState.setStatus
  });
  const workspaceState = useWorkspace({
    api: sessionState.api,
    route: sessionState.route,
    session: sessionState.session,
    setStatus: sessionState.setStatus
  });

  if (!sessionState.session || sessionState.route === "/login") {
    return <LoginPage {...sessionState} />;
  }

  if (sessionState.route === "/projects") {
    return (
      <AppShell>
        <ProjectsPage {...workspaceState} status={sessionState.status} />
      </AppShell>
    );
  }

  if (sessionState.route === "/dashboard") {
    return (
      <AppShell>
        <DashboardPage {...dashboardState} status={sessionState.status} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <WorkspacePage
        clearSession={sessionState.clearSession}
        navigate={sessionState.navigate}
        session={sessionState.session}
        status={sessionState.status}
        verifySession={sessionState.verifySession}
      />
    </AppShell>
  );
}
