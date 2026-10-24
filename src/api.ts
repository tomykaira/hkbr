import type {
  AssignmentRow,
  EntryInput,
  MeResponse,
  ProjectInput,
  ProjectSummary,
  ProjectView,
} from "../shared/api";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.error ?? `エラーが発生しました (${res.status})`, res.status);
  // 更新系のリクエストはセッションを作成・切り替えることがある
  if (method !== "GET") window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
  return data as T;
}

export const SESSION_CHANGE_EVENT = "hkbr:session-change";

export const api = {
  me: () => request<MeResponse>("GET", "/me"),
  issueTransferToken: () => request<{ token: string }>("POST", "/transfer-token"),
  revokeTransferToken: () => request<{ ok: true }>("DELETE", "/transfer-token"),
  transfer: (token: string) => request<{ ok: true }>("POST", "/transfer", { token }),
  myProjects: () => request<ProjectSummary[]>("GET", "/projects"),
  createProject: (input: ProjectInput) => request<{ id: string }>("POST", "/projects", input),
  getProject: (id: string) => request<ProjectView>("GET", `/projects/${encodeURIComponent(id)}`),
  updateProject: (id: string, input: Partial<ProjectInput>) =>
    request<{ ok: true }>("PATCH", `/projects/${encodeURIComponent(id)}`, input),
  submitEntry: (id: string, entry: EntryInput) =>
    request<{ ok: true }>("PUT", `/projects/${encodeURIComponent(id)}/entry`, entry),
  withdraw: (id: string) => request<{ ok: true }>("DELETE", `/projects/${encodeURIComponent(id)}/entry`),
  assignments: (id: string) =>
    request<AssignmentRow[]>("GET", `/projects/${encodeURIComponent(id)}/assignments`),
};

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
