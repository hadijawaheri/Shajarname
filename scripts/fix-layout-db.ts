/** One-shot: push computed layout to API (fixes corrupted positionY in DB). */
import { computeAutoLayout } from "../shajarname-front/lib/layout.ts";
import { buildTreeFromApi } from "../shajarname-front/lib/types.ts";

const API = "http://localhost:7781/v1";

async function main() {
  const login = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobile: "09120000000", password: "najaf123" }),
  }).then((r) => r.json());

  const token = login.accessToken as string;
  const [membersRes, marriagesRes] = await Promise.all([
    fetch(`${API}/members`),
    fetch(`${API}/members/marriages`),
  ]);
  const { members: apiMembers } = await membersRes.json();
  const { marriages: apiMarriages } = await marriagesRes.json();

  const tree = buildTreeFromApi(apiMembers, apiMarriages);
  const laid = computeAutoLayout(
    tree.members.map((m) => ({ ...m, assigned: true })),
    tree.marriageNodes,
  );

  const positions = laid.members
    .filter((m) => m.assigned && m.x >= 0 && m.y >= 0 && m.x < 4500 && m.y < 4500)
    .map((m) => ({ id: m.id, positionX: m.x, positionY: m.y }));

  const res = await fetch(`${API}/members/layout`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ positions }),
  });

  console.log(await res.json());
}

main().catch(console.error);
