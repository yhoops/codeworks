/**
 * 前端应用路由装配入口。
 * App 只负责 session gate、路由分支和页面级组件组合，数据加载与业务动作由 hooks 承担，
 * 这样后续 pages/components 拆分可以在稳定路由壳上继续推进。
 * 依赖：hooks 与纯视图组件；被用于：main.tsx。
 */
import { APP_NAME } from "@codeworks/shared";

import { Board } from "./components/Board.js";
import { FinanceCanvas } from "./components/FinanceCanvas.js";
import { ShellRail } from "./components/ShellRail.js";
import { useDashboard } from "./hooks/useDashboard.js";
import { useSession } from "./hooks/useSession.js";
import { useWorkspace } from "./hooks/useWorkspace.js";
import "./styles.css";

export function App() {
  const {
    api,
    clearSession,
    email,
    handleLogin,
    navigate,
    password,
    route,
    session,
    setEmail,
    setPassword,
    setStatus,
    setTenantSlug,
    status,
    tenantSlug,
    verifySession
  } = useSession();
  const { dashboard, loadDashboard } = useDashboard({
    api,
    route,
    session,
    setStatus
  });
  const {
    actualHours,
    correctTime,
    draggingTaskId,
    latestTimeEntry,
    moveTask,
    plannedHours,
    primaryEmployee,
    primaryProject,
    primaryTask,
    scheduleAllocation,
    setActualHours,
    setDraggingTaskId,
    setPlannedHours,
    utilization,
    workspace
  } = useWorkspace({ api, route, session, setStatus });

  if (!session || route === "/login") {
    return (
      <main className="login-composition">
        <section className="login-hero" aria-label="Codeworks 登录">
          <p className="eyebrow">PSA + 轻 ERP</p>
          <h1>{APP_NAME}</h1>
          <p className="subtitle">
            将项目、工时、排期与盈亏收束进同一个经营节奏。
          </p>
        </section>

        <section className="login-panel" aria-labelledby="login-title">
          <p className="panel-kicker">Secure workspace</p>
          <h2 id="login-title">登录 Codeworks</h2>
          <form className="login-form" onSubmit={handleLogin}>
            <label htmlFor="tenant-slug">租户</label>
            <input
              id="tenant-slug"
              autoComplete="organization"
              onChange={(event) => setTenantSlug(event.target.value)}
              value={tenantSlug}
            />

            <label htmlFor="email">邮箱</label>
            <input
              id="email"
              autoComplete="email"
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />

            <label htmlFor="password">密码</label>
            <input
              id="password"
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />

            <button className="primary-action" type="submit">
              进入工作台
            </button>
          </form>
          <p className="status-line" role="status">
            {status}
          </p>
        </section>
      </main>
    );
  }

  if (route === "/projects") {
    return (
      <main className="workspace-shell">
        <ShellRail />
        <section className="core-page" aria-labelledby="core-title">
          <p className="eyebrow">Project operating surface</p>
          <h1 id="core-title">项目作战台</h1>
          <p className="subtitle">
            看板、实际工时和排期在同一页闭环，所有操作通过 Core API 同步。
          </p>

          {!workspace ? (
            <p className="status-line" role="status">
              {status}
            </p>
          ) : (
            <>
              <section className="project-strip" aria-label="项目列表">
                <strong>{primaryProject?.name ?? "暂无项目"}</strong>
                <span>{workspace.tasks.length} tasks</span>
                <span>{primaryEmployee?.name ?? "未分配负责人"}</span>
              </section>

              <Board
                draggingTaskId={draggingTaskId}
                moveTask={moveTask}
                setDraggingTaskId={setDraggingTaskId}
                workspace={workspace}
              />

              <section className="operations-panel" aria-label="工时与排期">
                <div>
                  <h2>工时校正</h2>
                  <p>
                    {latestTimeEntry
                      ? `实际工时 ${latestTimeEntry.hours}h`
                      : "等待任务完成生成实际工时"}
                  </p>
                  <label htmlFor="actual-hours">实际工时</label>
                  <input
                    id="actual-hours"
                    onChange={(event) => setActualHours(event.target.value)}
                    type="number"
                    value={actualHours}
                  />
                  <button className="primary-action" onClick={correctTime} type="button">
                    校正工时
                  </button>
                </div>

                <div>
                  <h2>资源排期</h2>
                  <p>
                    {utilization
                      ? `${utilization.plannedHours}h / ${utilization.availableHours}h`
                      : "本周容量等待排期"}
                  </p>
                  <label htmlFor="planned-hours">计划排期</label>
                  <input
                    id="planned-hours"
                    onChange={(event) => setPlannedHours(event.target.value)}
                    type="number"
                    value={plannedHours}
                  />
                  <button
                    className="primary-action"
                    onClick={scheduleAllocation}
                    type="button"
                  >
                    保存排期
                  </button>
                </div>
              </section>

              <p className="status-line" role="status">
                {status}
              </p>
            </>
          )}
        </section>
      </main>
    );
  }

  if (route === "/dashboard") {
    const project = dashboard?.projects[0];

    return (
      <main className="workspace-shell">
        <ShellRail />
        <section className="dashboard-page" aria-labelledby="dashboard-title">
          <p className="eyebrow">Realtime PnL</p>
          <h1 id="dashboard-title">实时盈亏</h1>
          <p className="subtitle">
            用同一张经营画布对齐预算、实际成本、毛利和产能压力。
          </p>

          <button className="primary-action refresh-action" onClick={() => void loadDashboard()} type="button">
            刷新看板
          </button>

          {!project ? (
            <p className="status-line" role="status">
              {status}
            </p>
          ) : (
            <FinanceCanvas project={project} status={status} />
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="workspace-shell">
      <ShellRail />

      <section className="workspace-main" aria-labelledby="workspace-title">
        <p className="eyebrow">Authenticated shell</p>
        <h1 id="workspace-title">经营中枢</h1>
        <p className="subtitle">
          {session.user.name} 已进入 {session.tenant?.slug ?? "默认租户"}，后续业务页面复用此认证态与 API client。
        </p>

        <div className="workspace-actions">
          <button className="primary-action" onClick={verifySession} type="button">
            校验会话
          </button>
          <button
            className="ghost-action"
            onClick={() => {
              clearSession();
              navigate("/login");
            }}
            type="button"
          >
            退出
          </button>
        </div>

        <p className="status-line" role="status">
          {status}
        </p>
      </section>
    </main>
  );
}
