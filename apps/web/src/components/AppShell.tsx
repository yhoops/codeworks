/**
 * 认证后应用外壳。
 * 外壳统一承载主导航和工作区布局，页面组件只渲染自己的内容区域，
 * 避免每个路由重复 workspace-shell 与 ShellRail 结构。
 * 依赖：ShellRail；被用于：认证后的业务路由。
 */
import type { ReactNode } from "react";

import { ShellRail } from "./ShellRail.js";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <main className="workspace-shell">
      <ShellRail />
      {children}
    </main>
  );
}
