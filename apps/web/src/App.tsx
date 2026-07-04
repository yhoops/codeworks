import { APP_NAME } from "@codeworks/shared";

import "./styles.css";

export function App() {
  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">PSA + 轻 ERP</p>
        <h1>{APP_NAME}</h1>
        <p className="subtitle">
          多租户项目经营底座，当前已完成 monorepo 脚手架与最小前端壳。
        </p>
      </section>
    </main>
  );
}
