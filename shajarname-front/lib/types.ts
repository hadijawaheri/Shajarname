export interface FamilyMember {
  id: string;
  nameAr: string;
  nameEn: string;
  mobile: string;
  birth: number;
  death: number | "living";
  gender: "m" | "f";
  privacy: boolean;
  bio: string;
  assigned: boolean;
  x: number;
  y: number;
  parentMarriageNode?: string;
  spouses?: string[];
  avatar?: string;
  photos?: string[];
  audioMemories?: { title: string; path: string }[];
}

export interface MarriageNode {
  id: string;
  husband: string;
  wife: string;
  x: number;
  y: number;
  isExplicit?: boolean;
}

export interface ApiMember {
  _id: string;
  name: string;
  lastName: string;
  mobile: string;
  gender: "male" | "female";
  birthday: string;
  deathday?: string;
  biography?: string;
  language?: "fa" | "ar";
  positionX: number;
  positionY: number;
  isOnCanvas: boolean;
  parentMarriageId?: string;
  privacyProtected?: boolean;
  avatar?: string;
  photos?: string[];
  audioMemories?: { title: string; path: string }[];
}

export interface ApiMarriage {
  _id: string;
  spouseA: string;
  spouseB: string;
  children?: string[];
}

function yearFromDate(dateStr?: string): number {
  if (!dateStr) return 2000;
  return new Date(dateStr).getFullYear();
}

function dateFromYear(year: number): string {
  return `${year}-01-01`;
}

export function apiMemberToFamily(
  m: ApiMember,
  genderMap: Map<string, "male" | "female">,
): FamilyMember {
  const deathYear = m.deathday ? yearFromDate(m.deathday) : null;
  return {
    id: m._id,
    nameAr: m.name,
    nameEn: m.lastName,
    mobile: m.mobile,
    birth: yearFromDate(m.birthday),
    death: deathYear && deathYear > 0 ? deathYear : "living",
    gender: m.gender === "male" ? "m" : "f",
    privacy: m.privacyProtected ?? false,
    bio: m.biography ?? "",
    assigned: m.isOnCanvas,
    x: m.positionX ?? 0,
    y: m.positionY ?? 0,
    parentMarriageNode: m.parentMarriageId || undefined,
    spouses: [],
    avatar: m.avatar,
    photos: m.photos ?? [],
    audioMemories: m.audioMemories ?? [],
  };
}

export function apiMarriageToNode(
  m: ApiMarriage,
  genderMap: Map<string, "male" | "female">,
): MarriageNode {
  const aId = typeof m.spouseA === "object" ? (m.spouseA as { _id: string })._id : m.spouseA;
  const bId = typeof m.spouseB === "object" ? (m.spouseB as { _id: string })._id : m.spouseB;
  const aGender = genderMap.get(aId);
  const bGender = genderMap.get(bId);

  let husband = "";
  let wife = "";
  if (aGender === "male") husband = aId;
  else if (aGender === "female") wife = aId;
  if (bGender === "male") husband = bId;
  else if (bGender === "female") wife = bId;

  return {
    id: m._id,
    husband,
    wife,
    x: 0,
    y: 0,
    isExplicit: true,
  };
}

export function familyMemberToCreateDto(
  member: Pick<
    FamilyMember,
    "nameAr" | "nameEn" | "mobile" | "birth" | "death" | "gender" | "privacy" | "bio"
  >,
  lang: "fa" | "ar",
  parentMarriageId?: string,
  isOnCanvas = true,
): Record<string, unknown> {
  return {
    name: member.nameAr,
    lastName: member.nameEn,
    nameEn: member.nameEn,
    mobile: member.mobile || undefined,
    gender: member.gender === "m" ? "male" : "female",
    birthday: dateFromYear(member.birth),
    deathday:
      member.death !== "living" ? dateFromYear(member.death as number) : undefined,
    biography: member.bio || undefined,
    language: lang === "ar" ? "ar" : "fa",
    privacyProtected: member.privacy,
    parentMarriageId: parentMarriageId || undefined,
    isOnCanvas,
  };
}

export function familyMemberToEditDto(
  member: Pick<
    FamilyMember,
    "nameAr" | "nameEn" | "mobile" | "birth" | "death" | "gender" | "privacy" | "bio"
  >,
  parentMarriageId?: string,
  isOnCanvas = true,
): Record<string, unknown> {
  return {
    name: member.nameAr,
    lastName: member.nameEn,
    mobile: member.mobile || undefined,
    gender: member.gender === "m" ? "male" : "female",
    birthday: dateFromYear(member.birth),
    deathday:
      member.death !== "living" ? dateFromYear(member.death as number) : undefined,
    biography: member.bio || undefined,
    privacyProtected: member.privacy,
    parentMarriageId: parentMarriageId ?? null,
    isOnCanvas,
  };
}

export function languageToEditDto(lang: "fa" | "ar"): Record<string, unknown> {
  return { language: lang };
}

export function buildTreeFromApi(
  apiMembers: ApiMember[],
  apiMarriages: ApiMarriage[],
): { members: FamilyMember[]; marriageNodes: MarriageNode[] } {
  const genderMap = new Map<string, "male" | "female">();
  for (const m of apiMembers) {
    genderMap.set(m._id, m.gender);
  }

  const members = apiMembers.map((m) => apiMemberToFamily(m, genderMap));
  const marriageNodes = apiMarriages.map((m) => apiMarriageToNode(m, genderMap));

  // Attach spouse lists
  const spouseMap = new Map<string, string[]>();
  for (const mn of marriageNodes) {
    if (mn.husband && mn.wife) {
      if (!spouseMap.has(mn.husband)) spouseMap.set(mn.husband, []);
      if (!spouseMap.has(mn.wife)) spouseMap.set(mn.wife, []);
      spouseMap.get(mn.husband)!.push(mn.wife);
      spouseMap.get(mn.wife)!.push(mn.husband);
    }
  }
  for (const m of members) {
    m.spouses = spouseMap.get(m.id) ?? [];
  }

  return { members, marriageNodes };
}
