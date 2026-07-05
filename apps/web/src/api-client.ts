export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  tenant?: {
    id: string;
    slug: string;
    role: string;
  };
}

export type BoardColumn = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";

export interface CoreTask {
  id: string;
  projectId: string;
  sprintId: string | null;
  title: string;
  status: string;
  boardColumn: BoardColumn;
  estimateHours: number;
  assigneeUserId: string | null;
}

export interface CoreTimeEntry {
  id: string;
  taskId: string;
  employeeId: string;
  hours: number;
  source: "AUTO" | "MANUAL";
  note: string | null;
}

export interface CoreAllocation {
  id: string;
  employeeId: string;
  projectId: string;
  taskId: string | null;
  weekStart: string;
  plannedHours: number;
  availableHoursOverride: number | null;
  isOverloaded: boolean;
}

export interface CoreWorkspace {
  projects: Array<{ id: string; name: string; status: string }>;
  tasks: CoreTask[];
  employees: Array<{ id: string; name: string; email: string | null }>;
  timeEntries: CoreTimeEntry[];
  allocations: CoreAllocation[];
}

export interface DashboardProject {
  id: string;
  name: string;
  revenue: number;
  totalCost: number;
  grossProfit: number;
  grossMargin: number;
  overBudget: boolean;
  utilization: {
    plannedHours: number;
    availableHours: number;
    utilizationRatio: number;
    isOverloaded: boolean;
  };
}

export interface DashboardData {
  projects: DashboardProject[];
}

export const AUTH_STORAGE_KEY = "codeworks.auth";

interface ApiClientOptions {
  getSession: () => AuthSession | null;
  setSession: (session: AuthSession) => void;
  clearSession: () => void;
  onReloginRequired: () => void;
  baseUrl?: string;
}

interface ApiResult<T> {
  data: T;
  refreshed: boolean;
}

export function readStoredSession(storage = window.localStorage): AuthSession | null {
  const raw = storage.getItem(AUTH_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    storage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function persistSession(session: AuthSession, storage = window.localStorage) {
  storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession(storage = window.localStorage) {
  storage.removeItem(AUTH_STORAGE_KEY);
}

export function createApiClient({
  getSession,
  setSession,
  clearSession,
  onReloginRequired,
  baseUrl = "/api"
}: ApiClientOptions) {
  const authHeaders = (token: string) => ({
    authorization: `Bearer ${token}`
  });

  const parseJson = async <T>(response: Response): Promise<T> =>
    (await response.json()) as T;

  const refreshSession = async () => {
    const session = getSession();

    if (!session?.refreshToken) {
      return null;
    }

    const response = await fetch(`${baseUrl}/auth/refresh`, {
      body: JSON.stringify({ refreshToken: session.refreshToken }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });

    if (!response.ok) {
      clearSession();
      onReloginRequired();
      return null;
    }

    const nextSession = await parseJson<AuthSession>(response);
    setSession(nextSession);
    return nextSession;
  };

  const requestWithAuth = async <T>(
    path: string,
    init: RequestInit = {},
    retry = true
  ): Promise<ApiResult<T>> => {
    const session = getSession();

    if (!session) {
      clearSession();
      onReloginRequired();
      throw new Error("Authentication required");
    }

    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        ...init.headers,
        ...authHeaders(session.accessToken)
      }
    });

    if (response.status === 401 && retry) {
      const refreshedSession = await refreshSession();

      if (!refreshedSession) {
        throw new Error("Session expired");
      }

      const retried = await requestWithAuth<T>(path, init, false);
      return { data: retried.data, refreshed: true };
    }

    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }

    return { data: await parseJson<T>(response), refreshed: false };
  };

  return {
    async login(email: string, password: string) {
      const response = await fetch(`${baseUrl}/auth/login`, {
        body: JSON.stringify({ email, password }),
        headers: { "content-type": "application/json" },
        method: "POST"
      });

      if (!response.ok) {
        throw new Error("Login failed");
      }

      const session = await parseJson<AuthSession>(response);
      setSession(session);
      return session;
    },
    me() {
      return requestWithAuth<AuthUser>("/auth/me");
    },
    workspace() {
      return requestWithAuth<CoreWorkspace>("/core/workspace");
    },
    dashboard() {
      return requestWithAuth<DashboardData>("/core/dashboard");
    },
    moveTask(taskId: string, boardColumn: BoardColumn) {
      return requestWithAuth<{ task: CoreTask; timeEntry: CoreTimeEntry | null }>(
        `/core/tasks/${taskId}/move`,
        {
          body: JSON.stringify({ boardColumn }),
          headers: { "content-type": "application/json" },
          method: "PATCH"
        }
      );
    },
    correctTimeEntry(input: {
      taskId: string;
      employeeId: string;
      hours: number;
      note?: string;
    }) {
      return requestWithAuth<{ timeEntry: CoreTimeEntry }>("/core/time-entries", {
        body: JSON.stringify(input),
        headers: { "content-type": "application/json" },
        method: "PATCH"
      });
    },
    scheduleAllocation(input: {
      employeeId: string;
      projectId: string;
      taskId?: string;
      weekStart: string;
      plannedHours: number;
    }) {
      return requestWithAuth<{
        allocation: CoreAllocation;
        utilization: {
          employeeId: string;
          plannedHours: number;
          availableHours: number;
          utilizationRatio: number;
          isOverloaded: boolean;
        };
      }>("/core/allocations", {
        body: JSON.stringify(input),
        headers: { "content-type": "application/json" },
        method: "POST"
      });
    }
  };
}
