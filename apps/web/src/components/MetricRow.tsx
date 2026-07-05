/**
 * 指标行展示组件。
 * 将标签和值的双列对齐集中封装，保证财务画布里的数字排布一致，
 * 后续视觉修复可以在单点调整密度和 tabular 数字样式。
 * 依赖：React children；被用于：FinanceCanvas。
 */
import type { ReactNode } from "react";

interface MetricRowProps {
  label: string;
  value: ReactNode;
}

export function MetricRow({ label, value }: MetricRowProps) {
  return (
    <div className="metric-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
