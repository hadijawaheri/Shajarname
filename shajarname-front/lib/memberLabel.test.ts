/**
 * Lightweight node test runner for memberLabel (no Jest dependency on front).
 * Run: npx tsx shajarname-front/lib/memberLabel.test.ts
 */
import assert from "node:assert/strict";
import { formatMemberLabel, formatMemberSubtitle } from "./memberLabel.ts";
import type { FamilyMember, MarriageNode } from "./types.ts";

function member(
  partial: Partial<FamilyMember> & Pick<FamilyMember, "id" | "nameAr" | "nameEn">,
): FamilyMember {
  return {
    gender: "m",
    birth: 2000,
    death: "living",
    x: 0,
    y: 0,
    assigned: true,
    privacy: false,
    bio: "",
    mobile: "auto-test",
    ...partial,
  };
}

const father = member({ id: "f1", nameAr: "محمد علی جواهری", nameEn: "Mohammad Ali" });
const child = member({
  id: "c1",
  nameAr: "حسین جواهری",
  nameEn: "Hossein",
  parentMarriageNode: "m1",
});
const orphan = member({ id: "o1", nameAr: "حسین جواهری", nameEn: "Hossein", birth: 1999 });
const marriages: MarriageNode[] = [{ id: "m1", husband: "f1", wife: "w1", x: 0, y: 0 }];
const members = [father, child, orphan];
const ctx = { members, marriages };

assert.equal(formatMemberLabel(child, "fa", ctx), "حسین جواهری · پسر محمد");
assert.equal(formatMemberLabel(orphan, "fa", ctx), "حسین جواهری (1999)");
assert.equal(formatMemberSubtitle(child, "fa", ctx), "پسر محمد");
assert.equal(formatMemberSubtitle(orphan, "fa", ctx), null);

console.log("memberLabel tests OK");
