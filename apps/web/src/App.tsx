import { APP_NAME } from "@codeworks/shared";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import {
  clearStoredSession,
  createApiClient,
  persistSession,
  readStoredSession
} from "./api-client.js";
import type {
  AuthSession,
  BoardColumn,
  CoreTimeEntry,
  CoreWorkspace,
  DashboardData
} from "./api-client.js";
import "./styles.css";

const boardColumns: Array<{ id: BoardColumn; label: string }> = [
  { id: "TODO", label: "Todo" },
  { id: "IN_PROGRESS", label: "In Progress" },
  { id: "REVIEW", label: "Review" },
  { id: "DONE", label: "Done" }
];

export function App() {
  const [route, setRoute] = useState(() => window.location.pathname);
  const [session, setSessionState] = useState<AuthSession | null>(() =>
    readStoredSession()
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("准备连接 Codeworks API");
  const [workspace, setWorkspace] = useState<CoreWorkspace | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [actualHours, setActualHours] = useState("8");
  const [plannedHours, setPlannedHours] = useState("40");
  const [utilization, setUtilization] = useState<{
    plannedHours: number;
    availableHours: number;
    isOverloaded: boolean;
  } | null>(null);

  const navigate = (path: string) => {
    window.history.pushState(null, "", path);
    setRoute(path);
  };

  const setSession = (nextSession: AuthSession) => {
    persistSession(nextSession);
    setSessionState(nextSession);
  };

  const clearSession = () => {
    clearStoredSession();
    setSessionState(null);
  };

  const api = createApiClient({
    clearSession,
    getSession: () => readStoredSession(),
    onReloginRequired: () => {
      setStatus("会话已过期，请重新登录");
      navigate("/login");
    },
    setSession
  });

  useEffect(() => {
    const syncRoute = () => setRoute(window.location.pathname);
    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, []);

  useEffect(() => {
    if (!session && route !== "/login") {
      navigate("/login");
      return;
    }

    if (session && route === "/login") {
      navigate("/workspace");
    }
  }, [route, session]);

  useEffect(() => {
    if (!session || route !== "/dashboard") {
      return;
    }

    let ignore = false;
    void loadDashboard(ignore);

    return () => {
      ignore = true;
    };
  }, [route, session]);

  useEffect(() => {
    if (!session || route !== "/projects") {
      return;
    }

    let ignore = false;
    setStatus("正在加载核心页面");
    api
      .workspace()
      .then((result) => {
        if (!ignore) {
          setWorkspace(result.data);
          setStatus("核心页面已加载");
        }
      })
      .catch(() => {
        if (!ignore) {
          setStatus("核心页面加载失败");
        }
      });

    return () => {
      ignore = true;
    };
  }, [route, session]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("正在登录");

    try {
      await api.login(email, password);
      setStatus("登录成功");
      navigate("/workspace");
    } catch {
      setStatus("登录失败，请检查账号或网络");
    }
  };

  const verifySession = async () => {
    setStatus("正在校验会话");

    try {
      const result = await api.me();
      setStatus(result.refreshed ? "会话已刷新" : `已连接 ${result.data.name}`);
    } catch {
      setStatus("会话已过期，请重新登录");
    }
  };

  const primaryTask = workspace?.tasks[0];
  const primaryEmployee = primaryTask
    ? workspace?.employees.find((employee) => employee.id === primaryTask.assigneeUserId)
    : undefined;
  const primaryProject = primaryTask
    ? workspace?.projects.find((project) => project.id === primaryTask.projectId)
    : workspace?.projects[0];
  const latestTimeEntry = primaryTask
    ? workspace?.timeEntries.find((entry) => entry.taskId === primaryTask.id)
    : undefined;

  const mergeTimeEntry = (entry: CoreTimeEntry) => {
    setWorkspace((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        timeEntries: [
          entry,
          ...current.timeEntries.filter((candidate) => candidate.id !== entry.id)
        ]
      };
    });
  };

  const moveTask = async (taskId: string, boardColumn: BoardColumn) => {
    setStatus("同步中");
    setWorkspace((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        tasks: current.tasks.map((task) =>
          task.id === taskId
            ? { ...task, boardColumn, status: boardColumn }
            : task
        )
      };
    });

    try {
      const result = await api.moveTask(taskId, boardColumn);
      setWorkspace((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          tasks: current.tasks.map((task) =>
            task.id === taskId ? result.data.task : task
          ),
          timeEntries: result.data.timeEntry
            ? [
                result.data.timeEntry,
                ...current.timeEntries.filter(
                  (entry) => entry.id !== result.data.timeEntry?.id
                )
              ]
            : current.timeEntries
        };
      });
      setStatus("已同步");
    } catch {
      setStatus("同步失败，请刷新后重试");
    }
  };

  const correctTime = async () => {
    if (!primaryTask?.assigneeUserId) {
      setStatus("当前任务缺少负责人，无法校正工时");
      return;
    }

    const hours = Number(actualHours);
    setStatus("正在校正工时");

    try {
      const result = await api.correctTimeEntry({
        employeeId: primaryTask.assigneeUserId,
        hours,
        note: "前端校正",
        taskId: primaryTask.id
      });
      mergeTimeEntry(result.data.timeEntry);
      setStatus("成本信号已更新");
    } catch {
      setStatus("工时校正失败");
    }
  };

  const scheduleAllocation = async () => {
    if (!primaryTask?.assigneeUserId || !primaryProject) {
      setStatus("缺少任务或项目，无法保存排期");
      return;
    }

    setStatus("正在保存排期");

    try {
      const result = await api.scheduleAllocation({
        employeeId: primaryTask.assigneeUserId,
        plannedHours: Number(plannedHours),
        projectId: primaryProject.id,
        taskId: primaryTask.id,
        weekStart: "2026-07-06T00:00:00.000Z"
      });
      setUtilization(result.data.utilization);
      setWorkspace((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          allocations: [
            result.data.allocation,
            ...current.allocations.filter(
              (allocation) => allocation.id !== result.data.allocation.id
            )
          ]
        };
      });
      setStatus(result.data.utilization.isOverloaded ? "产能过载" : "排期已保存");
    } catch {
      setStatus("排期保存失败");
    }
  };

  const loadDashboard = async (ignore = false) => {
    setStatus("正在刷新看板");

    try {
      const result = await api.dashboard();
      if (!ignore) {
        setDashboard(result.data);
        setStatus("看板已刷新");
      }
    } catch {
      if (!ignore) {
        setStatus("看板刷新失败");
      }
    }
  };

  const money = (value: number) =>
    new Intl.NumberFormat("zh-CN", {
      currency: "CNY",
      maximumFractionDigits: 0,
      style: "currency"
    }).format(value);

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

              <section className="board-grid" aria-label="Scrum 看板">
                {boardColumns.map((column) => (
                  <section
                    aria-label={column.label}
                    className="board-column"
                    key={column.id}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (draggingTaskId) {
                        void moveTask(draggingTaskId, column.id);
                        setDraggingTaskId(null);
                      }
                    }}
                    role="region"
                  >
                    <h2>{column.label}</h2>
                    {workspace.tasks
                      .filter((task) => task.boardColumn === column.id)
                      .map((task) => (
                        <article
                          className="task-ticket"
                          draggable
                          key={task.id}
                          onDragStart={() => setDraggingTaskId(task.id)}
                        >
                          <strong>{task.title}</strong>
                          <span>{task.estimateHours}h estimate</span>
                        </article>
                      ))}
                  </section>
                ))}
              </section>

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
    const costPercent = project?.revenue
      ? Math.min(140, Math.round((project.totalCost / project.revenue) * 100))
      : 0;
    const utilizationPercent = project?.utilization.availableHours
      ? Math.min(
          140,
          Math.round(
            (project.utilization.plannedHours / project.utilization.availableHours) *
              100
          )
        )
      : 0;

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
            <section className="finance-canvas" aria-label="盈亏图表">
              <div className="finance-headline">
                <strong>{project.name}</strong>
                {project.overBudget ? <span className="warning-chip">超预算</span> : null}
              </div>

              <div className="metric-row">
                <span>预算收入</span>
                <strong>{money(project.revenue)}</strong>
              </div>
              <div className="metric-row">
                <span>实际成本</span>
                <strong>{money(project.totalCost)}</strong>
              </div>
              <div className="bullet-chart" aria-label="预算 vs 实际">
                <span style={{ width: `${costPercent}%` }} />
              </div>

              <div className="metric-row">
                <span>毛利</span>
                <strong>{money(project.grossProfit)}</strong>
              </div>
              <div className="metric-row">
                <span>产能利用率</span>
                <strong>
                  {project.utilization.plannedHours}h / {project.utilization.availableHours}h
                </strong>
              </div>
              <div className="bullet-chart utilization" aria-label="产能利用率图表">
                <span style={{ width: `${utilizationPercent}%` }} />
              </div>

              <p className="status-line" role="status">
                {status}
              </p>
            </section>
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

function ShellRail() {
  return (
    <aside className="rail" aria-label="主导航">
      <strong>{APP_NAME}</strong>
      <nav>
        <a aria-current="page" href="/workspace">
          经营中枢
        </a>
        <a href="/projects">项目</a>
        <a href="/dashboard">盈亏</a>
        <span>工时</span>
        <span>排期</span>
      </nav>
    </aside>
  );
}
