/**
 * 登录页视图。
 * 页面只绑定表单字段和提交事件，session 持久化与导航由 useSession 处理，
 * 保持登录 UI 与认证副作用分离。
 * 依赖：APP_NAME 与 useSession 返回字段；被用于：App 登录路由。
 */
import { APP_NAME } from "@codeworks/shared";
import type { FormEvent } from "react";

interface LoginPageProps {
  email: string;
  handleLogin: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  password: string;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  setTenantSlug: (value: string) => void;
  status: string;
  tenantSlug: string;
}

export function LoginPage({
  email,
  handleLogin,
  password,
  setEmail,
  setPassword,
  setTenantSlug,
  status,
  tenantSlug
}: LoginPageProps) {
  return (
    <main className="login-composition">
      <section className="login-hero" aria-label="Codeworks 登录">
        <p className="eyebrow">PSA + 轻 ERP</p>
        <h1>{APP_NAME}</h1>
        <p className="subtitle">将项目、工时、排期与盈亏收束进同一个经营节奏。</p>
      </section>

      <section className="login-panel" aria-labelledby="login-title">
        <p className="panel-kicker">Secure workspace</p>
        <h2 id="login-title">登录 Codeworks</h2>
        <form className="login-form" onSubmit={handleLogin}>
          <label htmlFor="tenant-slug">租户</label>
          <input
            id="tenant-slug"
            autoComplete="organization"
            onChange={(event) => setTenantSlug(event.target.value)}
            value={tenantSlug}
          />

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
