/**
 * 实时盈亏画布组件。
 * 财务指标展示与格式化集中在这里，Dashboard hook 只负责数据获取，
 * App 只决定何时渲染加载态或指标画布。
 * 依赖：DashboardProject 数据；被用于：盈亏路由。
 */
import type { DashboardProject } from "../api/types.js";

interface FinanceCanvasProps {
  project: DashboardProject;
  status: string;
}

const money = (value: number) =>
  new Intl.NumberFormat("zh-CN", {
    currency: "CNY",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);

export function FinanceCanvas({ project, status }: FinanceCanvasProps) {
  const costPercent = project.revenue
    ? Math.min(140, Math.round((project.totalCost / project.revenue) * 100))
    : 0;
  const utilizationPercent = project.utilization.availableHours
    ? Math.min(
        140,
        Math.round(
          (project.utilization.plannedHours / project.utilization.availableHours) * 100
        )
      )
    : 0;

  return (
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
  );
}
