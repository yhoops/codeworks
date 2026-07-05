/**
 * 应用主导航栏。
 * 导航外壳单独成组件，避免 App 在承担路由装配时同时维护重复的品牌与导航结构。
 * 依赖：共享 APP_NAME；被用于：工作台、项目和盈亏路由。
 */
import { APP_NAME } from "@codeworks/shared";

export function ShellRail() {
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
