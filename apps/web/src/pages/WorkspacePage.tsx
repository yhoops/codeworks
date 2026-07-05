/**
 * 经营中枢页面。
 * 页面只展示当前认证态和会话操作，session 校验与退出清理由 useSession 提供。
 * 这保持默认路由为轻量入口，不承担数据加载职责。
 * 依赖：AuthSession 与 useSession 动作；被用于：App 的默认认证路由。
 */
import type { AuthSession } from "../api/types.js";

interface WorkspacePageProps {
  clearSession: () => void;
  navigate: (path: string) => void;
  session: AuthSession;
  status: string;
  verifySession: () => void | Promise<void>;
}

export function WorkspacePage({
  clearSession,
  navigate,
  session,
  status,
  verifySession
}: WorkspacePageProps) {
  return (
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
  );
}
