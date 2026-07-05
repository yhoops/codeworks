/**
 * 会话与浏览器路由 hook。
 * 这里集中处理本地 session、history popstate、登录/校验会话和重新登录跳转，
 * 让 App 只消费认证态与导航命令，不直接持有认证副作用。
 * 依赖：api/client 与浏览器 history；被用于：App 路由装配。
 */
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import {
  clearStoredSession,
  createApiClient,
  persistSession,
  readStoredSession
} from "../api/client.js";
import type { AuthSession } from "../api/types.js";

export function useSession() {
  const [route, setRoute] = useState(() => window.location.pathname);
  const [session, setSessionState] = useState<AuthSession | null>(() =>
    readStoredSession()
  );
  const [tenantSlug, setTenantSlug] = useState("demo");
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
      await api.login(email, password, tenantSlug);
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

  return {
    api,
    clearSession,
    email,
    handleLogin,
    navigate,
    password,
    route,
    session,
    setEmail,
    setPassword,
    setStatus,
    setTenantSlug,
    status,
    tenantSlug,
    verifySession
  };
}
