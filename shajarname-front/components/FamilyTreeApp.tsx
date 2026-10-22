"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useExportDiagram } from "../hooks/useExportDiagram";

import LanguageWizard from "./LanguageWizard";
import LoginModal from "./LoginModal";
import ProfileSidebar from "./ProfileSidebar";
import KinshipPanel from "./KinshipPanel";
import MemberEditorForm from "./MemberEditorForm";
import MembersListModal, { type MembersListMode } from "./MembersListModal";
import ChangePasswordModal from "./ChangePasswordModal";
import { Button, Checkbox, Chip, CloseButton, Label, ListBox, Modal, Select, Slider } from "@heroui/react";
import PanelHeader from "./PanelHeader";
import ExportModalContent, { type ExportStyleType } from "./ExportModalContent";
import { buildHierarchyFromFamily } from "../lib/treeHierarchy";
import {
  generateSunburstSVG,
  generateMindmapSVG,
  exportCustomDiagram,
} from "../lib/exportGenerators";
import {
  fetchMembers,
  fetchMarriages,
  createMember,
  updateMember,
  deleteMember,
  createMarriage,
  deleteMarriage,
  addChildToMarriage,
  checkMahram,
  getRelationship,
  syncLayout,
  uploadAvatar,
  uploadGalleryPhoto,
  uploadAudioMemory,
  logoutApi,
  avatarUrl,
  AuthError,
} from "../lib/api";
import { getToken, getAuthUser, isAuthenticated, isAdmin, canEditTree, clearAuth } from "../lib/auth";
import { connectFamilySocket, disconnectFamilySocket, getHiddenByCollapse, type FamilySocketEvent } from "../lib/socket";
import { computeAutoLayout, CARD_W, CARD_H, childConnectorPath, isUnlinkedIsolate } from "../lib/layout";
import {
  type FamilyMember,
  type MarriageNode,
  buildTreeFromApi,
  familyMemberToCreateDto,
  familyMemberToEditDto,
  languageToEditDto,
} from "../lib/types";
import { formatMemberLabel, formatMemberPrimaryName } from "../lib/memberLabel";

interface TranslationStrings {
  brandTitle: string;
  brandSubtitle: string;
  btnAdd: string;
  btnExport: string;
  sidebarTitle: string;
  sidebarDesc: string;
  sidebarBtnAdd: string;
  timelineLabel: string;
  timelineInstruction: string;
  timelineCurrent: string;
  statTotalLabel: string;
  statDeceasedLabel: string;
  statRatioLabel: string;
  modalTitleEdit: string;
  modalTitleNew: string;
  lblNameAr: string;
  lblNameEn: string;
  lblBirth: string;
  lblDeath: string;
  lblGender: string;
  lblPrivacyOpt: string;
  lblBio: string;
  lblSpouses: string;
  btnCancel: string;
  btnSave: string;
  btnDelete: string;
  toastUpdate: string;
  toastPlaced: string;
  toastDeleted: string;
  exportTitle: string;
  exportDesc: string;
  exportLblScale: string;
  exportLblGrid: string;
  exportBtnSubmit: string;
  exportProgress: string;
  exportSuccess: string;
  male: string;
  female: string;
  lblGenderMale: string;
  lblGenderFemale: string;
  lblPrivacyActive: string;
  lblPrivacyInactive: string;
  lblFather: string;
  lblMother: string;
  lblNoFather: string;
  lblNoMother: string;
  lblMobile: string;
  sidebarKinship: string;
  sidebarGuide: string;
  sidebarViewer: string;
  viewAsHint: string;
  viewAsNeedLogin: string;
  viewAsNeedShield: string;
  roleAdmin: string;
  roleEditor: string;
  roleViewMode: string;
  lifeFilterAll: string;
  lifeFilterAlive: string;
  lifeFilterDeceased: string;
  profileTitle: string;
  profileBio: string;
  profileGender: string;
  profileMobile: string;
  profileMahram: string;
  profileMahramYes: string;
  profileMahramNo: string;
  profileRelation: string;
  profileEdit: string;
  profileAddChild: string;
  profileAlive: string;
  profileDeceased: string;
  kinshipTitle: string;
  kinshipPersonA: string;
  kinshipPersonB: string;
  kinshipCalculate: string;
  kinshipResult: string;
  kinshipSelect: string;
  errorSave: string;
  errorLoad: string;
  exportFormatPng: string;
  exportFormatPdf: string;
  btnLogin: string;
  btnLogout: string;
  lblAvatar: string;
  btnCollapse: string;
  btnExpand: string;
  lblGallery: string;
  lblAudio: string;
  lblAudioTitle: string;
  lblServerPdf: string;
  msgMemberReadonly: string;
  poolTitle: string;
  poolEmpty: string;
  poolAddToTree: string;
  poolRemoveFromTree: string;
  membersListTitle: string;
  membersListEmpty: string;
  openPoolList: string;
  openMembersList: string;
  toastQueued: string;
  toastAddedToTree: string;
  toastMovedToPool: string;
}

// ─── Translations ─────────────────────────────────────────────────────────────

const translationDict: Record<string, TranslationStrings> = {
  ar: {
    brandTitle: "خاندان نجف",
    brandSubtitle: "شجرة العائلة اللامتناهية",
    btnAdd: "إضافة عضو",
    btnExport: "تصدير عالي الدقة",
    sidebarTitle: "أدوات الشجرة",
    sidebarDesc: "افتح قوائم الأعضاء والانتظار، أو احسب صلة القرابة.",
    sidebarBtnAdd: "إنشاء عضو جديد",
    timelineLabel: "رحلة عبر الزمن",
    timelineInstruction: "اسحب لتصفية ورؤية أعضاء العائلة الذين كانوا على قيد الحياة في تلك السنة.",
    timelineCurrent: "اليوم",
    statTotalLabel: "إجمالي الأعضاء",
    statDeceasedLabel: "المتوفين",
    statRatioLabel: "ذكور / إناث",
    modalTitleEdit: "تعديل تفاصيل العائلة",
    modalTitleNew: "إضافة عضو جديد للشجرة",
    lblNameAr: "الاسم بالكامل (عربي/فارسي)",
    lblNameEn: "Full Name (English)",
    lblBirth: "سنة الميلاد",
    lblDeath: "سنة الوفاة (اترك فارغاً إذا كان حياً)",
    lblGender: "الجنس",
    lblPrivacyOpt: "خصوصية عالية (تعتيم مخصص)",
    lblBio: "معلومات قصيرة أو ألقاب",
    lblSpouses: "الزوج / الزوجات",
    btnCancel: "إلغاء",
    btnSave: "حفظ البيانات",
    btnDelete: "حذف العضو",
    toastUpdate: "تم حفظ التغييرات بنجاح!",
    toastPlaced: "تم وضع العضو على اللوحة!",
    toastQueued: "تم حفظ العضو في القائمة الجانبية (بدون أب/أم).",
    toastAddedToTree: "أُضيف العضو بجانب الشجرة على اللوحة.",
    toastMovedToPool: "نُقل العضو إلى القائمة الجانبية.",
    toastDeleted: "تمت إزالة العضو من العائلة.",
    poolTitle: "أعضاء بلا ارتباط",
    poolEmpty: "لا يوجد أعضاء في القائمة.",
    poolAddToTree: "إضافة إلى الشجرة",
    poolRemoveFromTree: "نقل إلى القائمة",
    membersListTitle: "أعضاء الشجرة",
    membersListEmpty: "لا يوجد أعضاء بهذا الفلتر.",
    openPoolList: "فتح قائمة بلا ارتباط",
    openMembersList: "فتح قائمة الأعضاء",
    exportTitle: "تصدير لوحة الشجرة العائلية",
    exportDesc: "قم بإعداد مخطط شجرة خاندان نجف جاهزًا للطباعة فائقة الدقة.",
    exportLblScale: "مقياس الدقة والتحجيم",
    exportLblGrid: "تضمين شبكة الخلفية المنقطة",
    exportBtnSubmit: "تحميل المخطط المتكامل",
    exportProgress: "جاري توليد ملفات الشجرة عالية الدقة...",
    exportSuccess: "تم تنزيل الشجرة بنجاح كصورة PNG عالية الدقة!",
    male: "ذكر",
    female: "أنثى",
    lblGenderMale: "ذكر (Male)",
    lblGenderFemale: "أنثى (Female)",
    lblPrivacyActive: "تفعيل التعتيم",
    lblPrivacyInactive: "عدم تفعيل التعتيم",
    lblFather: "الأب",
    lblMother: "الأم",
    lblNoFather: "لا يوجد (بدون أب)",
    lblNoMother: "لا يوجد (بدون أم)",
    lblMobile: "رقم الجوال",
    sidebarKinship: "حاسبة القرابة",
    sidebarGuide: "دليل الاستخدام",
    sidebarViewer: "منظور المحرمية",
    viewAsHint: "اختر شخصاً لحساب «نسبتك» وتغبيش غير المحارم بالنسبة له. ليس لإدارة الأعضاء.",
    viewAsNeedLogin: "سجّل الدخول لتفعيل منظور المحرمية",
    viewAsNeedShield: "فعّل درع الخصوصية لرؤية التغبيش",
    roleAdmin: "مدير",
    roleEditor: "محرر",
    roleViewMode: "وضع المشاهدة",
    lifeFilterAll: "الكل",
    lifeFilterAlive: "على قيد الحياة",
    lifeFilterDeceased: "المتوفون",
    profileTitle: "ملف العضو",
    profileBio: "نبذة",
    profileGender: "الجنس",
    profileMobile: "الجوال",
    profileMahram: "حالة المحارم",
    profileMahramYes: "محرم",
    profileMahramNo: "غير محرم",
    profileRelation: "نسبته إليك",
    profileEdit: "تعديل",
    profileAddChild: "إضافة طفل",
    profileAlive: "على قيد الحياة",
    profileDeceased: "وفاة",
    kinshipTitle: "حاسبة القرابة العائلية",
    kinshipPersonA: "الشخص الأول",
    kinshipPersonB: "الشخص الثاني",
    kinshipCalculate: "احسب النسبة",
    kinshipResult: "النتيجة",
    kinshipSelect: "اختر عضواً",
    errorSave: "خطأ في حفظ البيانات",
    errorLoad: "خطأ في تحميل البيانات",
    exportFormatPng: "PNG",
    exportFormatPdf: "PDF",
    btnLogin: "دخول",
    btnLogout: "خروج",
    lblAvatar: "صورة العضو",
    btnCollapse: "طي الفرع",
    btnExpand: "توسيع الفرع",
    lblGallery: "معرض الصور",
    lblAudio: "ذكريات صوتية",
    lblAudioTitle: "عنوان الذكرى",
    lblServerPdf: "PDF احترافي (خادم)",
    msgMemberReadonly: "وضع القراءة فقط — لا يمكنك التعديل",
  },
  fa: {
    brandTitle: "خاندان نجف",
    brandSubtitle: "شجره‌نامه بی‌کران",
    btnAdd: "افزودن عضو",
    btnExport: "خروجی باکیفیت",
    sidebarTitle: "ابزارهای شجره‌نامه",
    sidebarDesc: "فهرست اعضا و لیست انتظار را باز کنید، یا نسبت خانوادگی را بسنجید.",
    sidebarBtnAdd: "ایجاد عضو جدید",
    timelineLabel: "سفر در زمان",
    timelineInstruction: "برای فیلتر و دیدن افرادی که در آن سال زنده بودند، خط زمانی را حرکت دهید.",
    timelineCurrent: "امروز",
    statTotalLabel: "کل اعضا",
    statDeceasedLabel: "درگذشته",
    statRatioLabel: "مرد / زن",
    modalTitleEdit: "ویرایش اطلاعات خانواده",
    modalTitleNew: "افزودن عضو جدید به شجره‌نامه",
    lblNameAr: "نام کامل (عربی/فارسی)",
    lblNameEn: "Full Name (English)",
    lblBirth: "سال تولد",
    lblDeath: "سال فوت (اگر در قید حیات است خالی بگذارید)",
    lblGender: "جنسیت",
    lblPrivacyOpt: "حریم خصوصی پیشرفته (تاری چهره)",
    lblBio: "توضیحات کوتاه یا القاب",
    lblSpouses: "همسر / همسران",
    btnCancel: "انصراف",
    btnSave: "ذخیره تغییرات",
    btnDelete: "حذف عضو",
    toastUpdate: "تغییرات با موفقیت ذخیره شد!",
    toastPlaced: "عضو با موفقیت روی بوم قرار گرفت!",
    toastQueued: "عضو در لیست کناری ذخیره شد (بدون پدر/مادر).",
    toastAddedToTree: "عضو کنار درخت روی بوم اضافه شد.",
    toastMovedToPool: "عضو به لیست کناری منتقل شد.",
    toastDeleted: "عضو از شجره‌نامه حذف گردید.",
    poolTitle: "اعضای بدون ارتباط",
    poolEmpty: "عضوی در لیست نیست.",
    poolAddToTree: "افزودن به درخت",
    poolRemoveFromTree: "انتقال به لیست",
    membersListTitle: "اعضای درخت",
    membersListEmpty: "عضوی با این فیلتر یافت نشد.",
    openPoolList: "باز کردن لیست بدون ارتباط",
    openMembersList: "باز کردن فهرست اعضا",
    exportTitle: "خروجی گرفتن از شجره‌نامه",
    exportDesc: "چاپ شجره‌نامه خاندان نجف با بالاترین رزولوشن ممکن.",
    exportLblScale: "مقیاس رزولوشن و چاپ",
    exportLblGrid: "خروجی همراه با نقاط پس‌زمینه بوم",
    exportBtnSubmit: "دانلود نسخه کامل چاپی",
    exportProgress: "در حال تولید فایل‌های متنی و برداری شجره‌نامه...",
    exportSuccess: "شجره‌نامه با موفقیت به‌صورت PNG باکیفیت دانلود شد!",
    male: "مرد",
    female: "زن",
    lblGenderMale: "مرد (Male)",
    lblGenderFemale: "زن (Female)",
    lblPrivacyActive: "تار کردن چهره (فعال)",
    lblPrivacyInactive: "تار کردن چهره (غیرفعال)",
    lblFather: "پدر",
    lblMother: "مادر",
    lblNoFather: "هیچ‌کدام (بدون پدر)",
    lblNoMother: "هیچ‌کدام (بدون مادر)",
    lblMobile: "شماره موبایل",
    sidebarKinship: "نسبت‌سنج",
    sidebarGuide: "راهنمای استفاده",
    sidebarViewer: "دیدگاه محرمیت",
    viewAsHint: "فردی را انتخاب کنید تا «نسبت با شما» و تار شدن نامحرم‌ها نسبت به او محاسبه شود. برای مدیریت اعضا نیست.",
    viewAsNeedLogin: "برای فعال شدن محرمیت وارد شوید",
    viewAsNeedShield: "سپر حریم خصوصی را روشن کنید تا تار شدن دیده شود",
    roleAdmin: "ادمین",
    roleEditor: "ویرایشگر",
    roleViewMode: "حالت مشاهده",
    lifeFilterAll: "همه",
    lifeFilterAlive: "در قید حیات",
    lifeFilterDeceased: "درگذشته",
    profileTitle: "پروفایل عضو",
    profileBio: "بیوگرافی",
    profileGender: "جنسیت",
    profileMobile: "موبایل",
    profileMahram: "وضعیت محرمیت",
    profileMahramYes: "محرم",
    profileMahramNo: "نامحرم",
    profileRelation: "نسبت با شما",
    profileEdit: "ویرایش",
    profileAddChild: "افزودن فرزند",
    profileAlive: "در قید حیات",
    profileDeceased: "وفات",
    kinshipTitle: "نسبت‌سنج خانوادگی",
    kinshipPersonA: "شخص اول",
    kinshipPersonB: "شخص دوم",
    kinshipCalculate: "محاسبه نسبت",
    kinshipResult: "نتیجه",
    kinshipSelect: "انتخاب عضو",
    errorSave: "خطا در ذخیره اطلاعات",
    errorLoad: "خطا در بارگذاری داده‌ها",
    exportFormatPng: "PNG",
    exportFormatPdf: "PDF",
    btnLogin: "ورود",
    btnLogout: "خروج",
    lblAvatar: "تصویر عضو",
    btnCollapse: "جمع کردن شاخه",
    btnExpand: "باز کردن شاخه",
    lblGallery: "گالری تصاویر",
    lblAudio: "خاطرات صوتی",
    lblAudioTitle: "عنوان خاطره",
    lblServerPdf: "PDF حرفه‌ای (سرور)",
    msgMemberReadonly: "حالت فقط مشاهده — امکان ویرایش ندارید",
  },
  en: {
    brandTitle: "Khandan Najaf",
    brandSubtitle: "Infinite Family Tree Canvas",
    btnAdd: "Add Member",
    btnExport: "High-Scale Export",
    sidebarTitle: "Tree Tools",
    sidebarDesc: "Open member lists, place waiting people, or calculate kinship.",
    sidebarBtnAdd: "Create New Member",
    timelineLabel: "Historical Time Travel",
    timelineInstruction: "Drag to filter and see which ancestors were alive during that year.",
    timelineCurrent: "Today",
    statTotalLabel: "Total Members",
    statDeceasedLabel: "Deceased",
    statRatioLabel: "Male / Female",
    modalTitleEdit: "Edit Family Details",
    modalTitleNew: "Add New Member to Tree",
    lblNameAr: "Full Name (Arabic/Persian)",
    lblNameEn: "Full Name (English)",
    lblBirth: "Year of Birth",
    lblDeath: "Year of Death (Leave empty if living)",
    lblGender: "Gender",
    lblPrivacyOpt: "High Privacy (Avatar Blur)",
    lblBio: "Short Bio or Titles",
    lblSpouses: "Spouse(s)",
    btnCancel: "Cancel",
    btnSave: "Save Details",
    btnDelete: "Delete Member",
    toastUpdate: "Details successfully saved!",
    toastPlaced: "Member placed on the canvas!",
    toastQueued: "Member saved to the side list (no parents).",
    toastAddedToTree: "Member placed beside the tree on the canvas.",
    toastMovedToPool: "Member moved to the side list.",
    toastDeleted: "Member removed from genealogy.",
    exportTitle: "Export Genealogy Chart",
    exportDesc: "Prepare Khandan Najaf master tree ready for high-precision large scale printing.",
    exportLblScale: "Resolution and Scaling",
    exportLblGrid: "Include Canvas Dotted Grid",
    exportBtnSubmit: "Download Master High-Scale Chart",
    exportProgress: "Assembling high-res vector and typographic layouts...",
    exportSuccess: "Genealogy Chart downloaded successfully!",
    male: "Male",
    female: "Female",
    lblGenderMale: "Male",
    lblGenderFemale: "Female",
    lblPrivacyActive: "Enable Blur",
    lblPrivacyInactive: "Disable Blur",
    lblFather: "Father",
    lblMother: "Mother",
    lblNoFather: "None (No Father)",
    lblNoMother: "None (No Mother)",
    lblMobile: "Mobile Number",
    sidebarKinship: "Kinship Calculator",
    sidebarGuide: "User Guide",
    sidebarViewer: "Mahram View",
    viewAsHint: "Pick a person to compute relation-to-you and blur non-mahram faces relative to them. Not for member admin.",
    viewAsNeedLogin: "Sign in to enable mahram perspective",
    viewAsNeedShield: "Turn on the privacy shield to see blurring",
    roleAdmin: "Admin",
    roleEditor: "Editor",
    roleViewMode: "View only",
    lifeFilterAll: "All",
    lifeFilterAlive: "Living",
    lifeFilterDeceased: "Deceased",
    profileTitle: "Member Profile",
    profileBio: "Biography",
    profileGender: "Gender",
    profileMobile: "Mobile",
    profileMahram: "Mahram Status",
    profileMahramYes: "Mahram",
    profileMahramNo: "Non-Mahram",
    profileRelation: "Relation to You",
    profileEdit: "Edit",
    profileAddChild: "Add Child",
    profileAlive: "Living",
    profileDeceased: "Deceased",
    kinshipTitle: "Family Kinship Calculator",
    kinshipPersonA: "Person A",
    kinshipPersonB: "Person B",
    kinshipCalculate: "Calculate",
    kinshipResult: "Result",
    kinshipSelect: "Select member",
    errorSave: "Error saving data",
    errorLoad: "Error loading data",
    exportFormatPng: "PNG",
    exportFormatPdf: "PDF",
    btnLogin: "Login",
    btnLogout: "Logout",
    lblAvatar: "Avatar Photo",
    btnCollapse: "Collapse branch",
    btnExpand: "Expand branch",
    lblGallery: "Photo Gallery",
    lblAudio: "Audio Memories",
    lblAudioTitle: "Memory Title",
    lblServerPdf: "Pro PDF (Server)",
    msgMemberReadonly: "Read-only mode — you cannot edit",
    poolTitle: "Unlinked members",
    poolEmpty: "No members in the list.",
    poolAddToTree: "Add to tree",
    poolRemoveFromTree: "Move to list",
    membersListTitle: "Tree members",
    membersListEmpty: "No members match this filter.",
    openPoolList: "Open unlinked list",
    openMembersList: "Open members list",
  },
};

// Layout engine: see lib/layout.ts

// ─── Time-Travel Helpers ──────────────────────────────────────────────────────
//
// The Timeline Simulator allows the user to drag a year slider and see which
// family members were alive in that year. Three visibility states exist:
//
//   ALIVE     (birth <= year AND (death === 'living' OR death >= year))
//             → Full opacity, clickable, full color.
//
//   DECEASED  (born before year BUT death < year)
//             → 62% opacity + grayscale(70%). The card remains visible to
//               preserve the "skeleton" of the tree. Pointer events disabled.
//
//   NOT BORN  (birth > year)
//             → opacity: 0. Fully invisible. Pointer events disabled.
//               SVG lines leading to this member are also hidden (return null).
//
// The distinction between DECEASED and NOT BORN is critical: hiding deceased
// members would create gaps and disconnected trees. Keeping them at 62%
// opacity lets the user understand the family structure across all eras.

/**
 * Returns `true` if a member existed in the given year.
 * A member "exists" if they were already born AND not yet deceased.
 *
 * Formula: `birth <= year && (death === 'living' || death >= year)`
 *
 * @param member - FamilyMember to evaluate
 * @param year - The currently selected year on the time-travel slider
 */
function isAliveInYear(member: FamilyMember, year: number): boolean {
  if (member.birth > year) return false;
  if (member.death !== "living" && (member.death as number) < year) return false;
  return true;
}

/**
 * Returns `true` if the member has been born by the given year.
 * Used to distinguish "NOT YET BORN" (hide completely) from "DECEASED" (dim).
 *
 * @param member - FamilyMember to evaluate
 * @param year - The currently selected year on the time-travel slider
 */
function wasEverBorn(member: FamilyMember, year: number): boolean {
  if (!Number.isFinite(member.birth)) return true;
  return member.birth <= year;
}

/**
 * Computes the CSS visibility properties for a member card in a given year.
 *
 * Returns an object containing:
 *  - `opacity`       — 1 (alive), 0.62 (deceased), or 0 (not yet born)
 *  - `filter`        — CSS filter string (grayscale for deceased, 'none' otherwise)
 *  - `pointerEvents` — 'auto' (alive) or 'none' (deceased / not born)
 *
 * @param member - FamilyMember to evaluate
 * @param year - The currently selected year on the time-travel slider
 */
function getMemberVisibility(
  member: FamilyMember,
  year: number
): { opacity: number; filter: string; pointerEvents: string } {
  if (!wasEverBorn(member, year)) {
    // NOT BORN: fully invisible, no pointer events
    return { opacity: 0, filter: "none", pointerEvents: "none" };
  }
  if (!isAliveInYear(member, year)) {
    // DECEASED: user requested they remain fully opaque and selectable
    return { opacity: 1, filter: "grayscale(70%)", pointerEvents: "auto" };
  }
  // ALIVE: full visibility
  return { opacity: 1, filter: "none", pointerEvents: "auto" };
}

// ─── Component ────────────────────────────────────────────────────────────────


export interface FamilyTreeAppProps {
  adminMode?: boolean;
}

export default function FamilyTreeApp({ adminMode = false }: FamilyTreeAppProps) {
  const router = useRouter();
  // Loader
  const [isLoaderVisible, setIsLoaderVisible] = useState(true);

  // Language & Direction
  const [currentLang, setCurrentLang] = useState<"fa" | "ar" | "en">("fa");
  const [showLangWizard, setShowLangWizard] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [userIsAdmin, setUserIsAdmin] = useState(false);
  const [userCanEdit, setUserCanEdit] = useState(false);
  const [isMemberRole, setIsMemberRole] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const effectiveCanEdit = adminMode && userCanEdit;
  const effectiveIsAdmin = adminMode && userIsAdmin;

  // Branch collapse
  const [collapsedMarriages, setCollapsedMarriages] = useState<Set<string>>(new Set());

  // Privacy Protection
  const [privacyShieldActive, setPrivacyShieldActive] = useState(true);
  const [activeViewerId, setActiveViewerId] = useState<string>("");
  const [mahramCache, setMahramCache] = useState<Record<string, boolean>>({});

  // API state
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Profile & Kinship
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [profileMahram, setProfileMahram] = useState<boolean | null>(null);
  const [profileRelation, setProfileRelation] = useState<string | null>(null);
  const [isKinshipOpen, setIsKinshipOpen] = useState(false);

  // Life status filter
  const [lifeFilter, setLifeFilter] = useState<"all" | "alive" | "deceased">("all");

  // ── Family State ─────────────────────────────────────────────────────────
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);

  const [marriageNodes, setMarriageNodes] = useState<MarriageNode[]>([]);

  // Trigger layout recompute
  const [treeRevision, setTreeRevision] = useState(0);

  // ── Auto-Layout (useMemo) ─────────────────────────────────────────────────
  const { layoutMembers, layoutMarriageNodes } = useMemo(() => {
    try {
      const result = computeAutoLayout(familyMembers, marriageNodes);
      return {
        layoutMembers: result.members,
        layoutMarriageNodes: result.marriageNodes,
      };
    } catch {
      return {
        layoutMembers: familyMembers.map((m, i) => ({
          ...m,
          assigned: true,
          x: 2200 + (i % 5) * 266,
          y: 1800 + Math.floor(i / 5) * 240,
        })),
        layoutMarriageNodes: marriageNodes,
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyMembers, marriageNodes, treeRevision]);

  const hiddenByCollapse = useMemo(
    () => getHiddenByCollapse(collapsedMarriages, layoutMembers, layoutMarriageNodes),
    [collapsedMarriages, layoutMembers, layoutMarriageNodes],
  );

  const membersMap = useMemo(
    () => new Map(layoutMembers.map((m) => [m.id, m])),
    [layoutMembers],
  );

  const marriageMap = useMemo(
    () => new Map(layoutMarriageNodes.map((mn) => [mn.id, mn])),
    [layoutMarriageNodes],
  );

  const toggleMarriageCollapse = (marriageId: string) => {
    setCollapsedMarriages((prev) => {
      const next = new Set(prev);
      if (next.has(marriageId)) next.delete(marriageId);
      else next.add(marriageId);
      return next;
    });
  };

  // ── Canvas Transforms ─────────────────────────────────────────────────────
  const [scale, setScale] = useState(1.0);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [activeYear, setActiveYear] = useState(() => new Date().getFullYear());
  const [isTimelineExpanded, setIsTimelineExpanded] = useState(false);

  // Zen Mode
  const [isZenMode, setIsZenMode] = useState(false);
  const [isNavbarHidden, setIsNavbarHidden] = useState(false);
  const [isSidebarHidden, setIsSidebarHidden] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 1024;
    }
    return false;
  });
  const [isMobileToolsOpen, setIsMobileToolsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isFooterHidden, setIsFooterHidden] = useState(false);

  // Canvas dragging & touch gesture refs
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const panRef = useRef({ x: panX, y: panY });
  const scaleRef = useRef(scale);
  const dragStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    panRef.current = { x: panX, y: panY };
  }, [panX, panY]);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  // ── Modals ────────────────────────────────────────────────────────────────
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  /** Quick-delete from canvas card (separate from editor modal confirm). */
  const [cardDeleteId, setCardDeleteId] = useState<string | null>(null);
  const [listModalMode, setListModalMode] = useState<MembersListMode | null>(null);
  const [parentMarriageId, setParentMarriageId] = useState<string | undefined>(undefined);

  // Form fields
  const [inpNameAr, setInpNameAr] = useState("");
  const [inpNameEn, setInpNameEn] = useState("");
  const [inpBirth, setInpBirth] = useState<number>(2000);
  const [inpDeath, setInpDeath] = useState("");
  const [inpGender, setInpGender] = useState<"m" | "f">("m");
  const [inpPrivacy, setInpPrivacy] = useState(false);
  const [inpBio, setInpBio] = useState("");
  const [inpMobile, setInpMobile] = useState("");
  const [inpAvatarFile, setInpAvatarFile] = useState<File | null>(null);
  const [inpAvatarDeleted, setInpAvatarDeleted] = useState(false);
  const [inpGalleryDeleted, setInpGalleryDeleted] = useState(false);
  const [inpGalleryFile, setInpGalleryFile] = useState<File | null>(null);
  const [inpAudioFile, setInpAudioFile] = useState<File | null>(null);
  const [inpAudioTitle, setInpAudioTitle] = useState("");
  const [inpSpouses, setInpSpouses] = useState<string[]>([]);
  const inpSpousesRef = useRef<string[]>([]);
  const setSpousesSafe = (ids: string[]) => {
    inpSpousesRef.current = ids;
    setInpSpouses(ids);
  };
  const [inpFatherId, setInpFatherId] = useState("");
  const [inpMotherId, setInpMotherId] = useState("");

  // Export Modal
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportStyle, setExportStyle] = useState<ExportStyleType>("sunburst");
  const [exportScale, setExportScale] = useState<number>(1);
  const [exportFormat, setExportFormat] = useState<"png" | "pdf">("png");
  const [exportGrid, setExportGrid] = useState(true);
  const [customExporting, setCustomExporting] = useState(false);
  const [customExportProgress, setCustomExportProgress] = useState(0);

  const exportHierarchy = useMemo(() => {
    return buildHierarchyFromFamily(familyMembers, marriageNodes);
  }, [familyMembers, marriageNodes]);
  


  // Toast
  const [toastMessage, setToastMessage] = useState("");
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const [isSaving, setIsSaving] = useState(false);

  // Refs
  const canvasRef = useRef<HTMLDivElement>(null);
  const { exportToPNG, exportToPDF, isExporting, exportProgress } = useExportDiagram(canvasRef);
  const viewportRef = useRef<HTMLDivElement>(null);
  const hasDraggedRef = useRef(false);
  const loadDataBusyRef = useRef(false);
  /** If loadData is called while busy, run once more after the in-flight fetch. */
  const loadDataQueuedRef = useRef(false);
  /** Skip socket-driven reloads while a create/update mutation is in progress. */
  const isSavingRef = useRef(false);
  const activeViewerIdRef = useRef(activeViewerId);

  useEffect(() => {
    activeViewerIdRef.current = activeViewerId;
  }, [activeViewerId]);

  // ── Loader ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaderVisible(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  // ── Language wizard (first visit) ─────────────────────────────────────────
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedLang = localStorage.getItem("khandan_lang");
      const authenticated = isAuthenticated();
      if (savedLang === "fa" || savedLang === "ar") {
        setCurrentLang(savedLang);
        if (!authenticated) setShowLogin(true);
      } else {
        setShowLangWizard(true);
      }
      setLoggedIn(authenticated);
      setUserIsAdmin(isAdmin());
      setUserCanEdit(canEditTree());
      const user = getAuthUser();
      if (user) {
        const memberOnly = user.role === "member";
        setIsMemberRole(memberOnly);
        if (memberOnly && user.id) {
          setActiveViewerId(user.id);
          localStorage.setItem("khandan_viewer_id", user.id);
        } else {
          const savedViewer = localStorage.getItem("khandan_viewer_id");
          if (savedViewer) setActiveViewerId(savedViewer);
        }
        if (user.mustChangePassword) {
          setShowChangePassword(true);
        }
      } else {
        const savedViewer = localStorage.getItem("khandan_viewer_id");
        if (savedViewer) setActiveViewerId(savedViewer);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const persistLanguage = async (lang: "fa" | "ar") => {
    const user = getAuthUser();
    if (user?.id) {
      await updateMember(user.id, languageToEditDto(lang)).catch(() => {});
    }
  };

  const handleLangSelect = async (lang: "fa" | "ar") => {
    setCurrentLang(lang);
    localStorage.setItem("khandan_lang", lang);
    setShowLangWizard(false);
    await persistLanguage(lang);
    if (!isAuthenticated()) setShowLogin(true);
  };

  const handleLogout = async () => {
    await logoutApi();
    setLoggedIn(false);
    setUserIsAdmin(false);
    setUserCanEdit(false);
    window.location.href = "/";
  };

  // ── Auth expiry → force re-login ──────────────────────────────────────────
  useEffect(() => {
    const onExpired = () => {
      setLoggedIn(false);
      setUserIsAdmin(false);
    setUserCanEdit(false);
      setShowLogin(true);
      showToast(
        currentLang === "fa"
          ? "نشست شما منقضی شد. دوباره وارد شوید."
          : currentLang === "ar"
          ? "انتهت جلستك. يرجى تسجيل الدخول مجدداً."
          : "Session expired. Please sign in again.",
      );
    };
    window.addEventListener("khandan:auth-expired", onExpired);
    return () => window.removeEventListener("khandan:auth-expired", onExpired);
  }, [currentLang]);

  // ── Load data from API ────────────────────────────────────────────────────
  const loadData = async () => {
    if (!isAuthenticated()) {
      setIsLoadingData(false);
      return;
    }
    if (loadDataBusyRef.current) {
      // A create+marriage flow often triggers socket reload mid-save; queue a
      // follow-up so the final tree includes the new marriage (not a stale fetch).
      loadDataQueuedRef.current = true;
      return;
    }
    loadDataBusyRef.current = true;
    setIsLoadingData(true);
    setApiError(null);
    try {
      const [apiMembers, apiMarriages] = await Promise.all([
        fetchMembers(),
        fetchMarriages(),
      ]);
      const tree = buildTreeFromApi(apiMembers, apiMarriages);
      // Respect isOnCanvas — unlinked members stay in the side pool
      const laid = computeAutoLayout(tree.members, tree.marriageNodes);
      setFamilyMembers(laid.members);
      setMarriageNodes(laid.marriageNodes);
      setTreeRevision((r) => r + 1);

      const positions = laid.members
        .filter((m) => m.assigned && m.x >= 0 && m.y >= 0 && m.x < 4500 && m.y < 4500)
        .map((m) => ({ id: m.id, positionX: m.x, positionY: m.y }));
      const apiPos = new Map(apiMembers.map((m) => [m._id, { x: m.positionX, y: m.positionY }]));
      const layoutChanged = positions.some(
        (p) => apiPos.get(p.id)?.x !== p.positionX || apiPos.get(p.id)?.y !== p.positionY,
      );
      if (layoutChanged && positions.length > 0 && getToken() && effectiveCanEdit) {
        await syncLayout(positions).catch(() => {});
      }

      const currentUser = getAuthUser();
      if (currentUser?.role === "member" && currentUser.id) {
        setActiveViewerId(currentUser.id);
        localStorage.setItem("khandan_viewer_id", currentUser.id);
      } else if (!activeViewerIdRef.current && laid.members.length > 0) {
        const firstMale = laid.members.find((m) => m.assigned && m.gender === "m")
          ?? laid.members.find((m) => m.gender === "m");
        const viewerId = firstMale?.id ?? laid.members[0].id;
        setActiveViewerId(viewerId);
        localStorage.setItem("khandan_viewer_id", viewerId);
      }
    } catch (err: any) {
      console.error("loadData error:", err);
      if (
        err instanceof AuthError ||
        err?.name === "AuthError" ||
        err?.message?.includes("Session expired") ||
        err?.message?.includes("Unauthorized")
      ) {
        clearAuth();
        setLoggedIn(false);
        setUserIsAdmin(false);
        setUserCanEdit(false);
        setShowLogin(true);
        showToast(
          currentLang === "fa"
            ? "نشست شما منقضی شده است. لطفاً دوباره وارد شوید."
            : currentLang === "ar"
            ? "انتهت جلستك. يرجى تسجيل الدخول مجدداً."
            : "Session expired. Please sign in again.",
          "error"
        );
        if (adminMode) {
          window.location.replace("/");
        }
        return;
      }
      setApiError(translationDict[currentLang].errorLoad);
    } finally {
      setIsLoadingData(false);
      loadDataBusyRef.current = false;
      if (loadDataQueuedRef.current) {
        loadDataQueuedRef.current = false;
        void loadData();
      }
    }
  };

  const handleLoginSuccess = (authUser?: any) => {
    setLoggedIn(true);
    const adminRole = isAdmin();
    const canEdit = canEditTree();
    setUserIsAdmin(adminRole);
    setUserCanEdit(canEdit);
    setShowLogin(false);
    const user = authUser || getAuthUser();
    if (user) {
      setActiveViewerId(user.id);
      localStorage.setItem("khandan_viewer_id", user.id);
      if (user.language === "fa" || user.language === "ar") {
        setCurrentLang(user.language);
        localStorage.setItem("khandan_lang", user.language);
      }
      // Detect member role (read-only family member)
      const memberOnly = user.role === "member";
      setIsMemberRole(memberOnly);
      // Show change-password prompt if flagged
      if (user.mustChangePassword) {
        setShowChangePassword(true);
      }
    }
    const isEditorOrAdmin = user?.role === "admin" || user?.role === "editor";
    if (!adminMode && isEditorOrAdmin) {
      window.location.href = "/admin";
      return;
    }
    if (adminMode && !isEditorOrAdmin) {
      window.location.href = "/";
      return;
    }
    loadData();
  };

  useEffect(() => {
    if (showLangWizard || showLogin) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLangWizard, showLogin]);

  // ── WebSocket real-time sync ──────────────────────────────────────────────
  useEffect(() => {
    if (showLangWizard || showLogin) return;
    const handleEvent = (event: FamilySocketEvent) => {
      if (event === "layout:synced") return;
      // Avoid racing mid-mutation (member created before marriage is written)
      if (isSavingRef.current) {
        loadDataQueuedRef.current = true;
        return;
      }
      loadData();
    };
    connectFamilySocket(handleEvent);
    return () => {
      disconnectFamilySocket(handleEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLangWizard, showLogin]);

  // ── Mahram cache for female members ───────────────────────────────────────
  useEffect(() => {
    if (!loggedIn || !activeViewerId || !privacyShieldActive) return;
    const females = familyMembers.filter((m) => m.gender === "f" && m.assigned);
    if (females.length === 0) return;
    let cancelled = false;

    Promise.all(
      females.map(async (m) => {
        try {
          const isMahram = await checkMahram(activeViewerId, m.id);
          return [m.id, isMahram] as const;
        } catch {
          return [m.id, false] as const;
        }
      }),
    ).then((entries) => {
      if (!cancelled) {
        setMahramCache((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loggedIn, activeViewerId, familyMembers, privacyShieldActive]);

  const shouldBlurMember = (member: FamilyMember): boolean => {
    if (!privacyShieldActive || member.gender !== "f") return false;
    if (!activeViewerId || member.id === activeViewerId) return false;
    // For member-role: blur ALL female non-mahrams (blur unless verified mahram)
    if (isMemberRole) {
      return mahramCache[member.id] !== true;
    }
    // For admin/editor: only blur if member has privacyProtected enabled
    if (!member.privacy) return false;
    return mahramCache[member.id] === false;
  };

  // ── Profile sidebar mahram/relation ───────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!loggedIn || !selectedProfileId || !activeViewerId) {
        setProfileMahram(null);
        setProfileRelation(null);
        return;
      }
      const member = familyMembers.find((m) => m.id === selectedProfileId);
      if (!member) return;

      if (member.gender === "f") {
        checkMahram(activeViewerId, member.id)
          .then((value) => { if (!cancelled) setProfileMahram(value); })
          .catch(() => { if (!cancelled) setProfileMahram(false); });
      } else {
        setProfileMahram(null);
      }

      if (selectedProfileId !== activeViewerId) {
        const apiLang = currentLang === "ar" ? "ar" : "fa";
        getRelationship(activeViewerId, selectedProfileId, apiLang)
          .then((value) => { if (!cancelled) setProfileRelation(value); })
          .catch(() => { if (!cancelled) setProfileRelation(null); });
      } else {
        setProfileRelation(null);
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loggedIn, selectedProfileId, activeViewerId, familyMembers, currentLang]);

  // ── Language/Direction ────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.dir = currentLang === "en" ? "ltr" : "rtl";
    document.documentElement.lang = currentLang;
  }, [currentLang]);

  // ── Trackpad / Wheel Zoom ─────────────────────────────────────────────────
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Same gentle step as +/- buttons — avoid exponential jumps that fling the tree away
      const amount = e.deltaY > 0 ? -0.05 : 0.05;
      const vw = viewport.clientWidth || window.innerWidth;
      const vh = viewport.clientHeight || window.innerHeight;
      const CX = vw / 2;
      const CY = vh / 2;

      setScale((prevScale) => {
        const newScale = Math.min(Math.max(prevScale + amount, 0.2), 3.0);
        if (newScale === prevScale) return prevScale;
        setPanX((px) => CX - 2500 - ((CX - px - 2500) / prevScale) * newScale);
        setPanY((py) => CY - 2500 - ((CY - py - 2500) / prevScale) * newScale);
        return newScale;
      });
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, [showLangWizard, showLogin]);

  // ── Center On Tree ────────────────────────────────────────────────────────
  const centerOnTree = useCallback((targetScale?: number) => {
    const assigned = layoutMembers.filter((m) => m.assigned);
    if (assigned.length === 0) return;

    const minX = Math.min(...assigned.map((m) => m.x));
    const maxX = Math.max(...assigned.map((m) => m.x)) + CARD_W;
    const minY = Math.min(...assigned.map((m) => m.y));
    const maxY = Math.max(...assigned.map((m) => m.y)) + CARD_H;

    const treeCenterX = (minX + maxX) / 2;
    const treeCenterY = (minY + maxY) / 2;

    const vw = viewportRef.current?.clientWidth || window.innerWidth;
    const vh = viewportRef.current?.clientHeight || window.innerHeight;
    const isMobile = vw < 768;
    const sidebarVisible = adminMode && !isZenMode && (isMobile ? isMobileToolsOpen : !isSidebarHidden);
    const sidebarInset = !isMobile && sidebarVisible ? 304 : 0;
    const topInset = isZenMode || isNavbarHidden ? 24 : isMobile ? 84 : 104;
    const bottomInset = isZenMode || isFooterHidden ? 24 : isMobile ? 96 : 116;
    const horizontalPadding = isMobile ? 20 : 40;
    const availableWidth = Math.max(160, vw - sidebarInset - horizontalPadding * 2);
    const availableHeight = Math.max(160, vh - topInset - bottomInset - 24);
    const treeWidth = Math.max(1, maxX - minX);
    const treeHeight = Math.max(1, maxY - minY);
    const maxScaleCap = vw >= 3840 ? 2.2 : vw >= 2560 ? 1.6 : 1.0;
    const initialMobileScale = 0.6;
    const nextScale = targetScale ?? (isMobile ? initialMobileScale : Math.min(maxScaleCap, availableWidth / treeWidth, availableHeight / treeHeight));
    const safeScale = Math.min(3, Math.max(0.15, nextScale));
    const contentLeft = currentLang === "en" ? sidebarInset : 0;
    const contentRight = currentLang === "en" ? vw : vw - sidebarInset;
    const visibleCenterX = (contentLeft + contentRight) / 2;
    const visibleCenterY = isMobile ? topInset + 100 : topInset + availableHeight / 2;

    const targetCenterX = treeCenterX;
    const targetCenterY = isMobile ? minY + CARD_H / 2 : treeCenterY;

    const CANVAS = 2500;
    const finalPanX = Math.round(visibleCenterX - CANVAS - (targetCenterX - CANVAS) * safeScale);
    const finalPanY = Math.round(visibleCenterY - CANVAS - (targetCenterY - CANVAS) * safeScale);
    scaleRef.current = safeScale;
    panRef.current = { x: finalPanX, y: finalPanY };
    setScale(safeScale);
    setPanX(finalPanX);
    setPanY(finalPanY);
  }, [currentLang, isFooterHidden, isMobileToolsOpen, isNavbarHidden, isSidebarHidden, isZenMode, layoutMembers]);

  const focusMember = (memberId: string) => {
    const member = layoutMembers.find((m) => m.id === memberId && m.assigned);
    if (!member) return;
    const vw = viewportRef.current?.clientWidth || window.innerWidth;
    const vh = viewportRef.current?.clientHeight || window.innerHeight;
    const CANVAS = 2500;
    const cardCenterX = member.x + CARD_W / 2;
    const cardCenterY = member.y + CARD_H / 2;
    const nextPanX = Math.round(vw / 2 - CANVAS - (cardCenterX - CANVAS) * scale);
    const nextPanY = Math.round(vh / 2 - CANVAS - (cardCenterY - CANVAS) * scale);
    panRef.current = { x: nextPanX, y: nextPanY };
    setPanX(nextPanX);
    setPanY(nextPanY);
    setSelectedProfileId(memberId);
  };

  // Center after load & tree changes
  useEffect(() => {
    if (isLoaderVisible) return;
    const t = setTimeout(() => centerOnTree(), 80);
    return () => clearTimeout(t);
  }, [centerOnTree, isLoaderVisible, treeRevision]);

  // Center on window resize
  useEffect(() => {
    const handleResize = () => centerOnTree();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [centerOnTree]);

  // ── Toast ─────────────────────────────────────────────────────────────────
  function showToast(msg: string, type: "success" | "error" = "success") {
    setToastMessage(msg);
    setToastType(type);
    setIsToastVisible(true);
    setTimeout(() => setIsToastVisible(false), 3500);
  };

  // ── Zoom Controls ─────────────────────────────────────────────────────────
  const adjustZoom = (amount: number) => {
    setScale((prev) => {
      const next = Math.min(Math.max(prev + amount, 0.2), 3.0);
      if (next === prev) return prev;
      const vw = viewportRef.current?.clientWidth || window.innerWidth;
      const vh = viewportRef.current?.clientHeight || window.innerHeight;
      const CX = vw / 2;
      const CY = vh / 2;
      const nextPanX = Math.round(CX - 2500 - ((CX - panRef.current.x - 2500) / prev) * next);
      const nextPanY = Math.round(CY - 2500 - ((CY - panRef.current.y - 2500) / prev) * next);
      panRef.current = { x: nextPanX, y: nextPanY };
      scaleRef.current = next;
      setPanX(nextPanX);
      setPanY(nextPanY);
      return next;
    });
  };

  const resetZoom = () => {
    centerOnTree();
  };

  const panRafRef = useRef<number | null>(null);

  // ── Canvas Pan (mouse drag on desktop) ────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    hasDraggedRef.current = false;
    setIsDraggingCanvas(true);
    dragStartRef.current = { x: e.clientX - panRef.current.x, y: e.clientY - panRef.current.y };
    if (canvasRef.current) canvasRef.current.style.transition = "none";

    const startX = e.clientX;
    const startY = e.clientY;

    const onMouseMove = (ev: MouseEvent) => {
      const dist = Math.hypot(ev.clientX - startX, ev.clientY - startY);
      if (dist > 6) {
        hasDraggedRef.current = true;
      }
      const nextX = Math.round(ev.clientX - dragStartRef.current.x);
      const nextY = Math.round(ev.clientY - dragStartRef.current.y);
      panRef.current = { x: nextX, y: nextY };

      if (canvasRef.current) {
        canvasRef.current.style.transform = `translate(${nextX}px, ${nextY}px) scale(${scaleRef.current})`;
      }

      if (panRafRef.current) cancelAnimationFrame(panRafRef.current);
      panRafRef.current = requestAnimationFrame(() => {
        setPanX(nextX);
        setPanY(nextY);
      });
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      if (panRafRef.current) cancelAnimationFrame(panRafRef.current);
      setPanX(panRef.current.x);
      setPanY(panRef.current.y);
      setIsDraggingCanvas(false);
      if (canvasRef.current) {
        canvasRef.current.style.transition = "transform 0.25s cubic-bezier(0.2,0,0.2,1)";
      }
      setTimeout(() => {
        hasDraggedRef.current = false;
      }, 50);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // ── Mobile Touch Gestures (Buttery-smooth Pan & Pinch-to-Zoom) ─────────────
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    let touchStartDist = 0;
    let touchStartScale = 1;
    let touchStartMidpoint = { x: 0, y: 0 };
    let startTouchX = 0;
    let startTouchY = 0;
    let isTouchDragging = false;
    let isTouchPinching = false;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        isTouchDragging = true;
        isTouchPinching = false;
        hasDraggedRef.current = false;
        startTouchX = touch.clientX;
        startTouchY = touch.clientY;
        dragStartRef.current = {
          x: touch.clientX - panRef.current.x,
          y: touch.clientY - panRef.current.y,
        };
        setIsDraggingCanvas(true);
        if (canvasRef.current) {
          canvasRef.current.style.transition = "none";
        }
      } else if (e.touches.length === 2) {
        isTouchDragging = false;
        isTouchPinching = true;
        hasDraggedRef.current = true;
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        touchStartDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        touchStartScale = scaleRef.current;
        touchStartMidpoint = {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2,
        };
        setIsDraggingCanvas(true);
        if (canvasRef.current) {
          canvasRef.current.style.transition = "none";
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isTouchDragging && !isTouchPinching) return;
      e.preventDefault();

      if (isTouchPinching && e.touches.length === 2 && touchStartDist > 0) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const factor = currentDist / touchStartDist;
        const newScale = Math.min(Math.max(touchStartScale * factor, 0.15), 3.0);

        const CX = touchStartMidpoint.x;
        const CY = touchStartMidpoint.y;
        const currentScale = scaleRef.current;

        if (Math.abs(currentScale - newScale) > 0.003) {
          const nextPanX = Math.round(CX - 2500 - ((CX - panRef.current.x - 2500) / currentScale) * newScale);
          const nextPanY = Math.round(CY - 2500 - ((CY - panRef.current.y - 2500) / currentScale) * newScale);
          panRef.current = { x: nextPanX, y: nextPanY };
          scaleRef.current = newScale;

          if (canvasRef.current) {
            canvasRef.current.style.transform = `translate(${nextPanX}px, ${nextPanY}px) scale(${newScale})`;
          }

          if (panRafRef.current) cancelAnimationFrame(panRafRef.current);
          panRafRef.current = requestAnimationFrame(() => {
            setScale(newScale);
            setPanX(nextPanX);
            setPanY(nextPanY);
          });
        }
        return;
      }

      if (isTouchDragging && e.touches.length === 1) {
        const touch = e.touches[0];
        const dist = Math.hypot(touch.clientX - startTouchX, touch.clientY - startTouchY);
        if (dist > 6) {
          hasDraggedRef.current = true;
        }

        const nextX = Math.round(touch.clientX - dragStartRef.current.x);
        const nextY = Math.round(touch.clientY - dragStartRef.current.y);
        panRef.current = { x: nextX, y: nextY };

        if (canvasRef.current) {
          canvasRef.current.style.transform = `translate(${nextX}px, ${nextY}px) scale(${scaleRef.current})`;
        }

        if (panRafRef.current) cancelAnimationFrame(panRafRef.current);
        panRafRef.current = requestAnimationFrame(() => {
          setPanX(nextX);
          setPanY(nextY);
        });
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        isTouchDragging = false;
        isTouchPinching = false;
        if (panRafRef.current) cancelAnimationFrame(panRafRef.current);
        // Explicitly sync final coordinates to React state
        setPanX(panRef.current.x);
        setPanY(panRef.current.y);
        setScale(scaleRef.current);
        setIsDraggingCanvas(false);
        if (canvasRef.current) {
          canvasRef.current.style.transition = "transform 0.25s cubic-bezier(0.2,0,0.2,1)";
        }
        setTimeout(() => {
          hasDraggedRef.current = false;
        }, 50);
      } else if (e.touches.length === 1 && isTouchPinching) {
        isTouchPinching = false;
        isTouchDragging = true;
        const touch = e.touches[0];
        startTouchX = touch.clientX;
        startTouchY = touch.clientY;
        dragStartRef.current = {
          x: touch.clientX - panRef.current.x,
          y: touch.clientY - panRef.current.y,
        };
      }
    };

    viewport.addEventListener("touchstart", onTouchStart, { passive: false });
    viewport.addEventListener("touchmove", onTouchMove, { passive: false });
    viewport.addEventListener("touchend", onTouchEnd, { passive: true });
    viewport.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      viewport.removeEventListener("touchstart", onTouchStart);
      viewport.removeEventListener("touchmove", onTouchMove);
      viewport.removeEventListener("touchend", onTouchEnd);
      viewport.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  // ── Keyboard & Remote Control Navigation (TV / Desktop) ───────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || "").toLowerCase();
      if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") {
        return;
      }

      const PAN_STEP = 70;
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          setPanX((px) => px + PAN_STEP);
          break;
        case "ArrowRight":
          e.preventDefault();
          setPanX((px) => px - PAN_STEP);
          break;
        case "ArrowUp":
          e.preventDefault();
          setPanY((py) => py + PAN_STEP);
          break;
        case "ArrowDown":
          e.preventDefault();
          setPanY((py) => py - PAN_STEP);
          break;
        case "+":
        case "=":
          e.preventDefault();
          adjustZoom(0.1);
          break;
        case "-":
        case "_":
          e.preventDefault();
          adjustZoom(-0.1);
          break;
        case "0":
        case "r":
        case "R":
          e.preventDefault();
          centerOnTree();
          break;
        case "z":
        case "Z":
          e.preventDefault();
          setIsZenMode((z) => !z);
          break;
        case "Escape":
          setIsMobileMenuOpen(false);
          setIsMobileToolsOpen(false);
          setIsKinshipOpen(false);
          setIsExportModalOpen(false);
          setShowLogin(false);
          setShowChangePassword(false);
          setIsZenMode(false);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [centerOnTree]);

  // ── Modal Helpers ─────────────────────────────────────────────────────────
  const openAddMemberModal = () => {
    if (!userCanEdit) {
      showToast(t.msgMemberReadonly);
      return;
    }
    setEditId(null);
    setParentMarriageId(undefined);
    setInpNameAr("");
    setInpNameEn("");
    setInpBirth(2000);
    setInpDeath("");
    setInpGender("m");
    setInpPrivacy(false);
    setInpBio("");
    setInpMobile("");
    setInpAvatarFile(null);
    setInpAvatarDeleted(false);
      setInpGalleryDeleted(false);
    setInpGalleryFile(null);
    setInpAudioFile(null);
    setInpAudioTitle("");
    setInpSpouses([]);
    inpSpousesRef.current = [];
    setInpFatherId("");
    setInpMotherId("");
    setDeleteConfirmOpen(false);
    setIsEditorModalOpen(true);
  };

  const openEditMemberModal = (memberId: string) => {
    if (!userCanEdit) {
      setSelectedProfileId(memberId);
      return;
    }
    const member = familyMembers.find((f) => f.id === memberId);
    if (!member) return;

    setEditId(member.id);
    setDeleteConfirmOpen(false);
    setParentMarriageId(member.parentMarriageNode);
    setInpNameAr(member.nameAr);
    setInpNameEn(member.nameEn);
    setInpBirth(member.birth);
    setInpDeath(member.death === "living" ? "" : member.death.toString());
    setInpGender(member.gender);
    setInpPrivacy(member.privacy);
    setInpBio(member.bio || "");
    setInpMobile(member.mobile?.startsWith("auto-") ? "" : member.mobile || "");
    setInpAvatarDeleted(false);
      setInpGalleryDeleted(false);

    const spouses = marriageNodes
      .filter((mn) => mn.husband === member.id || mn.wife === member.id)
      .map((mn) => (mn.husband === member.id ? mn.wife : mn.husband))
      .filter(Boolean);
    setInpSpouses(spouses);
    inpSpousesRef.current = spouses;

    if (member.parentMarriageNode) {
      const mNode = marriageNodes.find((m) => m.id === member.parentMarriageNode);
      setInpFatherId(mNode?.husband || "");
      setInpMotherId(mNode?.wife || "");
    } else {
      setInpFatherId("");
      setInpMotherId("");
    }
    setIsEditorModalOpen(true);
  };

  const openAddChildToMarriageModal = (marriageId: string) => {
    openAddMemberModal();
    setParentMarriageId(marriageId);
    const mNode = marriageNodes.find((m) => m.id === marriageId);
    if (mNode) {
      setInpFatherId(mNode.husband || "");
      setInpMotherId(mNode.wife || "");
    }
  };

  const handleAddChildToMember = (memberId: string) => {
    const member = familyMembers.find((f) => f.id === memberId);
    if (!member) return;
    const mNode = marriageNodes.find((m) => m.husband === memberId || m.wife === memberId);
    if (mNode) {
      openAddChildToMarriageModal(mNode.id);
      return;
    }
    // No marriage node yet — open form with this parent pre-selected
    openAddMemberModal();
    if (member.gender === "m") {
      setInpFatherId(memberId);
    } else {
      setInpMotherId(memberId);
    }
  };

  // ── Form Submission (API-backed, auto-placement on canvas) ────────────────
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    // Read spouses from ref so a Save click right after selecting is not lost
    // to a not-yet-flushed React state update (common with Select → Submit).
    const spouseIds = [...inpSpousesRef.current];
    const genderNow = inpGender;

    if ((inpFatherId && !inpMotherId) || (!inpFatherId && inpMotherId)) {
      showToast(
        currentLang === "fa"
          ? "لطفاً هم پدر و هم مادر را انتخاب کنید، یا هیچ‌کدام را انتخاب نکنید."
          : currentLang === "ar"
          ? "الرجاء اختيار الأب والأم معاً، أو تركهما فارغين."
          : "Please select both father and mother, or neither."
      );
      return;
    }

    if (!inpBirth || inpBirth < 1000 || inpBirth > maxYear) {
      showToast(
        currentLang === "fa"
          ? "سال تولد معتبر وارد کنید."
          : currentLang === "ar"
          ? "أدخل سنة ميلاد صحيحة."
          : "Enter a valid birth year.",
      );
      return;
    }

    if (genderNow === "f" && spouseIds.length > 1) {
      showToast(
        currentLang === "fa"
          ? "خانم‌ها فقط یک همسر می‌توانند داشته باشند."
          : "Women may have only one husband.",
      );
      return;
    }

    if (editId && (inpFatherId === editId || inpMotherId === editId)) {
      showToast(
        currentLang === "fa"
          ? "خطا: یک عضو نمی‌تواند والد خودش باشد."
          : currentLang === "ar"
          ? "خطأ: لا يمكن أن يكون الشخص والده بنفسه."
          : "Error: A member cannot be their own parent."
      );
      return;
    }

    setIsSaving(true);
    isSavingRef.current = true;
    const deathVal: number | "living" = inpDeath ? parseInt(inpDeath) : "living";
    const apiLang = currentLang === "ar" ? "ar" : "fa";

    const memberPayload = {
      nameAr: inpNameAr,
      nameEn: inpNameEn,
      mobile: inpMobile,
      birth: inpBirth,
      death: deathVal,
      gender: genderNow,
      privacy: inpPrivacy,
      bio: inpBio,
    };

    try {
      let marriageIdForParent: string | undefined = parentMarriageId;

      // Resolve or create parent marriage
      if (inpFatherId && inpMotherId) {
        const existing = marriageNodes.find(
          (m) =>
            (m.husband === inpFatherId && m.wife === inpMotherId) ||
            (m.husband === inpMotherId && m.wife === inpFatherId),
        );
        if (existing) {
          marriageIdForParent = existing.id;
        } else {
          const father = familyMembers.find((m) => m.id === inpFatherId);
          const spouseA = father?.gender === "m" ? inpFatherId : inpMotherId;
          const spouseB = father?.gender === "m" ? inpMotherId : inpFatherId;
          const marriage = await createMarriage(spouseA, spouseB);
          marriageIdForParent = String(marriage._id);
        }
      } else {
        marriageIdForParent = undefined;
      }

      let savedMemberId = editId ? String(editId) : "";
      const hasParents = Boolean(marriageIdForParent);
      const hasSpouses = spouseIds.length > 0;
      const canvasHasPeople = familyMembers.some((m) => m.assigned && m.id !== editId);
      const existing = editId ? familyMembers.find((m) => m.id === editId) : undefined;

      // Unlinked new members go to the side pool; first root or linked people go on canvas
      let onCanvas: boolean;
      if (hasParents || hasSpouses || !canvasHasPeople) {
        onCanvas = true;
      } else if (existing) {
        onCanvas = existing.assigned;
      } else {
        onCanvas = false;
      }

      if (editId) {
        await updateMember(
          editId,
          familyMemberToEditDto(memberPayload, marriageIdForParent, onCanvas),
        );
        showToast(translationDict[currentLang].toastUpdate);
      } else {
        const created = await createMember(
          familyMemberToCreateDto(memberPayload, apiLang, marriageIdForParent, onCanvas),
        );
        savedMemberId = String(created._id);
        showToast(
          onCanvas
            ? translationDict[currentLang].toastPlaced
            : translationDict[currentLang].toastQueued,
        );
      }

      if (!savedMemberId) throw new Error("No member id");

      if (inpAvatarFile) {
        try {
          await uploadAvatar(savedMemberId, inpAvatarFile);
        } catch (e) {
          console.error("Avatar upload failed:", e);
          const errText = e instanceof Error ? e.message : "";
          if (errText.includes("413") || errText.toLowerCase().includes("large")) {
            showToast(currentLang === "fa" ? "حجم تصویر چهره بیش از حد مجاز است (حداکثر ۳۰ مگابایت)" : "Avatar image too large");
          } else {
            showToast(currentLang === "fa" ? "خطا در بارگذاری تصویر چهره" : "Failed to upload avatar");
          }
        }
      } else if (inpAvatarDeleted && editId) {
        await updateMember(editId, { avatar: "" });
      }
      if (inpGalleryFile) {
        try {
          await uploadGalleryPhoto(savedMemberId, inpGalleryFile);
        } catch (e) {
          console.error("Gallery upload failed:", e);
          showToast(currentLang === "fa" ? "خطا در بارگذاری تصویر گالری" : "Failed to upload gallery image");
        }
      } else if (inpGalleryDeleted && editId) {
        await updateMember(editId, { photos: [] });
      }
      if (inpAudioFile) {
        try {
          await uploadAudioMemory(savedMemberId, inpAudioFile, inpAudioTitle);
        } catch (e) {
          console.error("Audio upload failed:", e);
          showToast(currentLang === "fa" ? "خطا در بارگذاری فایل خاطره صوتی" : "Failed to upload audio memory");
        }
      }

      // Sync spouse marriages: create missing, remove unchecked
      const previousSpouseIds = new Set(
        marriageNodes
          .filter((mn) => mn.husband === savedMemberId || mn.wife === savedMemberId)
          .map((mn) => (mn.husband === savedMemberId ? mn.wife : mn.husband))
          .filter(Boolean)
          .map(String),
      );
      const nextSpouseIds = new Set(spouseIds.map(String));

      for (const sId of nextSpouseIds) {
        if (previousSpouseIds.has(sId)) continue;
        const isMale = genderNow === "m";
        const spouseA = isMale ? savedMemberId : sId;
        const spouseB = isMale ? sId : savedMemberId;
        await createMarriage(spouseA, spouseB);
      }

      for (const sId of previousSpouseIds) {
        if (nextSpouseIds.has(sId)) continue;
        const mn = marriageNodes.find(
          (m) =>
            (m.husband === savedMemberId && m.wife === sId) ||
            (m.wife === savedMemberId && m.husband === sId),
        );
        if (mn) await deleteMarriage(mn.id).catch(() => {});
      }

      // Link child to parent marriage
      if (marriageIdForParent && savedMemberId) {
        await addChildToMarriage(marriageIdForParent, savedMemberId).catch(() => {});
      }

      // If the member is going on canvas, make sure all linked relatives (parents/spouses) also go on canvas!
      if (onCanvas) {
        const linkedRelatives = [inpFatherId, inpMotherId, ...spouseIds].filter(Boolean);
        for (const relId of linkedRelatives) {
          const rel = familyMembers.find((m) => m.id === relId);
          if (rel && !rel.assigned) {
            await updateMember(relId, { isOnCanvas: true }).catch(() => {});
          }
        }
      }

      setIsEditorModalOpen(false);
      isSavingRef.current = false;
      await loadData();
    } catch (err) {
      if (err instanceof AuthError) {
        showToast(
          currentLang === "fa"
            ? "نشست منقضی شد — دوباره وارد شوید."
            : "Session expired — please sign in again.",
        );
      } else {
        const msg = err instanceof Error ? err.message : "";
        let parsed = msg;
        try {
          const j = JSON.parse(msg) as { message?: string | string[] };
          parsed = Array.isArray(j.message) ? j.message.join(" ") : j.message || msg;
        } catch { /* keep raw */ }
        showToast(parsed || translationDict[currentLang].errorSave);
      }
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  // ── Delete Member ─────────────────────────────────────────────────────────
  const requestDeleteMember = () => {
    if (!editId || isSaving) return;
    setDeleteConfirmOpen(true);
  };

  const executeDeleteMember = async (memberId: string) => {
    if (!memberId || isSaving) return;
    setIsSaving(true);
    try {
      await deleteMember(memberId);
      setIsEditorModalOpen(false);
      setDeleteConfirmOpen(false);
      setCardDeleteId(null);
      setSelectedProfileId(null);
      setEditId(null);
      showToast(translationDict[currentLang].toastDeleted);
      await loadData();
    } catch (err) {
      if (err instanceof AuthError) {
        showToast(
          currentLang === "fa"
            ? "نشست منقضی شد — دوباره وارد شوید."
            : "Session expired — please sign in again.",
        );
      } else {
        const msg = err instanceof Error ? err.message : "";
        let parsed = msg;
        try {
          const j = JSON.parse(msg) as { message?: string | string[] };
          parsed = Array.isArray(j.message) ? j.message.join(" ") : j.message || msg;
        } catch { /* keep */ }
        showToast(parsed || translationDict[currentLang].errorSave);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDeleteMember = async () => {
    if (!editId || !deleteConfirmOpen) return;
    await executeDeleteMember(editId);
  };

  // ── Place unlinked member on canvas (as a separate tree to the right) ──────
  const handlePlaceOnCanvas = async (memberId: string) => {
    if (!effectiveCanEdit || isSaving) return;
    setIsSaving(true);
    try {
      await updateMember(memberId, { isOnCanvas: true });
      showToast(translationDict[currentLang].toastAddedToTree);
      await loadData();
    } catch {
      showToast(translationDict[currentLang].errorSave);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Move isolate back to side pool ────────────────────────────────────────
  const handleMoveToPool = async (memberId: string) => {
    if (!effectiveCanEdit || isSaving) return;
    const member = familyMembers.find((m) => m.id === memberId);
    if (!member || !isUnlinkedIsolate(member, marriageNodes)) {
      showToast(
        currentLang === "fa"
          ? "فقط اعضای بدون والد و بدون همسر را می‌توان به لیست برگرداند."
          : currentLang === "ar"
          ? "يمكن نقل الأعضاء بلا أب/أم وبلا زوج فقط إلى القائمة."
          : "Only members without parents or spouses can be moved to the list.",
      );
      return;
    }
    setIsSaving(true);
    try {
      await updateMember(memberId, { isOnCanvas: false });
      showToast(translationDict[currentLang].toastMovedToPool);
      await loadData();
    } catch {
      showToast(translationDict[currentLang].errorSave);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Export ────────────────────────────────────────────────────────────────
  const performActualExport = async () => {
    try {
      const filename = `khandan-najaf-${exportStyle}-${activeYear}`;

      if (exportStyle === "tree") {
        const options = { scale: exportScale, includeGrid: exportGrid };

        const result = exportFormat === "pdf"
          ? await exportToPDF(filename, options)
          : await exportToPNG(`${filename}-${exportScale}x`, options);

        setIsExportModalOpen(false);
        if (result.actualScale < result.requestedScale) {
          showToast(
            currentLang === "fa"
              ? `خروجی کامل با مقیاس امن ${result.actualScale}x دانلود شد.`
              : currentLang === "ar"
              ? `تم تنزيل الشجرة كاملة بمقياس آمن ${result.actualScale}x.`
              : `Complete export downloaded at a safe ${result.actualScale}x scale.`
          );
        } else {
          showToast(
            exportFormat === "pdf"
              ? currentLang === "fa"
                ? "شجره‌نامه با موفقیت به‌صورت PDF دانلود شد."
                : currentLang === "ar"
                  ? "تم تنزيل شجرة العائلة بصيغة PDF بنجاح."
                  : "The family tree PDF was downloaded successfully."
              : translationDict[currentLang].exportSuccess
          );
        }
      } else {
        if (!exportHierarchy) {
          throw new Error("داده‌های ساختار خانوادگی برای رسم این نمودار یافت نشد.");
        }
        setCustomExporting(true);
        setCustomExportProgress(20);

        let svgString = "";
        let width = 2600;
        let height = 2600;

        if (exportStyle === "sunburst") {
          width = 2600;
          height = 2600;
          svgString = generateSunburstSVG(exportHierarchy, width);
        } else {
          width = 3000;
          height = 2000;
          svgString = generateMindmapSVG(exportHierarchy, width, height);
        }
        setCustomExportProgress(50);

        await exportCustomDiagram(
          svgString,
          width,
          height,
          exportFormat,
          exportScale,
          filename,
          (p) => setCustomExportProgress(50 + Math.round(p * 0.5))
        );

        setCustomExportProgress(100);
        setIsExportModalOpen(false);

        showToast(
          currentLang === "fa"
            ? `خروجی ${exportStyle === "sunburst" ? "خورشیدی" : "متقارن دوطرفه"} با فرمت ${exportFormat.toUpperCase()} با موفقیت دانلود شد.`
            : `Export downloaded successfully.`
        );
      }
    } catch (err) {
      console.error(err);
      setIsExportModalOpen(false);
      const msg = err instanceof Error ? err.message : String(err);
      showToast(
        currentLang === "fa" ? `خطا در خروجی: ${msg}` : `Export error: ${msg}`,
        "error"
      );
    } finally {
      setCustomExporting(false);
      setCustomExportProgress(0);
    }
  };

  // ── Computed Values ───────────────────────────────────────────────────────
  const minYear = familyMembers.length > 0 ? Math.min(...familyMembers.map((m) => m.birth)) : 1900;
  const maxYear = new Date().getFullYear();
  const spouseCandidates = familyMembers.filter((f) => {
    if (f.gender === inpGender) return false;
    if (f.id === editId || f.id === inpFatherId || f.id === inpMotherId) return false;
    // Women already married to someone else cannot be selected as a new wife
    if (inpGender === "m" && f.gender === "f") {
      const existing = marriageNodes.find((mn) => mn.wife === f.id || mn.husband === f.id);
      if (existing) {
        const other =
          existing.husband === f.id ? existing.wife : existing.husband;
        if (other && other !== editId) return false;
      }
    }
    return true;
  });
  const activePool = layoutMembers.filter((m) => {
    if (!m.assigned) return false;
    if (lifeFilter === "alive" && m.death !== "living") return false;
    if (lifeFilter === "deceased" && m.death === "living") return false;
    return true;
  });
  const unlinkedPool = familyMembers.filter((m) => !m.assigned);
  const totalCount = familyMembers.length;
  const deceasedCount = familyMembers.filter((f) => f.death !== "living").length;
  const malesCount = familyMembers.filter((f) => f.gender === "m").length;
  const femalesCount = familyMembers.filter((f) => f.gender === "f").length;

  const t = translationDict[currentLang];
  const labelCtx = useMemo(
    () => ({ members: familyMembers, marriages: marriageNodes }),
    [familyMembers, marriageNodes],
  );
  const memberDisplayLabel = useCallback(
    (m: FamilyMember) => formatMemberLabel(m, currentLang, labelCtx),
    [currentLang, labelCtx],
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-full w-full overflow-hidden flex flex-col antialiased">

      {showLangWizard && <LanguageWizard onSelect={handleLangSelect} />}

      {showLogin && !showLangWizard && (
        <LoginModal lang={currentLang} onSuccess={handleLoginSuccess} />
      )}

      {showChangePassword && (
        <ChangePasswordModal
          lang={currentLang}
          onClose={() => setShowChangePassword(false)}
        />
      )}

      {isKinshipOpen && (
        <KinshipPanel
          members={familyMembers}
          marriages={marriageNodes}
          lang={currentLang}
          onClose={() => setIsKinshipOpen(false)}
          labels={{
            title: t.kinshipTitle,
            personA: t.kinshipPersonA,
            personB: t.kinshipPersonB,
            btnCalculate: t.kinshipCalculate,
            result: t.kinshipResult,
            selectPlaceholder: t.kinshipSelect,
          }}
        />
      )}

      {listModalMode && (
        <MembersListModal
          mode={listModalMode}
          members={familyMembers}
          marriageNodes={marriageNodes}
          lang={currentLang}
          isAdmin={effectiveCanEdit}
          isSaving={isSaving}
          selectedId={selectedProfileId}
          lifeFilter={lifeFilter}
          onLifeFilterChange={setLifeFilter}
          onClose={() => {
            setListModalMode(null);
            setLifeFilter("all");
          }}
          onSelect={(id) => {
            if (listModalMode === "pool") {
              setSelectedProfileId(id);
            } else {
              focusMember(id);
              setListModalMode(null);
            }
          }}
          onPlaceOnCanvas={async (id) => {
            await handlePlaceOnCanvas(id);
          }}
          onMoveToPool={async (id) => {
            await handleMoveToPool(id);
          }}
          onEdit={(id) => {
            setListModalMode(null);
            openEditMemberModal(id);
          }}
          shouldBlur={shouldBlurMember}
          labels={{
            poolTitle: t.poolTitle,
            membersTitle: t.membersListTitle,
            poolEmpty: t.poolEmpty,
            membersEmpty: t.membersListEmpty,
            poolAddToTree: t.poolAddToTree,
            poolRemoveFromTree: t.poolRemoveFromTree,
            lifeFilterAll: t.lifeFilterAll,
            lifeFilterAlive: t.lifeFilterAlive,
            lifeFilterDeceased: t.lifeFilterDeceased,
            close: t.btnCancel,
            edit: t.profileEdit,
          }}
        />
      )}

      {selectedProfileId && (
        <ProfileSidebar
          member={familyMembers.find((m) => m.id === selectedProfileId) ?? null}
          members={familyMembers}
          marriages={marriageNodes}
          lang={currentLang}
          isMahram={profileMahram}
          relationshipToViewer={profileRelation}
          viewerLabel={
            activeViewerId
              ? (() => {
                  const v = familyMembers.find((m) => m.id === activeViewerId);
                  return v ? formatMemberPrimaryName(v, currentLang) : null;
                })()
              : null
          }
          onClose={() => setSelectedProfileId(null)}
          onEdit={(id) => {
            setSelectedProfileId(null);
            openEditMemberModal(id);
          }}
          onAddChild={(id) => {
            setSelectedProfileId(null);
            handleAddChildToMember(id);
          }}
          onDelete={(id) => {
            setSelectedProfileId(null);
            setCardDeleteId(id);
          }}
          isAdmin={effectiveCanEdit}
          isMemberRole={isMemberRole}
          side={currentLang === "en" ? "left" : "right"}
          labels={{
            title: t.profileTitle,
            bio: t.profileBio,
            lifespan: "",
            gender: t.profileGender,
            mobile: t.profileMobile,
            mahramStatus: t.profileMahram,
            mahramYes: t.profileMahramYes,
            mahramNo: t.profileMahramNo,
            relationToYou: t.profileRelation,
            btnEdit: t.profileEdit,
            btnAddChild: t.profileAddChild,
            btnDelete: t.btnDelete,
            alive: t.profileAlive,
            deceased: t.profileDeceased,
            male: t.male,
            female: t.female,
            gallery: t.lblGallery,
            audioMemories: t.lblAudio,
          }}
        />
      )}

      {apiError && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 surface-panel px-4 py-2 rounded-xl text-xs text-rose-700 border border-rose-200 shadow-xl flex items-center gap-2">
          <i className="fa-solid fa-circle-exclamation text-rose-600 text-sm"></i>
          <span className="font-bold">{apiError}</span>
          <button
            onClick={() => void loadData()}
            className="ms-2 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
          >
            {currentLang === "fa" ? "تلاش مجدد" : currentLang === "ar" ? "إعادة المحاولة" : "Retry"}
          </button>
        </div>
      )}

      {/* ── Show Navbar Button ── */}
      {isNavbarHidden && !isZenMode && (
        <button
          onClick={() => setIsNavbarHidden(false)}
          className="fixed top-0 left-1/2 -translate-x-1/2 z-50 px-6 py-1.5 surface-panel border border-t-0 border-white/50 rounded-b-2xl shadow-md text-teal-700 flex items-center justify-center pointer-events-auto hover:bg-white/90 transition-colors cursor-pointer"
          title={currentLang === "fa" ? "نمایش منوی بالا" : "Show Navbar"}
        >
          <i className="fa-solid fa-chevron-down text-sm"></i>
        </button>
      )}

      {/* ── Header Navbar ── */}
      <header
        className={`fixed top-2 left-2 right-2 md:top-4 md:left-4 md:right-4 z-40 pointer-events-none transition-all duration-500 ease-in-out ${
          isZenMode || isNavbarHidden ? "-translate-y-32 opacity-0 scale-95" : "translate-y-0 opacity-100"
        }`}
      >
        <div className="pointer-events-auto surface-panel px-3 py-2 md:px-4 md:py-2.5 rounded-2xl md:rounded-3xl flex items-center justify-between gap-2 md:gap-3 border border-white/50 shadow-lg backdrop-blur-md mx-auto max-w-screen-2xl">
          
          {/* Brand & Admin Group */}
          <div className="hidden lg:flex items-center gap-2 md:gap-3 shrink-0">
            <div className="w-9 h-9 rounded-full surface-inset flex items-center justify-center text-teal-800 shrink-0">
              <i className="fa-solid fa-crown text-base md:text-lg"></i>
            </div>
            <div className="flex flex-col justify-center">
              <h1 className="text-sm md:text-base font-bold text-slate-800 tracking-wide font-display leading-none">{t.brandTitle}</h1>
              <p className="hidden 2xl:block text-[10px] text-slate-500 mt-0.5 font-medium">
                {adminMode ? (currentLang === "fa" ? "پنل مدیریت شجره‌نامه" : "Tree Management") : t.brandSubtitle}
              </p>
            </div>
            
            {adminMode && loggedIn && (
              <span className="hidden xl:inline-flex role-chip h-6 text-[10px] px-2 items-center shrink-0">
                {userIsAdmin ? t.roleAdmin : t.roleEditor}
              </span>
            )}
            {adminMode && userIsAdmin && (
              <Link
                href="/admin/users"
                className="w-9 h-9 rounded-xl surface-raised flex items-center justify-center text-teal-800 hover:text-teal-900 transition-colors shrink-0"
                title={currentLang === "fa" ? "مدیریت کاربران" : currentLang === "ar" ? "إدارة المستخدمين" : "Manage users"}
              >
                <i className="fa-solid fa-users-gear text-xs"></i>
              </Link>
            )}
            {adminMode && (
              <Link
                href="/"
                className="h-9 px-2.5 rounded-xl surface-raised flex items-center gap-1.5 text-teal-800 hover:bg-white/80 transition-all text-xs font-bold border border-teal-100/50 shrink-0"
                title={currentLang === "fa" ? "مشاهده نسخه عمومی شجره‌نامه" : "Public View"}
              >
                <i className="fa-solid fa-eye text-xs"></i>
                <span className="hidden 2xl:inline">{currentLang === "fa" ? "نمای عمومی" : "Public View"}</span>
              </Link>
            )}
            {!adminMode && loggedIn && (userIsAdmin || userCanEdit) && (
              <Link
                href="/admin"
                className="h-9 px-3 rounded-xl bg-teal-800 text-white flex items-center gap-1.5 hover:bg-teal-900 transition-all text-xs font-bold shadow-sm shrink-0"
                title={currentLang === "fa" ? "ورود به پنل مدیریت شجره‌نامه" : "Admin Panel"}
              >
                <i className="fa-solid fa-screwdriver-wrench text-xs"></i>
                <span className="hidden 2xl:inline">{currentLang === "fa" ? "پنل مدیریت" : "Admin Panel"}</span>
              </Link>
            )}
          </div>

          {/* Center Canvas Controls */}
          <div className="hidden lg:flex items-center gap-2 shrink-0">
            {effectiveCanEdit && (
              <button
                onClick={() => (loggedIn ? openAddMemberModal() : setShowLogin(true))}
                className="h-9 px-3.5 rounded-xl bg-teal-800 text-white flex items-center gap-2 hover:bg-teal-900 transition-all shadow-sm shrink-0 text-xs font-bold"
              >
                <i className="fa-solid fa-user-plus text-xs"></i>
                <span>{t.btnAdd}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsKinshipOpen(true)}
              className="h-9 px-3 rounded-xl surface-raised flex items-center gap-2 text-teal-800 hover:bg-teal-50 transition-colors border border-teal-100/50 shadow-sm shrink-0 text-xs font-bold"
              title={t.sidebarKinship}
            >
              <i className="fa-solid fa-diagram-project text-xs text-teal-700"></i>
              <span>{t.sidebarKinship}</span>
            </button>

            <div className="h-9 flex items-center gap-0.5 surface-inset px-1.5 rounded-xl shrink-0">
              <button
                onClick={() => adjustZoom(-0.1)}
                className="w-7 h-7 rounded-lg hover:bg-white/50 flex items-center justify-center text-slate-600 transition-colors"
                title="Zoom Out"
              >
                <i className="fa-solid fa-minus text-[9px]"></i>
              </button>
              <span className="text-xs font-bold px-1 w-10 text-center text-slate-700 font-mono tabular-nums">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => adjustZoom(0.1)}
                className="w-7 h-7 rounded-lg hover:bg-white/50 flex items-center justify-center text-slate-600 transition-colors"
                title="Zoom In"
              >
                <i className="fa-solid fa-plus text-[9px]"></i>
              </button>
              <div className="w-px h-4 bg-slate-300 mx-1"></div>
              <button
                onClick={resetZoom}
                className="w-7 h-7 rounded-lg hover:bg-white/50 flex items-center justify-center text-teal-700 transition-colors"
                title="Recenter"
              >
                <i className="fa-solid fa-arrows-to-dot text-xs"></i>
              </button>
            </div>

            <button
              onClick={() => {
                setIsZenMode(true);
                showToast(
                  currentLang === "fa"
                    ? "حالت تمرکز فعال شد."
                    : currentLang === "ar"
                    ? "تم تفعيل وضع التركيز."
                    : "Zen Mode enabled."
                );
              }}
              className="w-9 h-9 rounded-xl surface-raised flex items-center justify-center text-slate-600 hover:text-teal-700 transition-colors shrink-0"
              title={currentLang === "fa" ? "حالت تمرکز" : "Zen Mode"}
            >
              <i className="fa-solid fa-eye-slash text-xs"></i>
            </button>
          </div>

          {/* Right/Left Controls */}
          <div className="hidden lg:flex items-center gap-1.5 md:gap-2 shrink-0">
            {!isMemberRole && (
            <button
              type="button"
              onClick={() => {
                setPrivacyShieldActive((p) => !p);
                showToast(
                  !privacyShieldActive
                    ? currentLang === "fa"
                      ? "سپر حریم خصوصی فعال شد"
                      : "Privacy shield on"
                    : currentLang === "fa"
                    ? "سپر حریم خصوصی غیرفعال شد"
                    : "Privacy shield off",
                );
              }}
              className={`hidden md:flex w-9 h-9 rounded-xl surface-raised items-center justify-center shrink-0 transition-colors ${
                privacyShieldActive ? "text-emerald-600 bg-emerald-50/50" : "text-slate-400"
              }`}
              title={privacyShieldActive ? t.lblPrivacyActive : t.lblPrivacyInactive}
            >
              <i className={`fa-solid ${privacyShieldActive ? "fa-shield-halved" : "fa-lock-open"} text-xs`}></i>
            </button>
            )} {/* end !isMemberRole privacy shield */}

            {!isMemberRole && (
            <div className="hidden xl:flex items-center w-40 2xl:w-44 shrink-0">
              <Select
                className="w-full"
                aria-label={t.sidebarViewer}
                value={activeViewerId || null}
                onChange={(v) => {
                  if (!loggedIn) {
                    setShowLogin(true);
                    showToast(t.viewAsNeedLogin);
                    return;
                  }
                  const id = v ? String(v) : "";
                  setActiveViewerId(id);
                  localStorage.setItem("khandan_viewer_id", id);
                  setMahramCache({});
                  if (!privacyShieldActive) {
                    showToast(t.viewAsNeedShield);
                  }
                }}
                placeholder={t.sidebarViewer}
              >
                <Select.Trigger className="h-9 min-h-9 rounded-xl surface-raised text-[11px] font-medium px-2.5 shadow-sm flex items-center border border-teal-100/50 whitespace-nowrap overflow-hidden">
                  <i className="fa-solid fa-user-check text-[11px] text-teal-600 me-1.5 shrink-0"></i>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover className="max-h-64 overflow-y-auto">
                  <ListBox>
                    {familyMembers.filter((m) => m.assigned).map((m) => (
                      <ListBox.Item key={m.id} id={m.id} textValue={memberDisplayLabel(m)}>
                        {memberDisplayLabel(m)}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>
            )} {/* end !isMemberRole viewer picker */}

            <div className="hidden lg:flex items-center surface-inset p-1 rounded-xl gap-0.5 h-9 shrink-0">
              {(["ar", "fa", "en"] as const).map((lang) => (
                <Button
                  key={lang}
                  size="sm"
                  variant={currentLang === lang ? "primary" : "tertiary"}
                  className={`min-w-7 h-7 px-1.5 text-[10px] font-bold ${currentLang !== lang ? "text-slate-500 hover:text-slate-800" : ""}`}
                  onPress={async () => {
                    setCurrentLang(lang);
                    if (lang === "fa" || lang === "ar") {
                      localStorage.setItem("khandan_lang", lang);
                      await persistLanguage(lang);
                    }
                  }}
                >
                  {lang === "ar" ? "ع" : lang === "fa" ? "فا" : "EN"}
                </Button>
              ))}
            </div>

            {!isMemberRole && (
              <Button
                size="sm"
                variant="secondary"
                onPress={() => setIsExportModalOpen(true)}
                className="h-9 min-w-9 px-2 md:px-3 rounded-xl surface-raised text-slate-700 font-bold text-xs shrink-0 flex items-center gap-1.5"
                aria-label={t.btnExport}
              >
                <i className="fa-solid fa-print text-xs"></i>
                <span className="hidden 2xl:inline">{t.btnExport}</span>
              </Button>
            )}

            {loggedIn && (
              <Button
                size="sm"
                variant="tertiary"
                onPress={() => setShowChangePassword(true)}
                className="h-9 min-w-9 px-2 md:px-3 rounded-xl surface-inset text-slate-600 font-bold text-xs hover:text-teal-700 hover:bg-teal-50 transition-colors shrink-0 flex items-center gap-1.5"
                aria-label={currentLang === "fa" ? "تغییر رمز عبور" : currentLang === "ar" ? "تغيير كلمة المرور" : "Change Password"}
              >
                <i className="fa-solid fa-key text-xs"></i>
                <span className="hidden 2xl:inline">
                  {currentLang === "fa" ? "تغییر رمز" : currentLang === "ar" ? "تغيير الرمز" : "Password"}
                </span>
              </Button>
            )}

            <Button
              size="sm"
              variant="tertiary"
              onPress={() => {
                if (loggedIn) {
                  handleLogout();
                  showToast(currentLang === "fa" ? "خارج شدید." : "Logged out.");
                } else {
                  setShowLogin(true);
                }
              }}
              className="h-9 min-w-9 px-2 md:px-3 rounded-xl surface-inset text-slate-600 font-bold text-xs hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0 flex items-center gap-1.5"
              aria-label={loggedIn ? t.btnLogout : t.btnLogin}
            >
              <i className={`fa-solid ${loggedIn ? "fa-arrow-right-from-bracket" : "fa-arrow-right-to-bracket"} text-xs`}></i>
              <span className="hidden 2xl:inline">{loggedIn ? t.btnLogout : t.btnLogin}</span>
            </Button>

            {/* Collapse Navbar Button */}
            <button
              onClick={() => setIsNavbarHidden(true)}
              className="hidden md:flex w-9 h-9 rounded-xl surface-inset items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors shrink-0 ms-1"
              title={currentLang === "fa" ? "بستن نوار بالا" : "Hide Navbar"}
            >
              <i className="fa-solid fa-chevron-up text-xs"></i>
            </button>
          </div>

          {/* ── Mobile & Tablet Bar (< 1024px) ── */}
          <div className="flex lg:hidden w-full items-center justify-between gap-2">
            {/* Right: Brand Title */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full surface-inset flex items-center justify-center text-teal-800 shrink-0">
                <i className="fa-solid fa-crown text-sm"></i>
              </div>
              <div className="flex flex-col justify-center min-w-0">
                <h1 className="text-xs sm:text-sm font-bold text-slate-800 tracking-wide font-display truncate leading-tight">
                  {t.brandTitle}
                </h1>
                {adminMode && loggedIn && (
                  <span className="role-chip h-4 text-[8px] px-1 flex items-center self-start mt-0.5">
                    {userIsAdmin ? t.roleAdmin : t.roleEditor}
                  </span>
                )}
              </div>
            </div>

            {/* Left: Quick Actions & Hamburger Menu */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {effectiveCanEdit && (
                <button
                  type="button"
                  onClick={() => (loggedIn ? openAddMemberModal() : setShowLogin(true))}
                  className="w-8 h-8 rounded-xl bg-teal-800 text-white flex items-center justify-center text-xs shadow-sm hover:bg-teal-900 transition-colors"
                  aria-label={t.btnAdd}
                  title={t.btnAdd}
                >
                  <i className="fa-solid fa-user-plus text-[11px]"></i>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsKinshipOpen(true)}
                className="w-8 h-8 rounded-xl surface-raised flex items-center justify-center text-teal-800 text-xs border border-teal-100/50 shadow-sm hover:bg-teal-50 transition-colors"
                aria-label={t.sidebarKinship}
                title={t.sidebarKinship}
              >
                <i className="fa-solid fa-diagram-project text-[11px]"></i>
              </button>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                className="w-8 h-8 rounded-xl surface-raised flex items-center justify-center text-slate-700 hover:text-teal-800 text-xs border border-teal-100/50 shadow-sm hover:bg-white/80 transition-colors"
                aria-label="Menu"
                title="Menu"
              >
                <i className="fa-solid fa-bars text-[12px]"></i>
              </button>
              <button
                onClick={() => setIsNavbarHidden(true)}
                className="w-8 h-8 rounded-xl surface-inset flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors shrink-0 ms-0.5"
                title={currentLang === "fa" ? "بستن نوار بالا" : "Hide Navbar"}
              >
                <i className="fa-solid fa-chevron-up text-xs"></i>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobile Navigation Drawer ── */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="relative z-10 w-[85vw] max-w-xs h-full surface-panel p-5 shadow-2xl flex flex-col justify-between overflow-y-auto border-e border-white/50">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-teal-900/10 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full surface-inset flex items-center justify-center text-teal-800 shrink-0">
                    <i className="fa-solid fa-crown text-base"></i>
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-800 font-display leading-tight">{t.brandTitle}</h2>
                    <p className="text-[10px] text-slate-500 font-medium">
                      {adminMode ? (currentLang === "fa" ? "پنل مدیریت شجره‌نامه" : "Management Panel") : t.brandSubtitle}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-8 h-8 rounded-xl surface-inset flex items-center justify-center text-slate-500 hover:text-slate-800"
                  aria-label="Close"
                >
                  <i className="fa-solid fa-xmark text-sm"></i>
                </button>
              </div>

              {/* Status / Role */}
              {loggedIn && (
                <div className="mb-4 p-3 rounded-2xl surface-inset flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-teal-800 text-white flex items-center justify-center text-xs">
                      <i className="fa-solid fa-user"></i>
                    </div>
                    <span className="text-xs font-bold text-slate-700">{getAuthUser()?.name || "User"}</span>
                  </div>
                  <span className="role-chip h-6 text-[10px] px-2 flex items-center">
                    {userIsAdmin ? t.roleAdmin : t.roleEditor}
                  </span>
                </div>
              )}

              {/* Action items */}
              <div className="space-y-2">
                {/* Admin Mode switch */}
                {adminMode && (
                  <Link
                    href="/"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="w-full h-10 px-3 rounded-xl surface-raised flex items-center gap-2.5 text-xs font-bold text-teal-800 hover:bg-white/80 transition-all border border-teal-100/50"
                  >
                    <i className="fa-solid fa-eye text-sm text-teal-600"></i>
                    <span>{currentLang === "fa" ? "نمای عمومی شجره‌نامه" : "Public View"}</span>
                  </Link>
                )}
                {!adminMode && loggedIn && (userIsAdmin || userCanEdit) && (
                  <Link
                    href="/admin"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="w-full h-10 px-3 rounded-xl bg-teal-800 text-white flex items-center gap-2.5 text-xs font-bold shadow-sm"
                  >
                    <i className="fa-solid fa-screwdriver-wrench text-sm"></i>
                    <span>{currentLang === "fa" ? "ورود به پنل مدیریت" : "Admin Panel"}</span>
                  </Link>
                )}

                {/* Manage users */}
                {adminMode && userIsAdmin && (
                  <Link
                    href="/admin/users"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="w-full h-10 px-3 rounded-xl surface-raised flex items-center gap-2.5 text-xs font-bold text-teal-800 hover:bg-white/80 transition-all border border-teal-100/50"
                  >
                    <i className="fa-solid fa-users-gear text-sm text-teal-600"></i>
                    <span>{currentLang === "fa" ? "مدیریت کاربران و دسترسی‌ها" : "Manage Users"}</span>
                  </Link>
                )}

                {/* Members List */}
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setListModalMode("members");
                  }}
                  className="w-full h-10 px-3 rounded-xl surface-raised flex items-center gap-2.5 text-xs font-bold text-teal-800 hover:bg-white/80 transition-all border border-teal-100/50"
                >
                  <i className="fa-solid fa-users text-sm text-teal-600"></i>
                  <span>{t.membersListTitle}</span>
                </button>

                {/* Pool List (Waiting) */}
                {adminMode && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setListModalMode("pool");
                    }}
                    className="w-full h-10 px-3 rounded-xl surface-raised flex items-center gap-2.5 text-xs font-bold text-teal-800 hover:bg-white/80 transition-all border border-teal-100/50"
                  >
                    <i className="fa-solid fa-user-clock text-sm text-amber-600"></i>
                    <span>{t.poolTitle}</span>
                  </button>
                )}

                {/* Kinship */}
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsKinshipOpen(true);
                  }}
                  className="w-full h-10 px-3 rounded-xl surface-raised flex items-center gap-2.5 text-xs font-bold text-teal-800 hover:bg-white/80 transition-all border border-teal-100/50"
                >
                  <i className="fa-solid fa-diagram-project text-sm text-teal-600"></i>
                  <span>{t.sidebarKinship}</span>
                </button>

                {/* User Guide */}
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsGuideOpen(true);
                  }}
                  className="w-full h-10 px-3 rounded-xl surface-raised flex items-center gap-2.5 text-xs font-bold text-teal-800 hover:bg-white/80 transition-all border border-teal-100/50"
                >
                  <i className="fa-solid fa-book-open text-sm text-teal-600"></i>
                  <span>{t.sidebarGuide}</span>
                </button>

                {/* Export */}
                {!isMemberRole && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setIsExportModalOpen(true);
                    }}
                    className="w-full h-10 px-3 rounded-xl surface-raised flex items-center gap-2.5 text-xs font-bold text-slate-700 hover:bg-white/80 transition-all border border-teal-100/50"
                  >
                    <i className="fa-solid fa-print text-sm text-slate-600"></i>
                    <span>{t.btnExport}</span>
                  </button>
                )}

                {/* Change Password */}
                {loggedIn && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setShowChangePassword(true);
                    }}
                    className="w-full h-10 px-3 rounded-xl surface-inset flex items-center gap-2.5 text-xs font-bold text-slate-700 hover:text-teal-700 transition-all"
                  >
                    <i className="fa-solid fa-key text-sm text-amber-600"></i>
                    <span>{currentLang === "fa" ? "تغییر رمز عبور" : "Change Password"}</span>
                  </button>
                )}

                {/* Mahram Perspective & Shield in drawer */}
                {!isMemberRole && (
                  <div className="pt-2 mt-2 border-t border-teal-900/10 space-y-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">
                      {t.sidebarViewer}
                    </p>
                    <Select
                      className="w-full"
                      aria-label={t.sidebarViewer}
                      value={activeViewerId || null}
                      onChange={(v) => {
                        if (!loggedIn) {
                          setShowLogin(true);
                          showToast(t.viewAsNeedLogin);
                          return;
                        }
                        const id = v ? String(v) : "";
                        setActiveViewerId(id);
                        localStorage.setItem("khandan_viewer_id", id);
                        setMahramCache({});
                        if (!privacyShieldActive) {
                          showToast(t.viewAsNeedShield);
                        }
                      }}
                      placeholder={t.sidebarViewer}
                    >
                      <Select.Trigger className="h-10 rounded-xl surface-raised text-xs font-medium px-3 shadow-sm flex items-center border border-teal-100/50">
                        <i className="fa-solid fa-user-check text-xs text-teal-600 me-2 shrink-0"></i>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover className="max-h-64 overflow-y-auto">
                        <ListBox>
                          {familyMembers.filter((m) => m.assigned).map((m) => (
                            <ListBox.Item key={m.id} id={m.id} textValue={memberDisplayLabel(m)}>
                              {memberDisplayLabel(m)}
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>

                    <button
                      type="button"
                      onClick={() => {
                        setPrivacyShieldActive((p) => !p);
                        showToast(!privacyShieldActive ? "سپر حریم خصوصی فعال شد" : "سپر حریم خصوصی غیرفعال شد");
                      }}
                      className={`w-full h-10 px-3 rounded-xl flex items-center justify-between text-xs font-bold transition-colors ${
                        privacyShieldActive ? "text-emerald-700 bg-emerald-50 border border-emerald-200" : "surface-raised text-slate-600"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <i className={`fa-solid ${privacyShieldActive ? "fa-shield-halved" : "fa-lock-open"} text-sm`}></i>
                        <span>{privacyShieldActive ? t.lblPrivacyActive : t.lblPrivacyInactive}</span>
                      </div>
                      <span className={`w-2.5 h-2.5 rounded-full ${privacyShieldActive ? "bg-emerald-500" : "bg-slate-300"}`} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Footer of Drawer */}
            <div className="pt-4 border-t border-teal-900/10 space-y-3">
              {/* Language Pills */}
              <div className="flex items-center justify-center surface-inset p-1 rounded-xl gap-1 h-10">
                {(["ar", "fa", "en"] as const).map((lang) => (
                  <Button
                    key={lang}
                    size="sm"
                    variant={currentLang === lang ? "primary" : "tertiary"}
                    className={`flex-1 h-8 text-xs font-bold ${currentLang !== lang ? "text-slate-500 hover:text-slate-800" : ""}`}
                    onPress={async () => {
                      setCurrentLang(lang);
                      if (lang === "fa" || lang === "ar") {
                        localStorage.setItem("khandan_lang", lang);
                        await persistLanguage(lang);
                      }
                    }}
                  >
                    {lang === "ar" ? "العربية" : lang === "fa" ? "فارسی" : "English"}
                  </Button>
                ))}
              </div>

              {/* Login / Logout */}
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  if (loggedIn) {
                    handleLogout();
                    showToast(currentLang === "fa" ? "خارج شدید." : "Logged out.");
                  } else {
                    setShowLogin(true);
                  }
                }}
                className={`w-full h-10 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all shadow-sm ${
                  loggedIn
                    ? "surface-inset text-rose-700 hover:bg-rose-50"
                    : "bg-teal-800 text-white hover:bg-teal-900"
                }`}
              >
                <i className={`fa-solid ${loggedIn ? "fa-arrow-right-from-bracket" : "fa-arrow-right-to-bracket"} text-sm`}></i>
                <span>{loggedIn ? t.btnLogout : t.btnLogin}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Viewport / Canvas ───────────────────────────────────────────── */}
      <main
        ref={viewportRef}
        onMouseDown={handleMouseDown}
        className={`flex-1 w-full h-full relative overflow-hidden select-none touch-none ${
          isDraggingCanvas ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        <div
          ref={canvasRef}
          id="genealogy-canvas"
          className={`absolute top-0 left-0 origin-center ${exportGrid ? "canvas-grid" : ""}`}
          style={{
            width: "5000px",
            height: "5000px",
            transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
            transition: isDraggingCanvas ? "none" : "transform 0.25s cubic-bezier(0.2,0,0.2,1)",
          }}
        >
          {/* SVG Connection Lines */}
          <svg className="absolute inset-0 pointer-events-none w-full h-full svg-drop-shadow overflow-visible">
            {/* Spouse connector lines */}
            {layoutMarriageNodes.map((mNode) => {
              const husb = membersMap.get(mNode.husband);
              const wf = membersMap.get(mNode.wife);
              if (!husb?.assigned || !wf?.assigned) return null;
              if (Math.abs(husb.y - wf.y) > 8) return null;

              // Both not yet born → fully hidden
              if (!wasEverBorn(husb, activeYear) && !wasEverBorn(wf, activeYear)) return null;

              const husbAlive = isAliveInYear(husb, activeYear);
              const wfAlive = isAliveInYear(wf, activeYear);
              // If either spouse was alive OR at least deceased (not hidden): show at 50% if deceased pair
              const bothDeceased = wasEverBorn(husb, activeYear) && wasEverBorn(wf, activeYear) && !husbAlive && !wfAlive;
              const lineOpacity = (husbAlive && wfAlive) ? 1 : bothDeceased ? 0.5 : 0.6;

              const leftSpouse = husb.x <= wf.x ? husb : wf;
              const rightSpouse = husb.x <= wf.x ? wf : husb;

              return (
                <line
                  key={`spouse-${mNode.id}`}
                  x1={leftSpouse.x + CARD_W}
                  y1={leftSpouse.y + CARD_H / 2}
                  x2={rightSpouse.x}
                  y2={rightSpouse.y + CARD_H / 2}
                  stroke="#0F766E"
                  strokeWidth="3"
                  strokeLinecap="round"
                  opacity={lineOpacity}
                  style={{ transition: "opacity 0.4s" }}
                />
              );
            })}

            {/* Parent → child bezier curves */}
            {layoutMembers.map((child) => {
              if (!child.assigned || !child.parentMarriageNode) return null;
              if (hiddenByCollapse.has(child.id)) return null;
              const mNodeIndex = layoutMarriageNodes.findIndex((m) => m.id === child.parentMarriageNode);
              if (mNodeIndex === -1) return null;
              const mNode = layoutMarriageNodes[mNodeIndex];

              // Child not yet born → completely hide the line
              if (!wasEverBorn(child, activeYear)) return null;

              const startX = mNode.x;
              const startY = mNode.y;
              const endX = child.x + CARD_W / 2;
              const endY = child.y;

              const husb = membersMap.get(mNode.husband);
              const wf = membersMap.get(mNode.wife);
              const childAlive = isAliveInYear(child, activeYear);
              const parentAlive =
                (husb ? isAliveInYear(husb, activeYear) : false) ||
                (wf ? isAliveInYear(wf, activeYear) : false);
              const lineOpacity = childAlive || parentAlive ? 1 : 0.5;

              return (
                <path
                  key={`child-${child.id}`}
                  d={childConnectorPath(startX, startY, endX, endY, mNodeIndex)}
                  stroke="#0D9488"
                  strokeWidth="2.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={lineOpacity}
                  style={{ transition: "opacity 0.4s" }}
                />
              );
            })}
          </svg>

          {/* Interactive Cards & Marriage Nodes */}
          <div className="absolute inset-0 pointer-events-auto">
            {/* Marriage center nodes */}
            {layoutMarriageNodes.map((mNode) => {
              const husb = membersMap.get(mNode.husband);
              const wf = membersMap.get(mNode.wife);
              const isCouple = !!(mNode.husband && mNode.wife);

              // Hide if neither spouse was ever born by activeYear
              const husbEverBorn = husb ? wasEverBorn(husb, activeYear) : false;
              const wfEverBorn = wf ? wasEverBorn(wf, activeYear) : false;
              if (!husbEverBorn && !wfEverBorn) return null;

              const isNodeAlive =
                (husb ? isAliveInYear(husb, activeYear) : false) ||
                (wf ? isAliveInYear(wf, activeYear) : false);
              const nodeOpacity = isNodeAlive ? 1 : 0.5;

              const isCollapsed = collapsedMarriages.has(mNode.id);
              const hasChildren = layoutMembers.some(
                (m) => m.parentMarriageNode === mNode.id,
              );

              return (
                <div
                  key={mNode.id}
                  className="absolute z-10 flex items-center gap-1 transform -translate-x-1/2 -translate-y-1/2 export-hidden"
                  style={{
                    left: `${mNode.x}px`,
                    top: `${mNode.y}px`,
                    opacity: nodeOpacity,
                  }}
                >
                  {hasChildren && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMarriageCollapse(mNode.id);
                      }}
                      className="w-7 h-7 rounded-full surface-inset flex items-center justify-center text-[10px] text-slate-500 hover:text-teal-700"
                      title={isCollapsed ? t.btnExpand : t.btnCollapse}
                    >
                      <i className={`fa-solid ${isCollapsed ? "fa-plus" : "fa-minus"}`}></i>
                    </button>
                  )}
                  {effectiveCanEdit && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!loggedIn) { setShowLogin(true); return; }
                        openAddChildToMarriageModal(mNode.id);
                      }}
                      className="w-9 h-9 rounded-full surface-inset flex items-center justify-center border border-white/50 text-slate-400 hover:text-teal-700 hover:bg-white/50 transition-all"
                      title={isCouple ? "Add Child to Couple" : "Add Child to Parent"}
                    >
                      <i className={`fa-solid ${isCouple ? "fa-ring" : "fa-plus"} text-xs text-teal-700/80`}></i>
                    </button>
                  )}
                </div>
              );
            })}

            {/* Member cards */}
            {layoutMembers.map((member) => {
              if (!member.assigned) return null;
              if (hiddenByCollapse.has(member.id)) return null;
              if (lifeFilter === "alive" && member.death !== "living") return null;
              if (lifeFilter === "deceased" && member.death === "living") return null;

              const visibility = getMemberVisibility(member, activeYear);
              const lifespan = member.death === "living" ? `${member.birth}` : `${member.birth} - ${member.death}`;
              const displayName = formatMemberPrimaryName(member, currentLang);
              const memberAvatar = avatarUrl(member.avatar);

              return (
                <div
                  key={member.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isDraggingCanvas) return;
                    if (hasDraggedRef.current) return;
                    if (visibility.pointerEvents === "none") return;
                    setSelectedProfileId(member.id);
                  }}
                  className="tree-card absolute surface-raised rounded-2xl flex flex-col cursor-pointer hover:scale-[1.02] transition-all duration-300"
                  style={{
                    left: `${member.x}px`,
                    top: `${member.y}px`,
                    width: `${CARD_W}px`,
                    opacity: visibility.opacity,
                    filter: visibility.filter,
                    pointerEvents: visibility.pointerEvents as React.CSSProperties["pointerEvents"],
                    transition: "opacity 0.4s, filter 0.4s, transform 0.3s",
                  }}
                >
                  {/* Card Header */}
                  <div className="flex items-center gap-3 px-4 pt-3 pb-2">
                    <div className="w-10 h-10 rounded-full surface-inset flex items-center justify-center text-base relative overflow-hidden flex-shrink-0">
                      {member.gender === "f" ? (
                        <>
                          <svg className="w-4 h-4 text-teal-800/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="8" r="5" />
                            <line x1="12" y1="13" x2="12" y2="21" />
                            <line x1="9" y1="17" x2="15" y2="17" />
                          </svg>
                          {shouldBlurMember(member) && (
                            <div className="absolute inset-0 privacy-blur flex items-center justify-center" title={currentLang === "fa" ? "حریم خصوصی فعال — قفل حذف نیست" : "Privacy blur — not a delete lock"}>
                              <i className="fa-solid fa-lock text-[9px] text-teal-800 animate-pulse"></i>
                            </div>
                          )}
                        </>
                      ) : (
                        <svg className="w-4 h-4 text-teal-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="10" cy="14" r="5" />
                          <line x1="19" y1="5" x2="13.6" y2="10.4" />
                          <polyline points="15 5 19 5 19 9" />
                        </svg>
                      )}
                      {memberAvatar && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={memberAvatar}
                          crossOrigin="anonymous"
                          alt=""
                          className={`absolute inset-0 w-full h-full object-cover ${shouldBlurMember(member) ? "privacy-blur" : ""}`}
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = "none";
                          }}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[12px] font-bold text-slate-800 leading-tight truncate font-display">{displayName}</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-mono tracking-tight" dir="ltr">
                        {lifespan}
                      </p>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="px-3 pb-3 pt-1.5 border-t border-teal-900/8 flex items-center justify-between gap-2">
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-md surface-inset truncate flex-1 ${
                        member.death === "living" ? "text-emerald-700" : "text-slate-500"
                      }`}
                    >
                      {member.death === "living"
                        ? currentLang === "en" ? "Alive" : currentLang === "fa" ? "در قید حیات" : "على قيد الحياة"
                        : `${currentLang === "en" ? "†" : currentLang === "fa" ? "وفات" : "وفاة"} ${member.death}`}
                    </span>
                    {effectiveCanEdit && (
                      <div className="tree-card-actions flex gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddChildToMember(member.id);
                          }}
                          className="w-6 h-6 rounded-lg surface-raised flex items-center justify-center text-[10px] text-teal-700"
                          title={currentLang === "fa" ? "افزودن فرزند" : "Add Child"}
                        >
                          <i className="fa-solid fa-baby"></i>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditMemberModal(member.id);
                          }}
                          className="w-6 h-6 rounded-lg surface-raised flex items-center justify-center text-[10px] text-slate-500"
                          title={currentLang === "fa" ? "ویرایش" : "Edit"}
                        >
                          <i className="fa-solid fa-pencil"></i>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCardDeleteId(member.id);
                          }}
                          className="w-6 h-6 rounded-lg surface-raised flex items-center justify-center text-[10px] text-rose-600"
                          title={t.btnDelete}
                        >
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* ── Sidebar Toggle ──────────────────────────────────────────────── */}
      {adminMode && (
        <button
          onClick={() => {
            setIsSidebarHidden(false);
            setIsMobileToolsOpen(true);
          }}
          className={`fixed top-1/2 -translate-y-1/2 z-40 w-8 h-16 neo-embossed items-center justify-center transition-all duration-500 pointer-events-auto ${
            currentLang === "en" ? "left-0 rounded-r-xl" : "right-0 rounded-l-xl"
          } ${isZenMode ? "hidden" : "hidden md:flex"} ${
            isSidebarHidden ? "md:opacity-100 md:pointer-events-auto" : "md:opacity-0 md:pointer-events-none"
          }`}
          aria-label={t.sidebarTitle}
        >
          <i className={`fa-solid ${currentLang === "en" ? "fa-chevron-right" : "fa-chevron-left"} text-gray-500`}></i>
        </button>
      )}

      {/* ── Sidebar (Tools) ───────────────────────────────────────────────── */}
      {adminMode && (
        <aside
          id="tools-sidebar"
          className={`fixed top-20 bottom-24 left-3 right-3 md:top-28 md:bottom-[110px] md:w-72 z-30 flex flex-col pointer-events-none transition-all duration-500 ease-in-out ${
            currentLang === "en" ? "md:right-auto md:left-4" : "md:left-auto md:right-4"
          } ${isZenMode || !isMobileToolsOpen ? "invisible opacity-0 translate-y-8" : "visible opacity-100 translate-y-0"} ${
            isZenMode || isSidebarHidden
              ? currentLang === "en"
                ? "md:invisible md:-translate-x-96 md:translate-y-0 md:opacity-0"
                : "md:invisible md:translate-x-96 md:translate-y-0 md:opacity-0"
              : "md:visible md:translate-x-0 md:translate-y-0 md:opacity-100"
          }`}
        >
          <div className="pointer-events-auto w-full h-full surface-panel p-5 rounded-3xl flex flex-col overflow-y-auto isolate border border-white/50">
            <PanelHeader
              className="mb-3 pb-3 border-b border-teal-900/10"
              onClose={() => {
                setIsSidebarHidden(true);
                setIsMobileToolsOpen(false);
              }}
              closeLabel={currentLang === "fa" ? "بستن" : currentLang === "ar" ? "إغلاق" : "Close"}
              title={
                <div className="flex items-center gap-2 min-w-0">
                  <i className="fa-solid fa-toolbox text-teal-700 text-lg shrink-0"></i>
                  <h2 className="font-display font-bold text-slate-700 text-base truncate">{t.sidebarTitle}</h2>
                </div>
              }
              trailing={
                <span className="px-2 py-0.5 text-xs font-bold surface-inset rounded-full text-teal-800 font-mono shrink-0">
                  {totalCount}
                </span>
              }
            />

            <p className="text-xs text-slate-500 mb-4 leading-relaxed shrink-0">{t.sidebarDesc}</p>

            {!isMemberRole && (
            <div className="md:hidden mb-3 p-2.5 rounded-2xl surface-inset space-y-2 shrink-0">
              <Select
                aria-label={t.sidebarViewer}
                value={activeViewerId || null}
                onChange={(value) => {
                  if (!loggedIn) {
                    setShowLogin(true);
                    return;
                  }
                  const id = value ? String(value) : "";
                  setActiveViewerId(id);
                  localStorage.setItem("khandan_viewer_id", id);
                  setMahramCache({});
                }}
                placeholder={t.sidebarViewer}
              >
                <Label className="text-[10px] font-bold text-slate-500">{t.sidebarViewer}</Label>
                <Select.Trigger className="h-9 rounded-xl surface-raised text-[11px] px-2">
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover className="max-h-64 overflow-y-auto">
                  <ListBox>
                    {familyMembers.filter((member) => member.assigned).map((member) => (
                      <ListBox.Item key={member.id} id={member.id} textValue={memberDisplayLabel(member)}>
                        {memberDisplayLabel(member)}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setPrivacyShieldActive((active) => !active)}
                  className={`h-9 px-3 rounded-xl surface-raised flex items-center gap-2 text-[11px] font-bold ${
                    privacyShieldActive ? "text-emerald-700" : "text-slate-500"
                  }`}
                >
                  <i className={`fa-solid ${privacyShieldActive ? "fa-shield-halved" : "fa-lock-open"}`}></i>
                  {privacyShieldActive ? t.lblPrivacyActive : t.lblPrivacyInactive}
                </button>
                <div className="flex items-center gap-1">
                  {(["ar", "fa", "en"] as const).map((lang) => (
                    <Button
                      key={lang}
                      size="sm"
                      variant={currentLang === lang ? "primary" : "tertiary"}
                      className="min-w-8 h-8 px-2 text-[10px] font-bold"
                      onPress={async () => {
                        setCurrentLang(lang);
                        if (lang !== "en") {
                          localStorage.setItem("khandan_lang", lang);
                          await persistLanguage(lang);
                        }
                      }}
                    >
                      {lang === "ar" ? "ع" : lang === "fa" ? "فا" : "EN"}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            )} {/* end !isMemberRole mobile viewer picker */}

            <button
              type="button"
              onClick={() => setIsKinshipOpen(true)}
              className="w-full py-3 rounded-xl surface-raised text-teal-800 font-bold text-xs flex items-center justify-center gap-2 mb-3 shrink-0"
            >
              <i className="fa-solid fa-diagram-project"></i>
              <span>{t.sidebarKinship}</span>
            </button>
            
            <button
              type="button"
              onClick={() => setIsGuideOpen(true)}
              className="w-full py-3 rounded-xl surface-raised text-teal-800 font-bold text-xs flex items-center justify-center gap-2 mb-3 shrink-0"
            >
              <i className="fa-solid fa-book-open"></i>
              <span>{t.sidebarGuide}</span>
            </button>

            <div className="flex flex-col gap-2 shrink-0">
              {adminMode && (
              <button
                type="button"
                onClick={() => setListModalMode("pool")}
                className="w-full py-3 px-3 rounded-xl surface-raised text-start flex items-center gap-3"
                title={t.openPoolList}
              >
                <div className="w-9 h-9 rounded-xl surface-inset flex items-center justify-center text-teal-800 shrink-0">
                  <i className="fa-solid fa-inbox"></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-700 truncate">{t.poolTitle}</p>
                  <p className="text-[10px] text-slate-400">{t.openPoolList}</p>
                </div>
                <span className="px-2 py-0.5 text-[11px] font-mono font-bold surface-inset rounded-full text-teal-800 shrink-0">
                  {unlinkedPool.length}
                </span>
              </button>
            )}

              <button
                type="button"
                onClick={() => setListModalMode("members")}
                className="w-full py-3 px-3 rounded-xl surface-raised text-start flex items-center gap-3"
                title={t.openMembersList}
              >
                <div className="w-9 h-9 rounded-xl surface-inset flex items-center justify-center text-teal-800 shrink-0">
                  <i className="fa-solid fa-users"></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-700 truncate">{t.membersListTitle}</p>
                  <p className="text-[10px] text-slate-400">{t.openMembersList}</p>
                </div>
                <span className="px-2 py-0.5 text-[11px] font-mono font-bold surface-inset rounded-full text-teal-800 shrink-0">
                  {activePool.length}
                </span>
              </button>
            </div>

            {isLoadingData && (
              <div className="mt-4 flex items-center justify-center text-gray-400 text-xs">
                <i className="fa-solid fa-spinner fa-spin me-2"></i>
                ...
              </div>
            )}
          </div>
        </aside>
      )}

      {/* ── Unified Mobile Control Dock (lg:hidden) ── */}
      {!isZenMode && (
        <div className="lg:hidden fixed bottom-3 left-1/2 -translate-x-1/2 z-40 pointer-events-auto flex flex-col items-center gap-2 max-w-[96vw]">
          {/* Mobile Timeline Expandable Popover */}
          {!isMemberRole && isTimelineExpanded && (
            <div className="w-[calc(100vw-2rem)] max-w-sm surface-panel p-3.5 rounded-2xl border border-white/50 shadow-2xl backdrop-blur-md transition-all">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-200/50">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <i className="fa-solid fa-hourglass-half text-teal-700"></i>
                  {t.timelineLabel}
                </span>
                <span className="px-2 py-0.5 rounded-full surface-inset text-teal-800 font-bold text-xs font-mono tabular-nums">
                  {activeYear}
                </span>
                <button
                  type="button"
                  onClick={() => setIsTimelineExpanded(false)}
                  className="w-6 h-6 rounded-lg surface-inset flex items-center justify-center text-slate-400 hover:text-slate-700 active:scale-95"
                  aria-label="Close timeline"
                >
                  <i className="fa-solid fa-xmark text-xs"></i>
                </button>
              </div>
              <div dir="ltr" className="pt-1 pb-1">
                <Slider
                  className="w-full"
                  minValue={minYear}
                  maxValue={maxYear}
                  step={1}
                  value={activeYear}
                  onChange={(v) => {
                    const next = Array.isArray(v) ? v[0] : v;
                    setActiveYear(Number(next));
                  }}
                  formatOptions={{ useGrouping: false, maximumFractionDigits: 0 }}
                  aria-label={t.timelineLabel}
                >
                  <Slider.Track>
                    <Slider.Fill />
                    <Slider.Thumb />
                  </Slider.Track>
                </Slider>
                <div className="flex justify-between mt-1 px-0.5">
                  <span className="text-[10px] text-gray-500 font-bold font-mono tabular-nums">{minYear}</span>
                  <span className="text-[10px] text-gray-500 font-bold">{t.timelineCurrent}</span>
                </div>
              </div>
            </div>
          )}

          {/* Unified Dock Pill */}
          <div className="surface-panel px-2.5 py-1.5 rounded-2xl flex items-center gap-1.5 border border-white/60 shadow-xl backdrop-blur-md">
            {/* Quick Add Member (for Admin / Editor) */}
            {effectiveCanEdit && (
              <>
                <button
                  type="button"
                  onClick={() => (loggedIn ? openAddMemberModal() : setShowLogin(true))}
                  className="w-8 h-8 rounded-xl bg-teal-800 text-white shadow-sm flex items-center justify-center hover:bg-teal-900 active:scale-95 transition-transform"
                  aria-label={t.btnAdd}
                  title={t.btnAdd}
                >
                  <i className="fa-solid fa-user-plus text-xs"></i>
                </button>
                <div className="w-px h-4 bg-slate-300 mx-0.5" />
              </>
            )}

            {/* Zoom Controls */}
            <button
              type="button"
              onClick={() => adjustZoom(-0.1)}
              className="w-7 h-7 rounded-lg surface-raised flex items-center justify-center text-slate-700 active:scale-95 transition-transform"
              aria-label="Zoom Out"
              title="Zoom Out"
            >
              <i className="fa-solid fa-minus text-[10px]"></i>
            </button>
            <span className="text-xs font-bold px-1 min-w-[34px] text-center text-slate-700 font-mono tabular-nums">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => adjustZoom(0.1)}
              className="w-7 h-7 rounded-lg surface-raised flex items-center justify-center text-slate-700 active:scale-95 transition-transform"
              aria-label="Zoom In"
              title="Zoom In"
            >
              <i className="fa-solid fa-plus text-[10px]"></i>
            </button>
            <button
              type="button"
              onClick={resetZoom}
              className="w-7 h-7 rounded-lg surface-inset flex items-center justify-center text-teal-700 active:scale-95 transition-transform"
              aria-label="Recenter"
              title="Recenter"
            >
              <i className="fa-solid fa-arrows-to-dot text-xs"></i>
            </button>

            {/* Divider */}
            <div className="w-px h-4 bg-slate-300 mx-0.5" />

            {/* Timeline Toggle Chip */}
            {!isMemberRole && (
              <button
                type="button"
                onClick={() => setIsTimelineExpanded((prev) => !prev)}
                className={`h-7 px-2 rounded-lg flex items-center gap-1 text-[11px] font-bold font-mono transition-colors active:scale-95 ${
                  isTimelineExpanded
                    ? "bg-teal-800 text-white shadow-sm"
                    : "surface-raised text-slate-700 hover:text-teal-800"
                }`}
                title={t.timelineLabel}
              >
                <i className="fa-solid fa-hourglass-half text-[10px]"></i>
                <span className="tabular-nums">{activeYear}</span>
              </button>
            )}

            {/* Members List / Stats Chip */}
            <button
              type="button"
              onClick={() => setListModalMode("members")}
              className="h-7 px-2 rounded-lg surface-raised flex items-center gap-1.5 text-[11px] font-bold text-slate-700 hover:text-teal-800 active:scale-95 transition-colors"
              title={t.membersListTitle}
            >
              <i className="fa-solid fa-users text-teal-700 text-[10px]"></i>
              <span className="font-mono tabular-nums text-teal-800 font-bold">{totalCount}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Desktop Footer Toggle ────────────────────────────────────────── */}
      <button
        onClick={() => setIsFooterHidden(false)}
        className={`hidden lg:flex fixed bottom-0 left-1/2 -translate-x-1/2 z-40 w-16 h-8 neo-embossed rounded-t-xl transition-all duration-500 pointer-events-auto items-center justify-center ${
          isZenMode || !isFooterHidden ? "opacity-0 pointer-events-none" : "opacity-100 translate-y-0"
        }`}
      >
        <i className="fa-solid fa-chevron-up text-gray-500"></i>
      </button>

      {/* ── Desktop Footer ──────────────────────────────────────────────── */}
      <footer
        className={`hidden lg:flex fixed bottom-2 md:bottom-4 left-1/2 -translate-x-1/2 z-40 flex-col gap-2 md:gap-3 items-center justify-end pointer-events-none transition-all duration-500 ease-in-out w-[calc(100vw-1rem)] md:w-max max-w-[95vw] ${
          isZenMode || isFooterHidden ? "translate-y-28 opacity-0 scale-95" : "translate-y-0 opacity-100"
        }`}
      >


        {/* Timeline slider — force LTR: HeroUI fill uses physical `left`,
            while accent edge borders use logical start/end (breaks in RTL). */}
        {!isMemberRole && (
        <div className="pointer-events-auto w-full min-w-0 md:min-w-[24rem] max-w-2xl surface-panel px-3 md:px-4 py-2 rounded-2xl border border-white/50 transition-all duration-300">
          <div 
            className="flex items-center justify-between gap-3 cursor-pointer select-none"
            onClick={() => setIsTimelineExpanded(!isTimelineExpanded)}
          >
            <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
              <i className="fa-solid fa-hourglass-half text-teal-700"></i>
              {t.timelineLabel}
              <i className={`fa-solid fa-chevron-${isTimelineExpanded ? 'down' : 'up'} text-[10px] text-slate-400 ms-1 transition-transform`}></i>
            </span>
            <span className="px-2 py-0.5 rounded-full surface-inset text-teal-800 font-bold text-[10px] font-mono tabular-nums">
              {activeYear}
            </span>
          </div>
          
          {isTimelineExpanded && (
            <div dir="ltr" className="pt-3 pb-1 border-t border-gray-200/50 mt-2">
              <Slider
                className="w-full"
                minValue={minYear}
                maxValue={maxYear}
                step={1}
                value={activeYear}
                onChange={(v) => {
                  const next = Array.isArray(v) ? v[0] : v;
                  setActiveYear(Number(next));
                }}
                formatOptions={{ useGrouping: false, maximumFractionDigits: 0 }}
                aria-label={t.timelineLabel}
              >
                <Slider.Track>
                  <Slider.Fill />
                  <Slider.Thumb />
                </Slider.Track>
              </Slider>
              <div className="flex justify-between mt-1 px-0.5">
                <span className="text-[9px] text-gray-500 font-bold font-mono tabular-nums">{minYear}</span>
                <span className="text-[9px] text-gray-500 font-bold">{t.timelineCurrent}</span>
              </div>
            </div>
          )}
        </div>
        )} {/* end !isMemberRole timeline */}

        {/* Labeled stats */}
        <div className="pointer-events-auto surface-panel px-3 py-2 rounded-2xl flex flex-wrap gap-2 items-center border border-white/50 relative">
          <button
            onClick={() => setIsFooterHidden(true)}
            className="w-7 h-7 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors cursor-pointer me-1 shadow-inner shrink-0"
            title="بستن ابزارها"
          >
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
          <Chip size="sm" variant="soft" className="font-mono">
            <span className="hidden sm:inline text-[10px] text-slate-500 me-1">{t.statTotalLabel}</span>
            <span className="font-bold text-teal-800">{totalCount}</span>
          </Chip>
          <Chip size="sm" variant="soft" className="font-mono">
            <span className="hidden sm:inline text-[10px] text-slate-500 me-1">{t.statDeceasedLabel}</span>
            <span className="font-bold text-slate-700">{deceasedCount}</span>
          </Chip>
          <Chip size="sm" variant="soft" className="font-mono">
            <span className="hidden sm:inline text-[10px] text-slate-500 me-1">{t.statRatioLabel}</span>
            <span className="font-bold text-slate-700">
              {malesCount}/{femalesCount}
            </span>
          </Chip>
        </div>
      </footer>

      {/* ── Quick delete confirm (from card / profile) ───────────────────── */}
      {cardDeleteId && (() => {
        const target = familyMembers.find((m) => m.id === cardDeleteId);
        if (!target) return null;
        const hasKids = familyMembers.some((m) => {
          if (!m.parentMarriageNode) return false;
          const mNode = marriageNodes.find((mn) => mn.id === m.parentMarriageNode);
          return mNode && (mNode.husband === cardDeleteId || mNode.wife === cardDeleteId);
        });
        const name = memberDisplayLabel(target);
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm surface-panel p-6 rounded-3xl space-y-4 border border-white/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full neo-debossed flex items-center justify-center text-rose-600">
                  <i className="fa-solid fa-trash"></i>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    {currentLang === "fa"
                      ? `حذف «${name}»؟`
                      : currentLang === "ar"
                      ? `حذف «${name}»؟`
                      : `Delete “${name}”?`}
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {currentLang === "fa"
                      ? "این عمل قابل بازگشت نیست."
                      : currentLang === "ar"
                      ? "لا يمكن التراجع عن هذا الإجراء."
                      : "This cannot be undone."}
                  </p>
                </div>
              </div>
              {hasKids && (
                <p className="text-[11px] text-amber-800 neo-debossed rounded-xl p-3">
                  {currentLang === "fa"
                    ? "فرزندان این عضو به لیست کناری منتقل می‌شوند."
                    : currentLang === "ar"
                    ? "سينتقل الأبناء إلى القائمة الجانبية."
                    : "Children will move to the side list."}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  variant="secondary"
                  isDisabled={isSaving}
                  onPress={() => setCardDeleteId(null)}
                >
                  {t.btnCancel}
                </Button>
                <Button
                  className="flex-1"
                  variant="danger"
                  isDisabled={isSaving}
                  onPress={() => executeDeleteMember(cardDeleteId)}
                >
                  {isSaving ? "..." : t.btnDelete}
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Editor Modal ─────────────────────────────────────────────────── */}
      {isEditorModalOpen && (
        <Modal.Backdrop
          isOpen
          variant="blur"
          onOpenChange={(open) => {
            if (!open) {
              setDeleteConfirmOpen(false);
              setIsEditorModalOpen(false);
            }
          }}
        >
          <Modal.Container placement="center" size="lg" scroll="inside">
            <Modal.Dialog className="surface-panel border border-white/50 rounded-3xl max-h-[calc(100vh-4rem)]">
              <Modal.Header className="flex flex-row items-center gap-3 pb-2">
                <Modal.Heading className="flex-1 min-w-0 font-display text-lg truncate">
                  {editId ? t.modalTitleEdit : t.modalTitleNew}
                </Modal.Heading>
                <CloseButton
                  aria-label={currentLang === "fa" ? "بستن" : currentLang === "ar" ? "إغلاق" : "Close"}
                  className="shrink-0"
                  onPress={() => {
                    setDeleteConfirmOpen(false);
                    setIsEditorModalOpen(false);
                  }}
                />
              </Modal.Header>
              <Modal.Body className="pt-0">
            <MemberEditorForm
              editId={editId}
              lang={currentLang === "en" ? "en" : currentLang === "ar" ? "ar" : "fa"}
              maxYear={maxYear}
              isSaving={isSaving}
              deleteConfirmOpen={deleteConfirmOpen}
              hasChildren={Boolean(
                editId &&
                  familyMembers.some((m) => {
                    if (!m.parentMarriageNode) return false;
                    const mNode = marriageNodes.find((mn) => mn.id === m.parentMarriageNode);
                    return mNode && (mNode.husband === editId || mNode.wife === editId);
                  }),
              )}
              labels={{
                titleEdit: t.modalTitleEdit,
                titleNew: t.modalTitleNew,
                nameAr: t.lblNameAr,
                nameEn: t.lblNameEn,
                birth: t.lblBirth,
                death: t.lblDeath,
                deathPlaceholder: currentLang === "fa" ? "در قید حیات" : currentLang === "ar" ? "على قيد الحياة" : "Living",
                gender: t.lblGender,
                genderMale: t.lblGenderMale,
                genderFemale: t.lblGenderFemale,
                privacy: t.lblPrivacyOpt,
                privacyOn: t.lblPrivacyActive,
                privacyOff: t.lblPrivacyInactive,
                father: t.lblFather,
                mother: t.lblMother,
                noFather: t.lblNoFather,
                noMother: t.lblNoMother,
                bio: t.lblBio,
                mobile: t.lblMobile,
                avatar: t.lblAvatar,
                gallery: t.lblGallery,
                audio: t.lblAudio,
                audioTitle: t.lblAudioTitle,
                spouses: t.lblSpouses,
                spousesFemaleHint:
                  currentLang === "fa"
                    ? "خانم‌ها فقط یک همسر می‌توانند داشته باشند."
                    : currentLang === "ar"
                    ? "يمكن للمرأة زوج واحد فقط."
                    : "Women may have only one husband.",
                noSpouseCandidates:
                  currentLang === "fa" ? "هیچ موردی یافت نشد" : currentLang === "ar" ? "لا توجد نتائج" : "No candidates found",
                cancel: t.btnCancel,
                save: t.btnSave,
                delete: t.btnDelete,
                deleteConfirm:
                  currentLang === "fa"
                    ? "حذف «{name}» قطعی است؟"
                    : currentLang === "ar"
                    ? "تأكيد حذف «{name}»؟"
                    : "Confirm delete “{name}”?",
                deleteChildrenWarn:
                  currentLang === "fa"
                    ? "فرزندان این عضو به لیست کناری منتقل می‌شوند."
                    : currentLang === "ar"
                    ? "سينتقل الأبناء إلى القائمة الجانبية."
                    : "Children will move to the side list.",
              }}
              nameAr={inpNameAr}
              nameEn={inpNameEn}
              birth={inpBirth}
              death={inpDeath}
              gender={inpGender}
              privacy={inpPrivacy}
              bio={inpBio}
              mobile={inpMobile}
              audioTitle={inpAudioTitle}
              fatherId={inpFatherId}
              motherId={inpMotherId}
              spouses={inpSpouses}
              fatherOptions={familyMembers.filter((f) => f.assigned && f.gender === "m" && f.id !== editId)}
              motherOptions={familyMembers.filter((f) => f.assigned && f.gender === "f" && f.id !== editId)}
              spouseCandidates={spouseCandidates}
              labelMembers={familyMembers}
              labelMarriages={marriageNodes}
              onNameAr={setInpNameAr}
              onNameEn={setInpNameEn}
              onBirth={setInpBirth}
              onDeath={setInpDeath}
              onGender={(g) => {
                setInpGender(g);
                if (g === "f" && inpSpousesRef.current.length > 1) {
                  setSpousesSafe(inpSpousesRef.current.slice(0, 1));
                }
              }}
              onPrivacy={setInpPrivacy}
              onBio={setInpBio}
              onMobile={setInpMobile}
              onAudioTitle={setInpAudioTitle}
              onFatherId={setInpFatherId}
              onMotherId={setInpMotherId}
              onSpouses={setSpousesSafe}
              onAvatarFile={setInpAvatarFile}
                existingAvatar={editId && !inpAvatarDeleted ? (familyMembers.find((m) => m.id === editId)?.avatar ? avatarUrl(familyMembers.find((m) => m.id === editId)!.avatar) : null) : null}
                onDeleteAvatar={async () => {
                  setInpAvatarDeleted(true);
                  if (editId) {
                    await updateMember(editId, { avatar: "" });
                    await loadData();
                  }
                }}
              onGalleryFile={setInpGalleryFile}
              onAudioFile={setInpAudioFile}
              onClose={() => {
                setDeleteConfirmOpen(false);
                setIsEditorModalOpen(false);
              }}
              onSubmit={handleFormSubmit}
              onDeleteRequest={requestDeleteMember}
              onDeleteCancel={() => setDeleteConfirmOpen(false)}
              onDeleteConfirm={confirmDeleteMember}
              onSpouseLimitToast={() =>
                showToast(
                  currentLang === "fa"
                    ? "خانم‌ها فقط یک همسر می‌توانند داشته باشند."
                    : currentLang === "ar"
                    ? "يمكن للمرأة زوج واحد فقط."
                    : "Women may have only one husband.",
                )
              }
            />
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      )}

      {/* ── Export Modal ─────────────────────────────────────────────────── */}
      {isExportModalOpen && (
        <Modal.Backdrop
          isOpen
          variant="blur"
          onOpenChange={(open) => {
            if (!open) setIsExportModalOpen(false);
          }}
        >
          <Modal.Container placement="center" size="lg" scroll="inside">
            <Modal.Dialog className="surface-panel border border-white/50 rounded-3xl max-w-2xl">
              <Modal.Header className="flex flex-row items-start gap-3 pb-2">
                <div className="flex-1 min-w-0 text-center">
                  <div className="w-12 h-12 rounded-2xl surface-raised flex items-center justify-center text-emerald-700 text-xl mx-auto mb-1.5 shadow-sm">
                    <i className="fa-solid fa-file-export"></i>
                  </div>
                  <Modal.Heading className="font-display text-lg">{t.exportTitle}</Modal.Heading>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.exportDesc}</p>
                </div>
                <CloseButton
                  aria-label={currentLang === "fa" ? "بستن" : currentLang === "ar" ? "إغلاق" : "Close"}
                  className="shrink-0"
                  onPress={() => setIsExportModalOpen(false)}
                />
              </Modal.Header>
              <Modal.Body className="space-y-4 pt-1">
                <ExportModalContent
                  hierarchy={exportHierarchy}
                  exportStyle={exportStyle}
                  setExportStyle={setExportStyle}
                  exportFormat={exportFormat}
                  setExportFormat={setExportFormat}
                  exportScale={exportScale}
                  setExportScale={setExportScale}
                  exportGrid={exportGrid}
                  setExportGrid={setExportGrid}
                  isExporting={isExporting || customExporting}
                  exportProgress={isExporting ? exportProgress : customExportProgress}
                  onDownload={() => void performActualExport()}
                  currentLang={currentLang}
                />
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      )}

      {/* ── Guide Modal ────────────────────────────────────────────────────────── */}
      {isGuideOpen && (
        <Modal.Backdrop
          isOpen
          variant="blur"
          onOpenChange={(open) => {
            if (!open) setIsGuideOpen(false);
          }}
        >
          <Modal.Container placement="center" size="lg" scroll="inside">
            <Modal.Dialog className="surface-panel border border-white/50 rounded-3xl">
              <Modal.Header className="flex flex-row items-center gap-3">
                <div className="w-10 h-10 rounded-full surface-raised flex items-center justify-center text-teal-700 text-lg shrink-0">
                  <i className="fa-solid fa-book-open"></i>
                </div>
                <div className="flex-1 min-w-0 text-start">
                  <Modal.Heading className="font-display">{t.sidebarGuide}</Modal.Heading>
                </div>
                <CloseButton
                  aria-label={currentLang === "fa" ? "بستن" : currentLang === "ar" ? "إغلاق" : "Close"}
                  className="shrink-0"
                  onPress={() => setIsGuideOpen(false)}
                />
              </Modal.Header>
              <Modal.Body className="space-y-4">
                <div className="surface-inset p-5 rounded-2xl text-sm text-gray-700 leading-relaxed text-right font-sans space-y-6" dir="rtl">
                  <div className="border-b border-teal-900/10 pb-3">
                    <h3 className="text-xl font-bold text-teal-900 font-display">دفترچه راهنمای جامع مدیریت و کاربری شجره‌نامه خاندان نجف</h3>
                    <p className="text-xs text-slate-500 mt-1">نسخه نهایی به‌روزشده همراه با راهنمای سطوح دسترسی، حساب‌های کاربری خودکار و حفظ حریم خصوصی</p>
                  </div>

                  {/* بخش ۱: سطوح دسترسی کاربران */}
                  <div className="bg-white/80 p-4 rounded-2xl border border-teal-100/80 shadow-sm space-y-2">
                    <h4 className="font-bold text-teal-800 flex items-center gap-2">
                      <i className="fa-solid fa-user-shield text-teal-600"></i>
                      <span>۱. سطوح دسترسی و انواع کاربران</span>
                    </h4>
                    <ul className="list-disc pr-5 space-y-2 text-xs text-slate-700">
                      <li>
                        <strong>مدیر سامانه (Admin):</strong>
                        دسترسی کامل و نامحدود به تمامی قابلیت‌ها شامل: ایجاد، ویرایش و حذف اعضا، ایجاد پیوندهای ازدواج، مدیریت کاربران و نقش‌ها، دسترسی به تایم‌لاین سفر در زمان، انتخاب آزادانه دیدگاه محرمیت از دید هر فرد دلخواه، و خروجی چاپی با بالاترین رزولوشن.
                      </li>
                      <li>
                        <strong>اعضای محترم خاندان (نقش Member / فقط مشاهده):</strong>
                        ویژه کلیه اعضای فامیل. این کاربران فقط امکان <strong>مشاهده درخت شجره‌نامه</strong> و <strong>محاسبه نسبت‌سنجی فامیلی</strong> را دارند. دیدگاه محرمیت به‌صورت هوشمند روی خود آن عضو قفل است (تمام بانوان نامحرم تار می‌شوند)، و بخش‌های سفر در زمان، خروجی/چاپ، ویرایش و تغییر دیدگاه ناظر برای ایشان مسدود و مخفی است.
                      </li>
                    </ul>
                  </div>

                  {/* بخش ۲: ساخت خودکار حساب کاربری و رمزهای ورود */}
                  <div className="bg-white/80 p-4 rounded-2xl border border-teal-100/80 shadow-sm space-y-2">
                    <h4 className="font-bold text-teal-800 flex items-center gap-2">
                      <i className="fa-solid fa-key text-teal-600"></i>
                      <span>۲. ساخت خودکار حساب کاربری و رمزهای عبور</span>
                    </h4>
                    <ul className="list-disc pr-5 space-y-2 text-xs text-slate-700">
                      <li>
                        <strong>نام کاربری (Username = نام انگلیسی):</strong>
                        هنگامی که ادمین در فرم عضو جدید، فیلد <strong>«نام انگلیسی»</strong> را پر می‌کند (مثلاً <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-teal-800">ali.najaf</code> یا <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-teal-800">hadi</code>)، سامانه به‌صورت همزمان و خودکار حساب کاربری فرد را با همان نام انگلیسی می‌سازد. در صورت تشابه اسمی در فامیل، سیستم خودکار شماره به انتهای نام کاربری می‌افزاید.
                      </li>
                      <li>
                        <strong>رمز عبور پیش‌فرض (Default Password):</strong>
                        رمز عبور اولیه تمامی اعضای جدید عدد <code className="bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded font-mono text-sm">110</code> است.
                      </li>
                      <li>
                        <strong>تغییر رمز عبور توسط خود عضو:</strong>
                        هنگامی که عضو برای اولین بار با رمز ۱۱۰ وارد شود، یک پنجره پاپ‌آپ هشدار داده و از او می‌خواهد رمز پیش‌فرض خود را تغییر دهد (اختیاری است و می‌تواند دکمه «بعداً» را بزند). همچنین دکمه <strong>«تغییر رمز»</strong> با آیکون کلید همیشه در نوار بالای سایت در دسترس اوست.
                      </li>
                    </ul>
                  </div>

                  {/* بخش ۳: سیستم پیشرفته محرمیت و حفظ حریم خصوصی */}
                  <div className="bg-white/80 p-4 rounded-2xl border border-teal-100/80 shadow-sm space-y-2">
                    <h4 className="font-bold text-teal-800 flex items-center gap-2">
                      <i className="fa-solid fa-shield-halved text-teal-600"></i>
                      <span>۳. قوانین شرعی محرمیت و تار شدن چهره‌ها</span>
                    </h4>
                    <ul className="list-disc pr-5 space-y-2 text-xs text-slate-700">
                      <li>
                        به محض ورود هر عضو به سامانه، سیستم تمامی پیوندهای نسبی و سببی او را در گراف فامیلی محاسبه می‌کند.
                      </li>
                      <li>
                        تصویر چهره تمامی <strong>بانوان نامحرم</strong> نسبت به آن عضو، هم روی کارت‌های بوم و هم در سایدبار پروفایل و گالری، به‌صورت خودکار تار (Blur) و همراه با آیکون قفل نمایش می‌یابد و بزرگنمایی تصویر برای نامحرم کاملاً مسدود است.
                      </li>
                      <li>
                        کاربر عضو امکان تغییر دادن فرد ناظر را ندارد تا محرمیت شرعی و خانوادگی تحت هیچ شرایطی نقض نشود.
                      </li>
                    </ul>
                  </div>

                  {/* بخش ۴: نسبت‌سنج فامیلی */}
                  <div className="bg-white/80 p-4 rounded-2xl border border-teal-100/80 shadow-sm space-y-2">
                    <h4 className="font-bold text-teal-800 flex items-center gap-2">
                      <i className="fa-solid fa-diagram-project text-teal-600"></i>
                      <span>۴. ابزار نسبت‌سنج فامیلی</span>
                    </h4>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      با کلیک بر روی دکمه <strong>«نسبت‌سنج»</strong> در نوار بالای صفحه، پنجره‌ای باز می‌شود که می‌توانید هر دو عضو دلخواه از خاندان را انتخاب کنید (مثلاً «طه نجف» با «هادی»)؛ سیستم دقیق‌ترین مسیر و عنوان نسبت خویشاوندی (مانند عموزاده، دایی، خاله و...) را بر اساس فقه و عرف فارسی/عربی محاسبه و نشان می‌دهد.
                    </p>
                  </div>

                  {/* بخش ۵: مراحل اصولی ایجاد و اتصال اعضا (راهنمای ادمین) */}
                  <div className="bg-white/80 p-4 rounded-2xl border border-teal-100/80 shadow-sm space-y-2">
                    <h4 className="font-bold text-teal-800 flex items-center gap-2">
                      <i className="fa-solid fa-sitemap text-teal-600"></i>
                      <span>۵. نحوه صحیح ایجاد و پیوند اعضا در شجره‌نامه</span>
                    </h4>
                    <p className="text-xs text-slate-600">همیشه برای تشکیل یک ساختار هندسی بی‌نقص، روش دومرحله‌ای زیر را رعایت کنید:</p>
                    <ol className="list-decimal pr-5 space-y-1.5 text-xs text-slate-700">
                      <li>
                        <strong>مرحله اول (ایجاد اولیه افراد):</strong> ابتدا هر فرد (پدر، مادر، فرزند) را جداگانه از طریق دکمه «افزودن عضو جدید» ثبت کنید (در این مرحله هنوز پدر یا مادر برای فرزند انتخاب نکنید).
                      </li>
                      <li>
                        <strong>مرحله دوم (اتصال روابط):</strong> روی کارت فرزند کلیک کرده، دکمه «ویرایش» را بزنید و در بخش «پدر» نام پدر، و در بخش «مادر» نام مادر را انتخاب کرده و ذخیره نمایید.
                      </li>
                      <li>
                        <strong>فیلتر هوشمند همسران:</strong> به محض اینکه پدری را انتخاب می‌کنید، در منوی مادر فقط همسران ثبت‌شده‌ی همان پدر ظاهر می‌شوند تا خطای انسانی در پیوندها به صفر برسد.
                      </li>
                    </ol>
                  </div>

                  {/* بخش ۶: راهنمای انواع خروجی و سبک‌های چیدمان */}
                  <div className="bg-white/80 p-4 rounded-2xl border border-teal-100/80 shadow-sm space-y-3">
                    <h4 className="font-bold text-teal-800 flex items-center gap-2">
                      <i className="fa-solid fa-file-export text-teal-600"></i>
                      <span>۶. راهنمای خروجی باکیفیت و سبک‌های چیدمان (خورشیدی، متقارن، درختی)</span>
                    </h4>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      با کلیک بر روی دکمه <strong>«خروجی باکیفیت»</strong> (در نوار بالای سامانه یا منوی کشویی موبایل)، سامانه امکان تهیه نسخه چاپی و تصویری با وضوح فوق‌العاده بالا را در ۳ سبک متنوع در اختیار شما قرار می‌دهد:
                    </p>
                    <ul className="list-disc pr-5 space-y-2.5 text-xs text-slate-700">
                      <li>
                        <strong className="text-amber-700">☀️ نمودار خورشیدی (Sunburst مدور ۳۶۰ درجه):</strong>
                        طراحی حلقوی هم‌مرکز الهام‌گرفته از معتبرترین شجره‌نامه‌های جهانی (نظیر MyHeritage)؛ بزرگ خاندان در هسته مرکزی و فرزندان، همسران، نوه‌ها و نبیره‌ها در لایه‌های حلقوی پیرامون قرار می‌گیرند.
                        <br />
                        <span className="text-slate-500">
                          <strong>مزیت ویژه:</strong> استفاده ۱۰۰ درصدی از فضا بدون کشیدگی افقی؛ بهترین انتخاب برای موبایل و چاپ کتیبه‌های دایره‌ای روی دیوار یا تابلو. سیستم به‌صورت هوشمند جهت متون نیم‌کره چپ را ۱۸۰ درجه اصلاح کرده تا کلمات فارسی/عربی کاملاً خوانا و افقی باشند.
                        </span>
                      </li>
                      <li>
                        <strong className="text-emerald-700">🌿 نمودار متقارن دوطرفه (Bi-directional Mindmap):</strong>
                        توزیع متعادل و متقارن شاخه‌های شجره‌نامه به دو سمت چپ و راست با خطوط انحنای نرم بزیه (Bézier) و رنگ‌بندی تفکیک‌شده شاخه‌ها.
                        <br />
                        <span className="text-slate-500">
                          <strong>مزیت ویژه:</strong> با تقسیم شاخه‌ها به دو طرف، عرض شجره‌نامه نسبت به حالت خطی بیش از ۵۰ درصد کاهش می‌یابد و ساختار خاندان بسیار شکیل و فشرده جلوه می‌کند.
                        </span>
                      </li>
                      <li>
                        <strong className="text-teal-700">🌳 نمودار درختی سنتی (بوم فعلی):</strong>
                        خروجی استاندارد و گسترده دقیقاً از روی همان بوم و موقعیت کارت‌هایی که خودتان چیده‌اید (همراه با امکان فعال یا غیرفعال کردن شبکه شطرنجی پس‌زمینه).
                      </li>
                      <li>
                        <strong>پیش‌نمایش زنده (Live Preview):</strong>
                        قبل از آغاز دانلود، با کلیک روی هر یک از سبک‌ها، کادر وسط پنجره شکل دقیق چیدمان و تعداد اعضای حاضر را به شما نمایش می‌دهد.
                      </li>
                      <li>
                        <strong>فرمت‌های خروجی:</strong>
                        فرمت <strong>PDF</strong> به‌صورت وکتور برای چاپ در ابعاد بزرگ بدون افت کیفیت (A3)، و فرمت <strong>PNG</strong> با سه سطح رزولوشن ۱x (وب)، ۲x (HD) و ۴x (فوق‌العاده Ultra) برای اشتراک‌گذاری در پیام‌رسان‌ها (ایتا، بله، تلگرام، واتساپ).
                      </li>
                    </ul>
                  </div>

                  {/* بخش ۷: دامنه و امنیت ارتباطات */}
                  <div className="bg-teal-50 p-4 rounded-2xl border border-teal-200/80 space-y-1.5">
                    <h4 className="font-bold text-teal-900 flex items-center gap-2 text-xs">
                      <i className="fa-solid fa-lock text-emerald-600"></i>
                      <span>۷. آدرس رسمی سامانه و گواهینامه امنیتی SSL</span>
                    </h4>
                    <p className="text-xs text-teal-800">
                      سامانه بر روی دامنه رسمی <a href="https://shajarnameh.ir" target="_blank" rel="noreferrer" className="font-bold underline text-teal-900">https://shajarnameh.ir</a> با گواهینامه معتبر امنیتی SSL (قفل سبز)، پورت استاندارد ۴۴۳ و هدایت خودکار ترافیک به پروتکل امن فعال است.
                    </p>
                  </div>
                </div>
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      )}

      {/* ── Toast ────────────────────────────────────────────────────────── */}
      <div
        className={`fixed bottom-28 left-1/2 -translate-x-1/2 z-[99999] neo-embossed px-6 py-3 rounded-full text-xs font-bold tracking-wide flex items-center gap-2 transition-all duration-300 shadow-xl ${
          toastType === "error" ? "text-rose-700 bg-rose-50/90 border-rose-300" : "text-teal-800"
        } ${
          isToastVisible ? "opacity-100 -translate-y-2 pointer-events-auto" : "opacity-0 pointer-events-none translate-y-0"
        }`}
      >
        <i className={`fa-solid ${toastType === "error" ? "fa-circle-exclamation text-rose-600" : "fa-circle-check text-emerald-600"}`}></i>
        <span>{toastMessage}</span>
      </div>

      {/* ── Zen Mode Exit ─────────────────────────────────────────────────── */}
      {isZenMode && (
        <button
          onClick={() => {
            setIsZenMode(false);
            showToast(currentLang === "fa" ? "منوها دوباره نمایش داده شدند." : "UI controls restored.");
          }}
          className={`fixed top-6 z-50 w-12 h-12 rounded-full neo-embossed neo-embossed-hover neo-embossed-active flex items-center justify-center text-teal-700 pointer-events-auto ${
            currentLang === "en" ? "left-6" : "right-6"
          }`}
          title={currentLang === "fa" ? "نمایش منوها" : "Show UI"}
        >
          <i className="fa-solid fa-eye text-lg"></i>
        </button>
      )}
    </div>
  );
}
