/**
 * 实时盈亏画布组件。
 * 财务指标展示与格式化集中在这里，Dashboard hook 只负责数据获取，
 * App 只决定何时渲染加载态或指标画布。
 * 依赖：DashboardProject 数据；被用于：盈亏路由。
 */
import type { DashboardProject } from "../api/types.js";
import { BulletChart } from "./BulletChart.js";
import { MetricRow } from "./MetricRow.js";

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
    ? Math.min(100, Math.round((project.totalCost / project.revenue) * 100))
    : 0;
  const utilizationPercent = project.utilization.availableHours
    ? Math.min(
        100,
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

      <MetricRow label="预算收入" value={money(project.revenue)} />
      <MetricRow label="实际成本" value={money(project.totalCost)} />
      <BulletChart ariaLabel="预算 vs 实际" percent={costPercent} />

      <MetricRow label="毛利" value={money(project.grossProfit)} />
      <MetricRow
        label="产能利用率"
        value={`${project.utilization.plannedHours}h / ${project.utilization.availableHours}h`}
      />
      <BulletChart
        ariaLabel="产能利用率图表"
        className="utilization"
        percent={utilizationPercent}
      />

      <p className="status-line" role="status">
        {status}
      </p>
    </section>
  );
}
