/**
 * 横向 bullet chart 组件。
 * 该组件只负责稳定的条形图 DOM 结构，百分比计算留在调用方，
 * 便于后续对溢出裁剪和语义颜色做统一修复。
 * 依赖：CSS bullet-chart 类；被用于：FinanceCanvas。
 */
interface BulletChartProps {
  ariaLabel: string;
  className?: string;
  percent: number;
}

export function BulletChart({ ariaLabel, className, percent }: BulletChartProps) {
  const classes = ["bullet-chart", className].filter(Boolean).join(" ");

  return (
    <div className={classes} aria-label={ariaLabel}>
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}
