import { clearSession, getSession } from "./session";

export const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:5000").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type ApiInit = RequestInit & {
  // Send the session token (default). Off for sign in / sign up, so a stale
  // token can't turn a wrong password into a "session expired" redirect.
  auth?: boolean;
};

// The backend replies { error } or { message }; fall back to the status line
// when the body isn't JSON (proxy error pages, network gateways).
async function errorFrom(res: Response): Promise<ApiError> {
  let message = `${res.status} ${res.statusText}`.trim();
  try {
    const data = await res.json();
    message = data.error || data.message || message;
  } catch {
    // not JSON
  }
  return new ApiError(message, res.status);
}

export async function apiFetch(path: string, { auth = true, ...init }: ApiInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = auth ? getSession()?.token : undefined;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError("Can't reach the MediLedger server. Is the backend running?", 0);
  }

  // Expired or invalid session: sign out and send the user back to sign in
  if (res.status === 401 && token) {
    clearSession();
    window.location.assign("/login?expired=1");
    throw new ApiError("Your session has expired. Please sign in again.", 401);
  }

  if (!res.ok) throw await errorFrom(res);
  return res;
}

export async function apiJson<T>(path: string, init?: ApiInit): Promise<T> {
  const res = await apiFetch(path, init);
  return (await res.json()) as T;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong";
}

// Download a file response through a temporary link
export async function downloadFile(path: string, filename: string) {
  const res = await apiFetch(path);
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
