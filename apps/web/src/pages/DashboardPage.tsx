/**
 * 实时盈亏页面。
 * 页面只负责标题、刷新按钮和 FinanceCanvas 组合，PnL 数据获取由 useDashboard 管理。
 * 这样图表组件和数据 hook 可以独立演进。
 * 依赖：useDashboard 返回值与 FinanceCanvas；被用于：App 的 /dashboard 路由。
 */
import { FinanceCanvas } from "../components/FinanceCanvas.js";
import type { useDashboard } from "../hooks/useDashboard.js";

type DashboardState = ReturnType<typeof useDashboard>;

interface DashboardPageProps {
  dashboard: DashboardState["dashboard"];
  loadDashboard: DashboardState["loadDashboard"];
  status: string;
}

export function DashboardPage({
  dashboard,
  loadDashboard,
  status
}: DashboardPageProps) {
  const project = dashboard?.projects[0];

  return (
    <section className="dashboard-page" aria-labelledby="dashboard-title">
      <p className="eyebrow">Realtime PnL</p>
      <h1 id="dashboard-title">实时盈亏</h1>
      <p className="subtitle">
        用同一张经营画布对齐预算、实际成本、毛利和产能压力。
      </p>

      <button
        className="primary-action refresh-action"
        onClick={() => void loadDashboard()}
        type="button"
      >
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
  );
}
