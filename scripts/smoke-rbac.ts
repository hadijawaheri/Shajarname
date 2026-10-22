/**
 * API smoke: JWT guards + RBAC + audit for users/members.
 * Requires running backend on :7781.
 * Run: pnpm test:rbac
 */
const API = process.env.API_BASE || "http://localhost:7781/v1";

async function login(mobile: string, password: string) {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobile, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`login ${mobile}: ${res.status} ${JSON.stringify(body)}`);
  return body as { accessToken: string; member: { id: string; role: string } };
}

async function main() {
  const mahramAnon = await fetch(
    `${API}/members/mahram-check?activeUserId=x&targetMemberId=y`,
  );
  if (mahramAnon.status !== 401) {
    throw new Error(`expected mahram 401, got ${mahramAnon.status}`);
  }

  const admin = await login("09120000000", "najaf123");
  if (admin.member.role !== "admin") throw new Error("admin role expected");

  const usersRes = await fetch(`${API}/users`, {
    headers: { Authorization: `Bearer ${admin.accessToken}` },
  });
  if (!usersRes.ok) throw new Error(`users list failed: ${usersRes.status}`);
  const usersBody = (await usersRes.json()) as {
    users: { id: string; mobile: string; role: string }[];
  };
  if (!Array.isArray(usersBody.users)) throw new Error("users array missing");

  const member = await login("09121111111", "member123");
  const forbid = await fetch(`${API}/users`, {
    headers: { Authorization: `Bearer ${member.accessToken}` },
  });
  if (forbid.status !== 403) {
    throw new Error(`member users list expected 403, got ${forbid.status}`);
  }

  const editor = usersBody.users.find((u) => u.mobile === "09122222222");
  if (editor) {
    const flip = await fetch(`${API}/users/${editor.id}/role`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${admin.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "editor" }),
    });
    if (!flip.ok) throw new Error(`role set failed: ${flip.status} ${await flip.text()}`);
  }

  const auditRes = await fetch(`${API}/users/audit?limit=10`, {
    headers: { Authorization: `Bearer ${admin.accessToken}` },
  });
  if (!auditRes.ok) throw new Error(`audit list failed: ${auditRes.status}`);
  const auditBody = (await auditRes.json()) as { logs: { action: string }[] };
  if (!Array.isArray(auditBody.logs)) throw new Error("audit logs missing");
  if (editor && auditBody.logs.length < 1) {
    throw new Error("expected at least one audit log after role change");
  }
  if (editor && !auditBody.logs.some((l) => l.action === "user.role_changed")) {
    throw new Error("expected user.role_changed audit entry");
  }

  const auditForbid = await fetch(`${API}/users/audit`, {
    headers: { Authorization: `Bearer ${member.accessToken}` },
  });
  if (auditForbid.status !== 403) {
    throw new Error(`member audit expected 403, got ${auditForbid.status}`);
  }

  const create = await fetch(`${API}/members`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${member.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "تست",
      lastName: "ممنوع",
      gender: "male",
      birthday: "2000-01-01",
    }),
  });
  if (create.status !== 403) {
    throw new Error(`member create expected 403, got ${create.status}`);
  }

  console.log("smoke-rbac OK", {
    accounts: usersBody.users.length,
    admin: admin.member.role,
    member: member.member.role,
    auditLogs: auditBody.logs.length,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
