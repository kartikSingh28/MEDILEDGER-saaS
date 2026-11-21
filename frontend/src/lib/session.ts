export type Role = "PATIENT" | "DOCTOR" | "ADMIN";

export interface Session {
  token: string;
  role: Role;
  name: string;
  hospital: string;
}

const KEYS = ["token", "role", "name", "hospital"] as const;

// localStorage can throw (private mode, blocked storage); treat that as signed out
export function getSession(): Session | null {
  try {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role") as Role | null;
    if (!token || !role) return null;
    return {
      token,
      role,
      name: localStorage.getItem("name") ?? "",
      hospital: localStorage.getItem("hospital") ?? "",
    };
  } catch {
    return null;
  }
}

export function saveSession(session: Session) {
  for (const key of KEYS) localStorage.setItem(key, session[key]);
}

export function clearSession() {
  try {
    for (const key of KEYS) localStorage.removeItem(key);
  } catch {
    // nothing stored
  }
}

export function homeFor(role: Role): string {
  if (role === "PATIENT") return "/patient";
  if (role === "DOCTOR") return "/doctor";
  return "/";
}
