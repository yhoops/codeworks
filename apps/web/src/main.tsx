/**
 * main.tsx Web 前端模块。
 * 保留页面、状态或入口的单一职责，让路由壳、数据 hooks 与组件可以独立演进。
 * 依赖：React/Vite 应用层；被用于：Web UI 与前端测试。
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App.js";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Missing #root container");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
