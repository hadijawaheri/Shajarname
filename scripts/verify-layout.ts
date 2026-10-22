import { computeAutoLayout } from "../shajarname-front/lib/layout.ts";
import { buildTreeFromApi } from "../shajarname-front/lib/types.ts";

const API = "http://localhost:7781/v1";

async function main() {
  const [membersRes, marriagesRes] = await Promise.all([
    fetch(`${API}/members`),
    fetch(`${API}/members/marriages`),
  ]);
  const { members: apiMembers } = await membersRes.json();
  const { marriages: apiMarriages } = await marriagesRes.json();

  const tree = buildTreeFromApi(apiMembers, apiMarriages);
  const withAssigned = tree.members.map((m) => ({ ...m, assigned: true }));
  const laid = computeAutoLayout(withAssigned, tree.marriageNodes);

  const positions = laid.members.map((m) => ({
    id: m.id.slice(-4),
    name: m.nameAr,
    x: m.x,
    y: m.y,
  }));

  const bad = laid.members.filter((m) => m.y > 5000 || m.x > 5000 || m.y < 0);
  const marriages = laid.marriageNodes.map((mn) => ({ id: mn.id.slice(-4), x: mn.x, y: mn.y }));

  console.log("positions:", JSON.stringify(positions, null, 2));
  console.log("marriages:", JSON.stringify(marriages, null, 2));
  console.log("bad count:", bad.length);

  if (bad.length > 0) process.exit(1);
  if (laid.members.length < 6) process.exit(1);
  if (laid.marriageNodes.filter((m) => m.x > 0).length < 2) process.exit(1);
  console.log("OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
