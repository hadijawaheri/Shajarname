const TOKEN_KEY = "khandan_token";
const REFRESH_KEY = "khandan_refresh";
const USER_KEY = "khandan_user";

export type AppRole = "admin" | "editor" | "member";

export interface AuthUser {
  id: string;
  name: string;
  lastName: string;
  mobile: string;
  role: AppRole;
  language: "fa" | "ar";
  avatar?: string;
  mustChangePassword?: boolean;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function setAuth(accessToken: string, refreshToken: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function updateAuthUser(partial: Partial<AuthUser>) {
  if (typeof window === "undefined") return;
  const current = getAuthUser();
  if (current) {
    const updated = { ...current, ...partial };
    localStorage.setItem(USER_KEY, JSON.stringify(updated));
  }
}

export function updateAccessToken(accessToken: string) {
  localStorage.setItem(TOKEN_KEY, accessToken);
}

export function getAuthUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function isAdmin(): boolean {
  return getAuthUser()?.role === "admin";
}

/** Admin or editor — can mutate the family tree. */
export function canEditTree(): boolean {
  const role = getAuthUser()?.role;
  return role === "admin" || role === "editor";
}

export function canManageUsers(): boolean {
  return isAdmin();
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
