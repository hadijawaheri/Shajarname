import type { ApiMember, ApiMarriage } from "./types";
import { getToken, getRefreshToken, setAuth, updateAccessToken, clearAuth, type AppRole } from "./auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7781/v1";
export const API_ORIGIN = API_BASE.replace(/\/v1$/, "");

let refreshPromise: Promise<string | null> | null = null;

async function tryRefreshToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        let res: Response;
        try {
          res = await fetch(`${API_BASE}/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
          });
        } catch (netErr) {
          if (typeof window !== "undefined" && !API_BASE.startsWith(window.location.origin)) {
            res = await fetch(`${window.location.origin}/v1/auth/refresh`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refreshToken }),
            });
          } else {
            throw netErr;
          }
        }
        if (!res.ok) {
          clearAuth();
          return null;
        }
        const data = (await res.json()) as {
          accessToken: string;
          refreshToken: string;
          member: { id: string; name: string; lastName: string; mobile: string; role: AppRole; language: "fa" | "ar"; avatar?: string };
        };
        setAuth(data.accessToken, data.refreshToken, data.member);
        return data.accessToken;
      } catch {
        clearAuth();
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export class AuthError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "AuthError";
  }
}

async function request<T>(path: string, options?: RequestInit, retry = true): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (!(options?.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { ...headers, ...(options?.headers as Record<string, string>) },
    });
  } catch (netErr) {
    if (typeof window !== "undefined" && !API_BASE.startsWith(window.location.origin)) {
      try {
        res = await fetch(`${window.location.origin}/v1${path}`, {
          ...options,
          headers: { ...headers, ...(options?.headers as Record<string, string>) },
        });
      } catch {
        throw netErr;
      }
    } else {
      throw netErr;
    }
  }

  if (res.status === 401 && retry) {
    const newToken = await tryRefreshToken();
    if (newToken) return request<T>(path, options, false);
    clearAuth();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("khandan:auth-expired"));
    }
    throw new AuthError("Session expired");
  }

  if (res.status === 401) {
    clearAuth();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("khandan:auth-expired"));
    }
    throw new AuthError("Unauthorized");
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `API error ${res.status}`);
  }

  if (res.headers.get("content-type")?.includes("application/pdf")) {
    return res.blob() as Promise<T>;
  }

  return res.json() as Promise<T>;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  member: {
    id: string;
    name: string;
    lastName: string;
    mobile: string;
    role: AppRole;
    language: "fa" | "ar";
    avatar?: string;
    mustChangePassword?: boolean;
  };
}

export async function login(mobile: string, password: string): Promise<LoginResponse> {
  let res: Response;
  const body = JSON.stringify({ mobile, password });
  try {
    res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  } catch (netErr) {
    if (typeof window !== "undefined" && !API_BASE.startsWith(window.location.origin)) {
      res = await fetch(`${window.location.origin}/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
    } else {
      throw netErr;
    }
  }
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<LoginResponse>;
}

export async function logoutApi(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => {});
  }
  clearAuth();
}

export async function fetchMe(): Promise<LoginResponse["member"]> {
  const data = await request<{ member: LoginResponse["member"] }>("/auth/me");
  return data.member;
}

export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await request("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function fetchMembers(): Promise<ApiMember[]> {
  const data = await request<{ members: ApiMember[] }>("/members");
  return data.members;
}

export async function fetchMarriages(): Promise<ApiMarriage[]> {
  const data = await request<{ marriages: ApiMarriage[] }>("/members/marriages");
  return data.marriages;
}

export async function fetchStats() {
  const data = await request<{ stats: { total: number; deceased: number; males: number; females: number; onCanvas: number } }>("/members/stats");
  return data.stats;
}

export async function createMember(payload: Record<string, unknown>): Promise<ApiMember> {
  const data = await request<{ member: ApiMember }>("/members", { method: "POST", body: JSON.stringify(payload) });
  return data.member;
}

export async function updateMember(id: string, payload: Record<string, unknown>): Promise<ApiMember> {
  const data = await request<{ member: ApiMember }>(`/members/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  return data.member;
}

export async function deleteMember(id: string): Promise<void> {
  await request(`/members/${id}`, { method: "DELETE" });
}

export async function createMarriage(spouseA: string, spouseB: string, children: string[] = []): Promise<ApiMarriage> {
  const data = await request<{ marriage: ApiMarriage }>("/members/marriages", {
    method: "POST",
    body: JSON.stringify({ spouseA, spouseB, children }),
  });
  return data.marriage;
}

export async function deleteMarriage(marriageId: string): Promise<void> {
  await request(`/members/marriages/${marriageId}`, { method: "DELETE" });
}

export async function addChildToMarriage(marriageId: string, childId: string): Promise<ApiMarriage> {
  const data = await request<{ marriage: ApiMarriage }>(`/members/marriages/${marriageId}/children`, {
    method: "POST",
    body: JSON.stringify({ childId }),
  });
  return data.marriage;
}

export async function uploadAvatar(memberId: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const data = await request<{ avatar: string }>(`/members/${memberId}/avatar`, { method: "POST", body: formData });
  return data.avatar;
}

export async function uploadGalleryPhoto(memberId: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const data = await request<{ photo: string }>(`/members/${memberId}/photos`, { method: "POST", body: formData });
  return data.photo;
}

export async function uploadAudioMemory(memberId: string, file: File, title: string): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("title", title);
  await request(`/members/${memberId}/audio`, { method: "POST", body: formData });
}

export async function exportTreePdf(payload: {
  imageBase64: string;
  title: string;
  year: number;
  lang: "fa" | "ar";
}): Promise<Blob> {
  return request<Blob>("/export/tree-pdf", { method: "POST", body: JSON.stringify(payload) });
}

export async function checkMahram(activeUserId: string, targetMemberId: string): Promise<boolean> {
  const data = await request<{ isMahram: boolean }>(
    `/members/mahram-check?activeUserId=${activeUserId}&targetMemberId=${targetMemberId}`,
  );
  return data.isMahram;
}

export async function getRelationship(userAId: string, userBId: string, lang: "fa" | "ar"): Promise<string> {
  const data = await request<{ relationship: string }>(
    `/members/relationship?userAId=${userAId}&userBId=${userBId}&lang=${lang}`,
  );
  return data.relationship;
}

export async function syncLayout(positions: { id: string; positionX: number; positionY: number }[]): Promise<void> {
  await request("/members/layout", { method: "PUT", body: JSON.stringify({ positions }) });
}

export function avatarUrl(path?: string): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (typeof window !== "undefined") {
    return normalizedPath;
  }
  return `${API_ORIGIN}${normalizedPath}`;
}

export interface LoginAccount {
  id: string;
  name: string;
  lastName: string;
  mobile: string;
  role: AppRole;
  hasPassword: boolean;
  language: string;
}

export async function fetchLoginAccounts(): Promise<LoginAccount[]> {
  const data = await request<{ users: LoginAccount[] }>("/users");
  return data.users;
}

export async function setUserRole(id: string, role: AppRole): Promise<void> {
  await request(`/users/${id}/role`, { method: "PUT", body: JSON.stringify({ role }) });
}

export async function resetUserPassword(id: string, password: string): Promise<void> {
  await request(`/users/${id}/password`, { method: "PUT", body: JSON.stringify({ password }) });
}

export async function grantUserLogin(
  id: string,
  payload: { mobile?: string; password: string; role?: AppRole },
): Promise<void> {
  await request(`/users/${id}/login`, { method: "POST", body: JSON.stringify(payload) });
}

export async function revokeUserLogin(id: string): Promise<void> {
  await request(`/users/${id}/login`, { method: "DELETE" });
}

export type AuditAction =
  | "user.role_changed"
  | "user.password_reset"
  | "user.login_granted"
  | "user.login_revoked";

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  actorId: string;
  actorMobile?: string;
  targetId: string;
  targetMobile?: string;
  targetName?: string;
  meta: Record<string, unknown>;
  createdAt: string;
}

export async function fetchAuditLogs(limit = 40): Promise<AuditLogEntry[]> {
  const data = await request<{ logs: AuditLogEntry[] }>(`/users/audit?limit=${limit}`);
  return data.logs;
}
