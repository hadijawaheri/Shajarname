import type { FamilyMember, MarriageNode } from "./types";

export const CARD_W = 210;
export const CARD_H = 100;
const GAP_X = 80;
const GAP_Y = 280;
const SLOT_W = CARD_W + GAP_X;
/** Extra space between disconnected family trees on the canvas. */
const TREE_GAP = SLOT_W * 2;
const CANVAS_ORIGIN_X = 2500;
const CANVAS_ORIGIN_Y = 1800;

/**
 * In-law = on canvas only via marriage, no parent marriage of their own.
 * These must NEVER be layout roots or sibling slots — only sit beside their spouse.
 */
function isInLaw(member: FamilyMember): boolean {
  return !member.parentMarriageNode;
}

function marriagePartnerId(mn: MarriageNode, memberId: string): string | null {
  if (mn.husband === memberId) return mn.wife || null;
  if (mn.wife === memberId) return mn.husband || null;
  return null;
}

function marriagesOf(memberId: string, marriageNodes: MarriageNode[]): MarriageNode[] {
  return marriageNodes.filter(
    (mn) =>
      (mn.husband === memberId || mn.wife === memberId) &&
      Boolean(mn.husband) &&
      Boolean(mn.wife),
  );
}

/**
 * Spouses drawn beside a blood member: partners who are in-laws (no parents).
 */
function sideSpouseIds(
  member: FamilyMember,
  assignedById: Map<string, FamilyMember>,
  marriageNodes: MarriageNode[],
): string[] {
  const ids: string[] = [];
  for (const mn of marriagesOf(member.id, marriageNodes)) {
    const otherId = marriagePartnerId(mn, member.id);
    if (!otherId) continue;
    const other = assignedById.get(otherId);
    if (!other) continue;
    if (isInLaw(other)) ids.push(otherId);
  }
  return ids;
}

/** Lineage depth from parent marriage only — never pull founders down via spouse links. */
function computeGenerations(
  assigned: FamilyMember[],
  marriageNodes: MarriageNode[],
): Map<string, number> {
  const gen = new Map<string, number>();
  const assignedById = new Map(assigned.map((m) => [m.id, m]));

  for (const m of assigned) {
    if (!m.parentMarriageNode) gen.set(m.id, 0);
  }

  let changed = true;
  let guard = 0;
  while (changed && guard++ < 50) {
    changed = false;
    for (const m of assigned) {
      if (!m.parentMarriageNode) continue;
      const mn = marriageNodes.find((x) => x.id === m.parentMarriageNode);
      if (!mn) continue;

      const parentGen = Math.max(
        mn.husband ? (gen.get(mn.husband) ?? -1) : -1,
        mn.wife ? (gen.get(mn.wife) ?? -1) : -1,
      );
      if (parentGen < 0) continue;

      const next = parentGen + 1;
      if ((gen.get(m.id) ?? -1) !== next) {
        gen.set(m.id, next);
        changed = true;
      }
    }
  }

  // In-laws share their blood spouse's generation.
  changed = true;
  guard = 0;
  while (changed && guard++ < 20) {
    changed = false;
    for (const mn of marriageNodes) {
      if (!mn.husband || !mn.wife) continue;
      const a = assignedById.get(mn.husband);
      const b = assignedById.get(mn.wife);
      if (!a || !b) continue;

      const ga = gen.get(a.id);
      const gb = gen.get(b.id);

      if (isInLaw(a) && !isInLaw(b) && gb !== undefined && ga !== gb) {
        gen.set(a.id, gb);
        changed = true;
      }
      if (isInLaw(b) && !isInLaw(a) && ga !== undefined && gb !== ga) {
        gen.set(b.id, ga);
        changed = true;
      }
      if (isInLaw(a) && isInLaw(b)) {
        if (ga === undefined) { gen.set(a.id, 0); changed = true; }
        if (gb === undefined) { gen.set(b.id, 0); changed = true; }
      }
    }
  }

  for (const m of assigned) {
    if (!gen.has(m.id)) gen.set(m.id, 0);
  }
  return gen;
}

/** Undirected family links: marriages + parent→child. */
function getConnectedComponents(
  assigned: FamilyMember[],
  marriageNodes: MarriageNode[],
): FamilyMember[][] {
  const byId = new Map(assigned.map((m) => [m.id, m]));
  const adj = new Map<string, Set<string>>();
  for (const m of assigned) adj.set(m.id, new Set());

  const link = (a?: string, b?: string) => {
    if (!a || !b || !adj.has(a) || !adj.has(b)) return;
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  };

  for (const mn of marriageNodes) {
    link(mn.husband, mn.wife);
  }
  for (const m of assigned) {
    if (!m.parentMarriageNode) continue;
    const mn = marriageNodes.find((x) => x.id === m.parentMarriageNode);
    if (!mn) continue;
    link(m.id, mn.husband);
    link(m.id, mn.wife);
  }

  const seen = new Set<string>();
  const components: FamilyMember[][] = [];

  for (const m of assigned) {
    if (seen.has(m.id)) continue;
    const queue = [m.id];
    seen.add(m.id);
    const group: FamilyMember[] = [];
    while (queue.length) {
      const id = queue.shift()!;
      const member = byId.get(id);
      if (member) group.push(member);
      for (const next of adj.get(id) ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    group.sort((a, b) => a.birth - b.birth || a.nameAr.localeCompare(b.nameAr, "fa"));
    components.push(group);
  }

  components.sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    const aBirth = Math.min(...a.map((m) => m.birth));
    const bBirth = Math.min(...b.map((m) => m.birth));
    return aBirth - bBirth;
  });

  return components;
}

/**
 * Layout strategy for polygamy:
 *
 *   [Husband] ─── [Wife1] ────── [Wife2] ───── [Wife3]
 *                    │               │
 *              [Children of W1]  [Children of W2]
 *
 * Each wife is placed to the right of the husband.
 * Children of each marriage are centered below the couple (husband-wife pair).
 * The wife's X position is pushed far enough right so her children don't overlap
 * with the previous wife's children.
 */
function layoutComponent(
  assigned: FamilyMember[],
  marriageNodes: MarriageNode[],
  originX: number,
): Map<string, { x: number; y: number }> {
  const generations = computeGenerations(assigned, marriageNodes);
  const assignedById = new Map(assigned.map((m) => [m.id, m]));

  const childrenOf: Map<string, FamilyMember[]> = new Map();
  for (const m of assigned) {
    if (!m.parentMarriageNode) continue;
    if (!childrenOf.has(m.parentMarriageNode)) childrenOf.set(m.parentMarriageNode, []);
    childrenOf.get(m.parentMarriageNode)!.push(m);
  }
  for (const [, children] of childrenOf) {
    children.sort((a, b) => a.birth - b.birth || a.nameAr.localeCompare(b.nameAr, "fa"));
  }

  const subtreeWidthCache = new Map<string, number>();

  function getSubtreeWidth(member: FamilyMember, ancestors = new Set<string>()): number {
    const cached = subtreeWidthCache.get(member.id);
    if (cached !== undefined) return cached;
    // Invalid ancestry data must not crash the entire tree with infinite recursion.
    if (ancestors.has(member.id)) return 1;

    const nextAncestors = new Set(ancestors);
    nextAncestors.add(member.id);
    const sideCount = sideSpouseIds(member, assignedById, marriageNodes).length;
    const unitSlots = 1 + sideCount;

    let totalChildSlots = 0;
    for (const mn of marriagesOf(member.id, marriageNodes)) {
      const children = childrenOf.get(mn.id) || [];
      if (children.length === 0) continue;
      totalChildSlots += children.reduce(
        (sum, child) => sum + getSubtreeWidth(child, nextAncestors),
        0,
      );
    }

    const width = Math.max(unitSlots, totalChildSlots || 0);
    subtreeWidthCache.set(member.id, width);
    return width;
  }

  const newPositions: Map<string, { x: number; y: number }> = new Map();
  const placed = new Set<string>();

  function rowY(memberId: string): number {
    return CANVAS_ORIGIN_Y + (generations.get(memberId) ?? 0) * GAP_Y;
  }

  function placeNode(member: FamilyMember, leftX: number) {
    if (placed.has(member.id)) return;

    // In-laws with a blood spouse are only placed beside that spouse
    if (isInLaw(member)) {
      const hasBloodSpouse = marriagesOf(member.id, marriageNodes).some((mn) => {
        const otherId = marriagePartnerId(mn, member.id);
        const other = otherId ? assignedById.get(otherId) : undefined;
        return Boolean(other && !isInLaw(other));
      });
      if (hasBloodSpouse) return;
    }

    placed.add(member.id);
    const y = rowY(member.id);
    newPositions.set(member.id, { x: leftX, y });

    // Collect marriages to layout (where this member is the "anchor")
    const marriagesToLayout: {
      mn: MarriageNode;
      partnerId: string | null;
      children: FamilyMember[];
      childWidths: number[];
      totalChildSlots: number;
    }[] = [];

    for (const mn of marriagesOf(member.id, marriageNodes)) {
      const partnerId = marriagePartnerId(mn, member.id);
      const partner = partnerId ? assignedById.get(partnerId) : undefined;

      // If partner is a blood member, only the husband anchors
      if (partner && !isInLaw(partner)) {
        const preferId = mn.husband && assignedById.has(mn.husband) ? mn.husband : member.id;
        if (member.id !== preferId) continue;
      }

      const children = childrenOf.get(mn.id) || [];
      const childWidths = children.map((c) => getSubtreeWidth(c));
      const totalChildSlots = childWidths.reduce((s, w) => s + w, 0);
      marriagesToLayout.push({ mn, partnerId, children, childWidths, totalChildSlots });
    }
    
    // Sort marriages so spouses appear in order of birth (oldest wife first)
    marriagesToLayout.sort((a, b) => {
      const aPartner = a.partnerId ? assignedById.get(a.partnerId) : undefined;
      const bPartner = b.partnerId ? assignedById.get(b.partnerId) : undefined;
      const aBirth = aPartner?.birth || 0;
      const bBirth = bPartner?.birth || 0;
      return aBirth - bBirth;
    });

    // Spouses are always placed RIGHT NEXT to each other (SLOT_W gap).
    // Children spread out below the marriage node, centered under the couple.
    //
    //    [Husband] ── [Wife1] ── [Wife2]
    //                   │
    //         ┌────┬────┼────┬────┐
    //        C1   C2   C3   C4   C5
    let spouseCursorX = leftX + SLOT_W;
    let minChildX = -Infinity;

    for (let mIdx = 0; mIdx < marriagesToLayout.length; mIdx++) {
      const marriage = marriagesToLayout[mIdx];
      const { partnerId, children, childWidths, totalChildSlots } = marriage;
      const partner = partnerId ? assignedById.get(partnerId) : undefined;
      const partnerIsInLaw = partner ? isInLaw(partner) : false;

      const childrenTotalWidth = totalChildSlots * SLOT_W;

      // If it's the second+ wife, ensure she is placed far enough to the right
      // so her children don't overlap with the previous wife's children,
      // AND she remains centered above her own children.
      if (mIdx > 0 && minChildX > -Infinity && children.length > 0) {
        const neededSpouseX = minChildX + childrenTotalWidth / 2 - CARD_W / 2;
        spouseCursorX = Math.max(spouseCursorX, neededSpouseX);
      } else if (mIdx > 0 && minChildX > -Infinity) {
        spouseCursorX = Math.max(spouseCursorX, minChildX);
      }

      // Always place spouse
      const spouseX = spouseCursorX;
      if (partnerIsInLaw && partnerId && !placed.has(partnerId)) {
        placed.add(partnerId);
        newPositions.set(partnerId, { x: spouseX, y });
      }

      if (children.length > 0) {
        // For the first marriage, center children between husband and wife.
        // For subsequent marriages, center children exactly under the wife.
        const coupleCenterX = mIdx === 0 ? (leftX + spouseX + CARD_W) / 2 : spouseX + CARD_W / 2;
        let childCursorX = coupleCenterX - childrenTotalWidth / 2;
        
        // Prevent overlap with children of the previous spouse (fallback)
        if (childCursorX < minChildX) {
          childCursorX = minChildX;
        }

        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          const childWidth = childWidths[i] * SLOT_W;
          placeNode(child, childCursorX);
          childCursorX += childWidth;
        }
        
        minChildX = childCursorX;
      } else {
        // If no children, the next item must at least clear this spouse
        minChildX = Math.max(minChildX, spouseX + SLOT_W);
      }

      spouseCursorX = spouseX + SLOT_W;
    }

    // Place any remaining side spouses not handled above
    const sideIds = sideSpouseIds(member, assignedById, marriageNodes);
    for (const spouseId of sideIds) {
      if (placed.has(spouseId)) continue;
      placed.add(spouseId);
      newPositions.set(spouseId, { x: spouseCursorX, y });
      spouseCursorX += SLOT_W;
    }
  }

  // Roots: no parents, and not an in-law of someone who has parents
  const founders = assigned
    .filter((m) => {
      if (m.parentMarriageNode) return false;
      const hasBloodSpouse = marriagesOf(m.id, marriageNodes).some((mn) => {
        const otherId = marriagePartnerId(mn, m.id);
        const other = otherId ? assignedById.get(otherId) : undefined;
        return Boolean(other && other.parentMarriageNode);
      });
      return !hasBloodSpouse;
    })
    .sort((a, b) => a.birth - b.birth || a.nameAr.localeCompare(b.nameAr, "fa"));

  const founderAnchors: FamilyMember[] = [];
  const skippedFounder = new Set<string>();
  for (const f of founders) {
    if (skippedFounder.has(f.id)) continue;
    for (const mn of marriagesOf(f.id, marriageNodes)) {
      const otherId = marriagePartnerId(mn, f.id);
      if (!otherId) continue;
      const other = assignedById.get(otherId);
      if (!other || other.parentMarriageNode) continue;
      if (mn.husband && mn.wife) {
        if (f.id === mn.wife) {
          skippedFounder.add(f.id);
        } else {
          skippedFounder.add(mn.wife);
        }
      }
    }
    if (!skippedFounder.has(f.id)) founderAnchors.push(f);
  }

  const founderSubtreeWidths = founderAnchors.map((f) => getSubtreeWidth(f));
  const totalFounderSlots = founderSubtreeWidths.reduce((s, w) => s + w, 0);
  const totalFounderWidth = Math.max(SLOT_W, totalFounderSlots * SLOT_W);

  let founderCursorX = originX - totalFounderWidth / 2;
  for (let i = 0; i < founderAnchors.length; i++) {
    const founder = founderAnchors[i];
    if (placed.has(founder.id)) continue;
    const founderWidth = founderSubtreeWidths[i] * SLOT_W;
    placeNode(founder, founderCursorX);
    founderCursorX += founderWidth;
  }

  let orphanX =
    Math.max(
      originX,
      ...[...newPositions.values()].map((p) => p.x + CARD_W),
      originX,
    ) + SLOT_W;
  for (const m of assigned) {
    if (newPositions.has(m.id)) continue;
    if (isInLaw(m)) {
      const mn = marriagesOf(m.id, marriageNodes).find((x) => {
        const otherId = marriagePartnerId(x, m.id);
        return otherId && newPositions.has(otherId);
      });
      if (mn) {
        const otherId = marriagePartnerId(mn, m.id)!;
        const otherPos = newPositions.get(otherId)!;
        newPositions.set(m.id, { x: otherPos.x + SLOT_W, y: otherPos.y });
        placed.add(m.id);
        continue;
      }
    }
    newPositions.set(m.id, { x: orphanX, y: rowY(m.id) });
    orphanX += SLOT_W;
  }

  // Per-row collision: never let cards overlap on the same generation
  const byRow = new Map<number, string[]>();
  for (const [id, pos] of newPositions) {
    const row = Math.round(pos.y);
    if (!byRow.has(row)) byRow.set(row, []);
    byRow.get(row)!.push(id);
  }
  for (const ids of byRow.values()) {
    ids.sort((a, b) => newPositions.get(a)!.x - newPositions.get(b)!.x);
    for (let i = 1; i < ids.length; i++) {
      const prev = newPositions.get(ids[i - 1])!;
      const cur = newPositions.get(ids[i])!;
      const minX = prev.x + SLOT_W;
      if (cur.x < minX) {
        newPositions.set(ids[i], { x: minX, y: cur.y });
      }
    }
  }

  return newPositions;
}

export function computeAutoLayout(
  members: FamilyMember[],
  marriageNodes: MarriageNode[],
): { members: FamilyMember[]; marriageNodes: MarriageNode[] } {
  const assigned = members.filter((m) => m.assigned);
  if (assigned.length === 0) return { members, marriageNodes };

  const components = getConnectedComponents(assigned, marriageNodes);
  const newPositions: Map<string, { x: number; y: number }> = new Map();

  let cursorRight = CANVAS_ORIGIN_X;
  for (let i = 0; i < components.length; i++) {
    const component = components[i];
    const originX =
      i === 0 ? CANVAS_ORIGIN_X : cursorRight + TREE_GAP + (component.length * SLOT_W) / 2;
    const positions = layoutComponent(component, marriageNodes, originX);
    for (const [id, pos] of positions) newPositions.set(id, pos);

    let maxX = originX;
    for (const pos of positions.values()) {
      maxX = Math.max(maxX, pos.x + CARD_W);
    }
    cursorRight = maxX;
  }

  const updatedMembers = members.map((m) => {
    const pos = newPositions.get(m.id);
    if (pos) {
      return { ...m, x: Math.round(pos.x), y: Math.round(pos.y), assigned: true };
    }
    return m;
  });

  const updatedMarriageNodes = marriageNodes.map((mn) => {
    const husb = updatedMembers.find((m) => m.id === mn.husband && m.assigned);
    const wf = updatedMembers.find((m) => m.id === mn.wife && m.assigned);
    if (husb && wf) {
      // Place the marriage node
      const rightSpouse = husb.x > wf.x ? husb : wf;
      const leftSpouse = husb.x <= wf.x ? husb : wf;
      
      const distance = Math.abs(husb.x - wf.x);
      let mnX;
      
      // If they are adjacent (distance <= SLOT_W + small margin)
      if (distance <= CARD_W + GAP_X + 10) {
        // Place at the midpoint between the two cards
        mnX = (leftSpouse.x + CARD_W + rightSpouse.x) / 2;
      } else {
        // They are far apart (polygamy, 2nd or 3rd wife)
        // Place the marriage node directly under the spouse on the right
        // (Because our layout always places spouses to the right of the blood member)
        mnX = rightSpouse.x + CARD_W / 2;
      }

      return {
        ...mn,
        x: Math.round(mnX),
        y: Math.round(Math.min(husb.y, wf.y) + CARD_H),
      };
    }
    if (husb) {
      return { ...mn, x: Math.round(husb.x + CARD_W / 2), y: Math.round(husb.y + CARD_H) };
    }
    if (wf) {
      return { ...mn, x: Math.round(wf.x + CARD_W / 2), y: Math.round(wf.y + CARD_H) };
    }
    return mn;
  });

  return { members: updatedMembers, marriageNodes: updatedMarriageNodes };
}

export function childConnectorPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  marriageIndex: number = 0,
): string {
  // Stagger the horizontal lines by up to 40px so different marriages don't overlap visually
  const stagger = (marriageIndex % 4) * 10;
  const midY = startY + Math.max(32, (endY - startY) * 0.35) + stagger;
  return `M ${startX} ${startY} V ${midY} H ${endX} V ${endY}`;
}

/** True when the member has no parent marriage and is not a spouse in any marriage. */
export function isUnlinkedIsolate(
  member: FamilyMember,
  marriageNodes: MarriageNode[],
): boolean {
  if (member.parentMarriageNode) return false;
  return !marriageNodes.some((mn) => mn.husband === member.id || mn.wife === member.id);
}
