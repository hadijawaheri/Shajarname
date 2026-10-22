const API_BASE = process.env.API_BASE_URL || "http://localhost:7781/v1";

let cachedAccessToken: string | null = null;
let cachedRefreshToken: string | null = null;

async function ensureToken(): Promise<string> {
  if (cachedAccessToken) return cachedAccessToken;
  const mobile = process.env.BOT_MOBILE;
  const password = process.env.BOT_PASSWORD;
  if (!mobile || !password) {
    throw new Error("BOT_MOBILE and BOT_PASSWORD are required");
  }
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobile, password }),
  });
  if (!res.ok) throw new Error("Bot API authentication failed");
  const data = (await res.json()) as { accessToken: string; refreshToken: string };
  cachedAccessToken = data.accessToken;
  cachedRefreshToken = data.refreshToken;
  return cachedAccessToken;
}

async function refreshAccessToken(): Promise<string | null> {
  if (!cachedRefreshToken) return ensureToken();
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: cachedRefreshToken }),
  });
  if (!res.ok) {
    cachedAccessToken = null;
    cachedRefreshToken = null;
    return ensureToken();
  }
  const data = (await res.json()) as { accessToken: string; refreshToken: string };
  cachedAccessToken = data.accessToken;
  cachedRefreshToken = data.refreshToken;
  return cachedAccessToken;
}

async function authFetch(path: string, options?: RequestInit, retry = true) {
  const token = await ensureToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options?.headers as Record<string, string>),
    },
  });
  if (res.status === 401 && retry) {
    await refreshAccessToken();
    return authFetch(path, options, false);
  }
  return res;
}

export async function fetchStats() {
  const res = await authFetch("/members/stats");
  if (!res.ok) throw new Error("Stats fetch failed");
  const data = (await res.json()) as { stats: { total: number; deceased: number; males: number; females: number } };
  return data.stats;
}

export async function fetchMembers() {
  const res = await authFetch("/members");
  if (!res.ok) throw new Error("Members fetch failed");
  const data = (await res.json()) as {
    members: Array<{ _id: string; name: string; lastName: string; gender: string; birthday: string; deathday?: string }>;
  };
  return data.members;
}

export async function fetchMarriages() {
  const res = await authFetch("/members/marriages");
  if (!res.ok) throw new Error("Marriages fetch failed");
  const data = (await res.json()) as {
    marriages: Array<{ _id: string; spouseA: string; spouseB: string; children: string[] }>;
  };
  return data.marriages;
}

export async function getRelationship(userAId: string, userBId: string, lang: "fa" | "ar") {
  const query = new URLSearchParams({ userAId, userBId, lang });
  const res = await authFetch(`/members/relationship?${query.toString()}`);
  if (!res.ok) throw new Error("Relationship fetch failed");
  const data = (await res.json()) as { relationship: string };
  return data.relationship;
}

export async function createMember(payload: Record<string, unknown>) {
  const res = await authFetch("/members", { method: "POST", body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as { member: { _id: string } };
  return data.member;
}

export async function addChildToMarriage(marriageId: string, childId: string) {
  const res = await authFetch(`/members/marriages/${marriageId}/children`, {
    method: "POST",
    body: JSON.stringify({ childId }),
  });
  if (!res.ok) throw new Error(await res.text());
}
