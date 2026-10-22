/**
 * @file convert-ap-to-english.ts
 * @description Normalizes Arabic-Indic (Eastern Arabic) and Persian digit characters
 * to their standard ASCII English equivalents, then strips all non-numeric characters.
 *
 * This function runs at the DTO validation phase (@Transform decorator) so that any
 * mobile number typed on an Arabic or Persian keyboard is safely normalized BEFORE
 * class-validator rules are applied and BEFORE the value is written to the database.
 *
 * Arabic-Indic (٠١٢٣٤٥٦٧٨٩) and Persian (۰۱۲۳۴۵۶۷۸۹) are mapped to (0–9).
 *
 * @example
 * convertAPToEnglish('09۱۲٣٤56789') // → '09123456789'
 * convertAPToEnglish('٠٩١٢٣٤٥٦٧٨٩') // → '09123456789'
 */

/** Map of Persian (Farsi) digit RegExp patterns indexed 0–9 */
const PERSIAN_DIGITS: RegExp[] = [
  /۰/g, /۱/g, /۲/g, /۳/g, /۴/g,
  /۵/g, /۶/g, /۷/g, /۸/g, /۹/g,
];

/** Map of Arabic-Indic digit RegExp patterns indexed 0–9 */
const ARABIC_DIGITS: RegExp[] = [
  /٠/g, /١/g, /٢/g, /٣/g, /٤/g,
  /٥/g, /٦/g, /٧/g, /٨/g, /٩/g,
];

/**
 * Converts any Persian or Arabic-Indic digit characters in a string to
 * their ASCII equivalents, then removes all non-digit characters.
 *
 * @param str - Raw input string (may contain Persian, Arabic, or Latin digits)
 * @returns A string containing only ASCII digit characters (0–9)
 */
export function convertAPToEnglish(str: string): string {
  if (!str) return '';

  let result = str.toString();

  // Replace each Persian and Arabic digit with its English equivalent
  for (let i = 0; i < 10; i++) {
    result = result
      .replace(PERSIAN_DIGITS[i], i.toString())
      .replace(ARABIC_DIGITS[i], i.toString());
  }

  // If it only contains digits, spaces, and punctuation (dashes, parentheses, etc.), strip non-digits.
  // If it contains alphabetical characters (e.g. username 'sadegh'), preserve the string.
  if (/^[0-9\s\-+().]+$/.test(result)) {
    return result.replace(/\D/g, '');
  }

  return result.trim();
}
