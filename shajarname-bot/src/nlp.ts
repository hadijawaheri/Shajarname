/**
 * Bilingual NLP parser for quick member registration.
 * Examples: "شیرین دختر محسن نجف" / "شیرین بنت محسن نجف"
 */

export interface ParsedMember {
  name: string;
  gender: "male" | "female";
  parentName: string;
  lang: "fa" | "ar";
}

const DAUGHTER_FA = /^(?:دختر|دخت)\s+/;
const SON_FA = /^(?:پسر|فرزند)\s+/;
const DAUGHTER_AR = /^(?:بنت|ابنة)\s+/;
const SON_AR = /^(?:ابن|ولد)\s+/;

export function parseMemberPhrase(text: string): ParsedMember | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Arabic pattern: NAME بنت/ابن PARENT
  const arMatch = trimmed.match(/^(.+?)\s+(بنت|ابنة|ابن|ولد)\s+(.+)$/);
  if (arMatch) {
    const [, name, rel, parent] = arMatch;
    const gender = rel === "بنت" || rel === "ابنة" ? "female" : "male";
    return { name: name.trim(), gender, parentName: parent.trim(), lang: "ar" };
  }

  // Persian pattern: NAME دختر/پسر PARENT
  const faMatch = trimmed.match(/^(.+?)\s+(دختر|دخت|پسر|فرزند)\s+(.+)$/);
  if (faMatch) {
    const [, name, rel, parent] = faMatch;
    const gender = rel === "دختر" || rel === "دخت" ? "female" : "male";
    return { name: name.trim(), gender, parentName: parent.trim(), lang: "fa" };
  }

  return null;
}
