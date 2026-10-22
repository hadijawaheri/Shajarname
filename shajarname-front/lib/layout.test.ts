import assert from "node:assert/strict";
import { computeAutoLayout } from "./layout.ts";
import type { FamilyMember, MarriageNode } from "./types.ts";

function member(id: string, gender: "m" | "f", parentMarriageNode?: string): FamilyMember {
  return {
    id,
    nameAr: id,
    nameEn: id,
    mobile: "",
    birth: 1980,
    death: "living",
    gender,
    privacy: false,
    bio: "",
    assigned: true,
    x: 0,
    y: 0,
    parentMarriageNode,
  };
}

{
  const members = [member("father", "m"), member("mother", "f"), member("child", "m", "parents")];
  const marriages: MarriageNode[] = [
    { id: "parents", husband: "father", wife: "mother", x: 0, y: 0, isExplicit: true },
  ];
  const result = computeAutoLayout(members, marriages);
  const father = result.members.find((item) => item.id === "father")!;
  const mother = result.members.find((item) => item.id === "mother")!;
  const child = result.members.find((item) => item.id === "child")!;
  assert.notEqual(father.x, mother.x);
  assert.ok(child.y > father.y);
  assert.ok(Number.isFinite(result.marriageNodes[0].x));
}

{
  // Corrupt ancestry can exist in legacy data; layout must degrade safely, never recurse forever.
  const members = [member("a", "m", "loop"), member("b", "f")];
  const marriages: MarriageNode[] = [
    { id: "loop", husband: "a", wife: "b", x: 0, y: 0, isExplicit: true },
  ];
  const result = computeAutoLayout(members, marriages);
  assert.equal(result.members.length, 2);
  assert.ok(result.members.every((item) => Number.isFinite(item.x) && Number.isFinite(item.y)));
}

console.log("layout tests OK");
