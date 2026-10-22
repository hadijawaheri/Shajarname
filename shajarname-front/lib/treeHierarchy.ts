import type { FamilyMember, MarriageNode } from "./types";

export interface HierarchyNode {
  id: string;
  name: string;
  lastName?: string;
  fullName: string;
  birth?: number;
  death?: number | "living";
  gender: "m" | "f";
  avatar?: string;
  spouse?: string;
  spouseGender?: "m" | "f";
  spouseAvatar?: string;
  isSpouse?: boolean;
  spouseRole?: string;
  children: HierarchyNode[];
  marriages?: HierarchyNode[];
  leafCount: number;
  color?: string;
  level: number;
}

export interface HierarchyTree {
  root: HierarchyNode;
  rightBranches: HierarchyNode[];
  leftBranches: HierarchyNode[];
  totalMembers: number;
  maxLevel: number;
}

const BRANCH_COLORS = [
  "#059669", // Emerald
  "#0284c7", // Sky Blue
  "#7c3aed", // Violet
  "#e11d48", // Rose
  "#d97706", // Amber
  "#0d9488", // Teal
  "#ea580c", // Orange
  "#4f46e5", // Indigo
  "#16a34a", // Green
  "#b45309", // Bronze
];

/**
 * Builds a hierarchical tree from FamilyMember and MarriageNode arrays.
 * Preserves distinct marriages/spouses and maps children strictly to their biological mothers.
 */
export function buildHierarchyFromFamily(
  members: FamilyMember[],
  marriages: MarriageNode[],
  forcedRootId?: string,
): HierarchyTree | null {
  if (!members || members.length === 0) return null;

  const canvasMembers = members.filter((m) => m.assigned);
  const activeMembers = canvasMembers.length > 0 ? canvasMembers : members;

  const memberMap = new Map<string, FamilyMember>();
  activeMembers.forEach((m) => memberMap.set(m.id, m));

  const marriageMap = new Map<string, MarriageNode>();
  marriages.forEach((mn) => marriageMap.set(mn.id, mn));

  // Determine root ancestor
  let rootMember: FamilyMember | undefined;

  if (forcedRootId && memberMap.has(forcedRootId)) {
    rootMember = memberMap.get(forcedRootId);
  } else {
    // Find candidates with no parent marriage
    const candidates = activeMembers.filter(
      (m) => !m.parentMarriageNode || !marriageMap.has(m.parentMarriageNode),
    );

    // Score candidates: prioritize having children, earlier birth year, and male patriarch
    candidates.sort((a, b) => {
      const aHasKids = marriages.some(
        (mn) => (mn.husband === a.id || mn.wife === a.id) &&
          activeMembers.some((cm) => cm.parentMarriageNode === mn.id),
      );
      const bHasKids = marriages.some(
        (mn) => (mn.husband === b.id || mn.wife === b.id) &&
          activeMembers.some((cm) => cm.parentMarriageNode === mn.id),
      );
      if (aHasKids && !bHasKids) return -1;
      if (!aHasKids && bHasKids) return 1;

      // Earliest birth year first
      const birthA = a.birth || 9999;
      const birthB = b.birth || 9999;
      if (birthA !== birthB) return birthA - birthB;

      // Male preference for traditional root patriarch
      if (a.gender === "m" && b.gender !== "m") return -1;
      if (a.gender !== "m" && b.gender === "m") return 1;

      return 0;
    });

    rootMember = candidates[0] || activeMembers[0];
  }

  if (!rootMember) return null;

  // Marriages lookup helper
  function getMarriagesForPerson(personId: string): MarriageNode[] {
    return marriages.filter(
      (mn) => mn.husband === personId || mn.wife === personId,
    );
  }

  function getChildrenForMarriage(marriageId: string): FamilyMember[] {
    return activeMembers.filter((m) => m.parentMarriageNode === marriageId);
  }

  let totalCount = 0;
  let highestLevel = 0;
  const globalVisited = new Set<string>();

  function buildPersonRecursive(
    member: FamilyMember,
    level: number,
    inheritedColor?: string,
  ): HierarchyNode {
    globalVisited.add(member.id);
    totalCount++;
    if (level > highestLevel) highestLevel = level;

    const pMarriages = getMarriagesForPerson(member.id);
    const marriageNodes: HierarchyNode[] = [];
    const allChildren: HierarchyNode[] = [];
    const spouseNames: string[] = [];

    pMarriages.forEach((mn, idx) => {
      const spouseId = mn.husband === member.id ? mn.wife : mn.husband;
      const spouseMember = memberMap.get(spouseId);
      if (spouseMember) {
        spouseNames.push(spouseMember.nameAr || spouseMember.nameEn || "");
      }

      const kids = getChildrenForMarriage(mn.id);
      const childNodes: HierarchyNode[] = [];

      kids.forEach((kid) => {
        if (!globalVisited.has(kid.id)) {
          const childNode = buildPersonRecursive(kid, level + 2, inheritedColor);
          childNodes.push(childNode);
          allChildren.push(childNode);
        }
      });

      let spouseRole = "همسر";
      if (pMarriages.length > 1) {
        spouseRole =
          idx === 0
            ? "همسر اول"
            : idx === 1
            ? "همسر دوم"
            : idx === 2
            ? "همسر سوم"
            : `همسر ${idx + 1}`;
      }

      const spouseDisplayName = spouseMember
        ? (spouseMember.nameAr || spouseMember.nameEn || "همسر")
        : "همسر";

      const spouseLeafCount =
        childNodes.length === 0
          ? 1
          : childNodes.reduce((sum, c) => sum + c.leafCount, 0);

      const marriageNode: HierarchyNode = {
        id: mn.id,
        name: spouseDisplayName,
        lastName: spouseMember?.nameEn,
        fullName: spouseDisplayName,
        gender: "f",
        birth: spouseMember?.birth,
        death: spouseMember?.death,
        avatar: spouseMember?.avatar,
        isSpouse: true,
        spouseRole,
        children: childNodes,
        marriages: [],
        leafCount: spouseLeafCount,
        level: level + 1,
        color: "#ec4899",
      };

      marriageNodes.push(marriageNode);
    });

    // Also collect any children not attached through explicit marriage nodes
    const unattachedChildren = activeMembers.filter(
      (m) =>
        m.parentMarriageNode &&
        !pMarriages.some((mn) => mn.id === m.parentMarriageNode) &&
        !globalVisited.has(m.id),
    );
    // (unattached children are not matching this person so they will be skipped)

    let leafCount = 0;
    if (marriageNodes.length === 0) {
      leafCount = 1;
    } else {
      marriageNodes.forEach((m) => (leafCount += m.leafCount));
    }

    const displayName = member.nameAr || member.nameEn || "بی‌نام";

    return {
      id: member.id,
      name: displayName,
      lastName: member.nameEn,
      fullName:
        member.nameAr && member.nameEn
          ? `${member.nameAr} ${member.nameEn}`
          : displayName,
      birth: member.birth,
      death: member.death,
      gender: member.gender,
      avatar: member.avatar,
      spouse: spouseNames.join("، "),
      children: allChildren,
      marriages: marriageNodes,
      isSpouse: false,
      leafCount,
      color: inheritedColor,
      level,
    };
  }

  const rootNode = buildPersonRecursive(rootMember, 0, "#d97706");

  // Assign distinct colors to top-level children branches
  rootNode.children.forEach((branch, idx) => {
    const color = BRANCH_COLORS[idx % BRANCH_COLORS.length];
    branch.color = color;
    function propagateColor(node: HierarchyNode) {
      node.color = color;
      if (node.marriages) {
        node.marriages.forEach((m) => {
          m.children.forEach(propagateColor);
        });
      }
      if (node.children) {
        node.children.forEach(propagateColor);
      }
    }
    propagateColor(branch);
  });

  // Balance top-level children into right and left branches
  const sortedBranches = [...rootNode.children].sort(
    (a, b) => b.leafCount - a.leafCount,
  );
  const rightBranches: HierarchyNode[] = [];
  const leftBranches: HierarchyNode[] = [];
  let rightLeaves = 0;
  let leftLeaves = 0;

  sortedBranches.forEach((b) => {
    if (rightLeaves <= leftLeaves) {
      rightBranches.push(b);
      rightLeaves += b.leafCount;
    } else {
      leftBranches.push(b);
      leftLeaves += b.leafCount;
    }
  });

  return {
    root: rootNode,
    rightBranches,
    leftBranches,
    totalMembers: totalCount,
    maxLevel: highestLevel,
  };
}
