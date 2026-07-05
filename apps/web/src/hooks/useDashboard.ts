/**
 * 实时盈亏数据 hook。
 * 这里集中处理 dashboard 加载与刷新状态，避免页面视图直接持有 PnL 请求副作用，
 * 并保持路由进入 /dashboard 时才加载数据的原有时机。
 * 依赖：认证后的 API client；被用于：App 的盈亏页。
 */
import { useEffect, useState } from "react";

import type { createApiClient } from "../api/client.js";
import type { AuthSession, DashboardData } from "../api/types.js";

type ApiClient = ReturnType<typeof createApiClient>;

interface UseDashboardOptions {
  api: ApiClient;
  route: string;
  session: AuthSession | null;
  setStatus: (status: string) => void;
}

export function useDashboard({ api, route, session, setStatus }: UseDashboardOptions) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);

  const loadDashboard = async (ignore = false) => {
    setStatus("正在刷新看板");

    try {
      const result = await api.dashboard();
      if (!ignore) {
        setDashboard(result.data);
        setStatus("看板已刷新");
      }
    } catch {
      if (!ignore) {
        setStatus("看板刷新失败");
      }
    }
  };

  useEffect(() => {
    if (!session || route !== "/dashboard") {
      return;
    }

    let ignore = false;
    void loadDashboard(ignore);

    return () => {
      ignore = true;
    };
  }, [route, session]);

  return { dashboard, loadDashboard };
}
