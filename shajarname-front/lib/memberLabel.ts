import type { FamilyMember, MarriageNode } from "./types";

export type LabelLang = "fa" | "ar" | "en";

export interface MemberLabelContext {
  members: FamilyMember[];
  marriages: MarriageNode[];
}

function baseName(m: FamilyMember, lang: LabelLang): string {
  return lang === "en" ? m.nameEn : m.nameAr;
}

function fatherOf(
  m: FamilyMember,
  ctx: MemberLabelContext,
): FamilyMember | undefined {
  if (!m.parentMarriageNode) return undefined;
  const mn = ctx.marriages.find((x) => x.id === m.parentMarriageNode);
  if (!mn?.husband) return undefined;
  return ctx.members.find((x) => x.id === mn.husband);
}

function motherOf(
  m: FamilyMember,
  ctx: MemberLabelContext,
): FamilyMember | undefined {
  if (!m.parentMarriageNode) return undefined;
  const mn = ctx.marriages.find((x) => x.id === m.parentMarriageNode);
  if (!mn?.wife) return undefined;
  return ctx.members.find((x) => x.id === mn.wife);
}

/** Short given name for parent reference (first token of Arabic/Persian or English). */
function shortParentName(parent: FamilyMember, lang: LabelLang): string {
  const full = baseName(parent, lang).trim();
  if (!full) return "";
  // Prefer first word for long compound names
  const parts = full.split(/\s+/);
  if (lang === "en") return parts[0] || full;
  // For FA/AR keep first 1–2 tokens if name starts with title-like words
  if (parts.length >= 2 && /^(ال|مهندس|شیخ|حاج|السید)/i.test(parts[0])) {
    return parts.slice(0, 2).join(" ");
  }
  return parts[0] || full;
}

/**
 * Disambiguated member label for lists, selects, and cards.
 * When father is known: «نام · پسر/دختر پدر» (or EN equivalent).
 * Otherwise falls back to «نام (سال تولد)».
 */
export function formatMemberLabel(
  m: FamilyMember,
  lang: LabelLang,
  ctx: MemberLabelContext,
  opts?: { compact?: boolean },
): string {
  const name = baseName(m, lang);
  const father = fatherOf(m, ctx);
  if (father) {
    const dad = shortParentName(father, lang);
    if (lang === "en") {
      const rel = m.gender === "f" ? "d/o" : "s/o";
      return opts?.compact ? `${name} (${rel} ${dad})` : `${name} · ${rel} ${dad}`;
    }
    if (lang === "ar") {
      const rel = m.gender === "f" ? "بنت" : "ابن";
      return `${name} · ${rel} ${dad}`;
    }
    const rel = m.gender === "f" ? "دختر" : "پسر";
    return `${name} · ${rel} ${dad}`;
  }

  const mother = motherOf(m, ctx);
  if (mother) {
    const mom = shortParentName(mother, lang);
    if (lang === "en") return `${name} · child of ${mom}`;
    if (lang === "ar") return `${name} · ولد ${mom}`;
    return `${name} · فرزند ${mom}`;
  }

  return `${name} (${m.birth})`;
}

/** Primary display name without disambiguation (cards can show subtitle separately). */
export function formatMemberPrimaryName(m: FamilyMember, lang: LabelLang): string {
  return baseName(m, lang);
}

/** Subtitle under the card name: father line or lifespan year. */
export function formatMemberSubtitle(
  m: FamilyMember,
  lang: LabelLang,
  ctx: MemberLabelContext,
): string | null {
  const father = fatherOf(m, ctx);
  if (father) {
    const dad = shortParentName(father, lang);
    if (lang === "en") return m.gender === "f" ? `Daughter of ${dad}` : `Son of ${dad}`;
    if (lang === "ar") return m.gender === "f" ? `بنت ${dad}` : `ابن ${dad}`;
    return m.gender === "f" ? `دختر ${dad}` : `پسر ${dad}`;
  }
  return null;
}
