import { APP_NAME } from "@codeworks/shared";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import {
  clearStoredSession,
  createApiClient,
  persistSession,
  readStoredSession
} from "./api-client.js";
import type { AuthSession } from "./api-client.js";
import "./styles.css";

export function App() {
  const [route, setRoute] = useState(() => window.location.pathname);
  const [session, setSessionState] = useState<AuthSession | null>(() =>
    readStoredSession()
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("准备连接 Codeworks API");

  const navigate = (path: string) => {
    window.history.pushState(null, "", path);
    setRoute(path);
  };

  const setSession = (nextSession: AuthSession) => {
    persistSession(nextSession);
    setSessionState(nextSession);
  };

  const clearSession = () => {
    clearStoredSession();
    setSessionState(null);
  };

  const api = createApiClient({
    clearSession,
    getSession: () => readStoredSession(),
    onReloginRequired: () => {
      setStatus("会话已过期，请重新登录");
      navigate("/login");
    },
    setSession
  });

  useEffect(() => {
    const syncRoute = () => setRoute(window.location.pathname);
    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, []);

  useEffect(() => {
    if (!session && route !== "/login") {
      navigate("/login");
      return;
    }

    if (session && route === "/login") {
      navigate("/workspace");
    }
  }, [route, session]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("正在登录");

    try {
      await api.login(email, password);
      setStatus("登录成功");
      navigate("/workspace");
    } catch {
      setStatus("登录失败，请检查账号或网络");
    }
  };

  const verifySession = async () => {
    setStatus("正在校验会话");

    try {
      const result = await api.me();
      setStatus(result.refreshed ? "会话已刷新" : `已连接 ${result.data.name}`);
    } catch {
      setStatus("会话已过期，请重新登录");
    }
  };

  if (!session || route === "/login") {
    return (
      <main className="login-composition">
        <section className="login-hero" aria-label="Codeworks 登录">
          <p className="eyebrow">PSA + 轻 ERP</p>
          <h1>{APP_NAME}</h1>
          <p className="subtitle">
            将项目、工时、排期与盈亏收束进同一个经营节奏。
          </p>
        </section>

        <section className="login-panel" aria-labelledby="login-title">
          <p className="panel-kicker">Secure workspace</p>
          <h2 id="login-title">登录 Codeworks</h2>
          <form className="login-form" onSubmit={handleLogin}>
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

  return (
    <main className="workspace-shell">
      <aside className="rail" aria-label="主导航">
        <strong>{APP_NAME}</strong>
        <nav>
          <a aria-current="page" href="/workspace">
            经营中枢
          </a>
          <span>项目</span>
          <span>工时</span>
          <span>排期</span>
        </nav>
      </aside>

      <section className="workspace-main" aria-labelledby="workspace-title">
        <p className="eyebrow">Authenticated shell</p>
        <h1 id="workspace-title">经营中枢</h1>
        <p className="subtitle">
          {session.user.name} 已进入 {session.tenant?.slug ?? "默认租户"}，后续业务页面复用此认证态与 API client。
        </p>

        <div className="workspace-actions">
          <button className="primary-action" onClick={verifySession} type="button">
            校验会话
          </button>
          <button
            className="ghost-action"
            onClick={() => {
              clearSession();
              navigate("/login");
            }}
            type="button"
          >
            退出
          </button>
        </div>

        <p className="status-line" role="status">
          {status}
        </p>
      </section>
    </main>
  );
}
