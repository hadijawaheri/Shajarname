"use client";

import React, { useMemo } from "react";
import { Button, Checkbox } from "@heroui/react";
import type { HierarchyTree } from "../lib/treeHierarchy";
import { generateSunburstSVG, generateMindmapSVG } from "../lib/exportGenerators";

export type ExportStyleType = "sunburst" | "mindmap" | "tree";
export type ExportFormatType = "png" | "pdf";

interface ExportModalContentProps {
  hierarchy: HierarchyTree | null;
  exportStyle: ExportStyleType;
  setExportStyle: (style: ExportStyleType) => void;
  exportFormat: ExportFormatType;
  setExportFormat: (fmt: ExportFormatType) => void;
  exportScale: number;
  setExportScale: (s: number) => void;
  exportGrid: boolean;
  setExportGrid: (g: boolean) => void;
  isExporting: boolean;
  exportProgress: number;
  onDownload: () => void;
  currentLang?: "fa" | "ar" | "en";
}

export default function ExportModalContent({
  hierarchy,
  exportStyle,
  setExportStyle,
  exportFormat,
  setExportFormat,
  exportScale,
  setExportScale,
  exportGrid,
  setExportGrid,
  isExporting,
  exportProgress,
  onDownload,
  currentLang = "fa",
}: ExportModalContentProps) {
  // Generate SVG previews
  const sunburstPreviewSVG = useMemo(() => {
    if (!hierarchy) return "";
    return generateSunburstSVG(hierarchy, 1400);
  }, [hierarchy]);

  const mindmapPreviewSVG = useMemo(() => {
    if (!hierarchy) return "";
    return generateMindmapSVG(hierarchy, 1800, 1200);
  }, [hierarchy]);

  const styleDescriptions = {
    sunburst: {
      title: "نمودار خورشیدی (MyHeritage Sunburst)",
      desc: "طراحی ۳۶۰ درجه مدور بدون هیچ فضای هدررفته؛ بهترین گزینه برای موبایل و چاپ کتیبه.",
      icon: "fa-sun",
      color: "text-amber-500",
    },
    mindmap: {
      title: "ساختار شعاعی متقارن دوطرفه (Mindmap)",
      desc: "توزیع متوازن شاخه‌ها به راست و چپ با خطوط انحنای نرم بزیه؛ کاهش ۵۰ درصدی عرض بوم.",
      icon: "fa-network-wired",
      color: "text-emerald-500",
    },
    tree: {
      title: "نمودار درختی سنتی (Classical Canvas)",
      desc: "خروجی مستقیم از بوم شجره‌نامه بر اساس چیدمان دستی فعلی شما.",
      icon: "fa-tree",
      color: "text-teal-500",
    },
  };

  return (
    <div className="space-y-4">
      {/* ── 1. STYLE SELECTOR BUTTONS ──────────────────────────────────── */}
      <div>
        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
          {currentLang === "fa" ? "۱. سبک چیدمان خروجی را انتخاب کنید:" : "1. Select Layout Style:"}
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setExportStyle("sunburst")}
            className={`py-2.5 px-2 rounded-2xl flex flex-col items-center justify-center gap-1.5 border-2 transition-all cursor-pointer ${
              exportStyle === "sunburst"
                ? "bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-400 font-bold shadow-sm"
                : "border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-600 dark:text-slate-400"
            }`}
          >
            <i className="fa-solid fa-sun text-base text-amber-500"></i>
            <span className="text-[11px] font-bold">خورشیدی</span>
            <span className="text-[9px] text-slate-400 hidden sm:inline">مدور ۳۶۰°</span>
          </button>

          <button
            type="button"
            onClick={() => setExportStyle("mindmap")}
            className={`py-2.5 px-2 rounded-2xl flex flex-col items-center justify-center gap-1.5 border-2 transition-all cursor-pointer ${
              exportStyle === "mindmap"
                ? "bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-400 font-bold shadow-sm"
                : "border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-600 dark:text-slate-400"
            }`}
          >
            <i className="fa-solid fa-network-wired text-base text-emerald-500"></i>
            <span className="text-[11px] font-bold">متقارن دوطرفه</span>
            <span className="text-[9px] text-slate-400 hidden sm:inline">شعاعی متعادل</span>
          </button>

          <button
            type="button"
            onClick={() => setExportStyle("tree")}
            className={`py-2.5 px-2 rounded-2xl flex flex-col items-center justify-center gap-1.5 border-2 transition-all cursor-pointer ${
              exportStyle === "tree"
                ? "bg-teal-500/10 border-teal-500 text-teal-700 dark:text-teal-400 font-bold shadow-sm"
                : "border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-600 dark:text-slate-400"
            }`}
          >
            <i className="fa-solid fa-tree text-base text-teal-500"></i>
            <span className="text-[11px] font-bold">درختی</span>
            <span className="text-[9px] text-slate-400 hidden sm:inline">چیدمان دستی</span>
          </button>
        </div>
      </div>

      {/* ── 2. LIVE INTERACTIVE PREVIEW BOX ─────────────────────────────── */}
      <div className="surface-inset p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              پیش‌نمایش زنده خروجی (Live Preview)
            </span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
            {hierarchy?.totalMembers ?? 0} عضو
          </span>
        </div>

        {/* Viewport Frame */}
        <div className="w-full h-52 md:h-64 bg-[#06130f] rounded-xl overflow-hidden relative flex items-center justify-center border border-slate-700/50 shadow-inner p-2">
          {exportStyle === "sunburst" && sunburstPreviewSVG && (
            <div
              className="w-full h-full flex items-center justify-center pointer-events-none [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full [&>svg]:object-contain"
              dangerouslySetInnerHTML={{ __html: sunburstPreviewSVG }}
            />
          )}

          {exportStyle === "mindmap" && mindmapPreviewSVG && (
            <div
              className="w-full h-full flex items-center justify-center pointer-events-none [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full [&>svg]:object-contain"
              dangerouslySetInnerHTML={{ __html: mindmapPreviewSVG }}
            />
          )}

          {exportStyle === "tree" && (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-4 text-center">
              <i className="fa-solid fa-tree text-3xl text-teal-500 mb-2"></i>
              <span className="text-xs font-bold text-slate-200">پیش‌نمایش زنده بوم درختی</span>
              <span className="text-[11px] text-slate-400 mt-1 max-w-xs">
                خروجی دقیقاً از کارت‌ها و اتصالات فعلی روی بوم تهیه خواهد شد.
              </span>
            </div>
          )}
        </div>

        {/* Description Pill */}
        <div className="mt-2.5 p-2 rounded-xl bg-slate-100 dark:bg-slate-900/60 text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-2">
          <i className={`fa-solid ${styleDescriptions[exportStyle].icon} ${styleDescriptions[exportStyle].color} text-xs mt-0.5 shrink-0`}></i>
          <div>
            <span className="font-bold text-slate-800 dark:text-slate-200 block mb-0.5">
              {styleDescriptions[exportStyle].title}
            </span>
            <span>{styleDescriptions[exportStyle].desc}</span>
          </div>
        </div>
      </div>

      {/* ── 3. FORMAT & RESOLUTION OPTIONS ─────────────────────────────── */}
      <div className="surface-inset p-3.5 rounded-2xl space-y-3">
        {/* Format */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-400">فرمت فایل:</span>
          <div className="flex items-center gap-1.5">
            {(["pdf", "png"] as const).map((fmt) => (
              <Button
                key={fmt}
                size="sm"
                variant={exportFormat === fmt ? "primary" : "secondary"}
                onPress={() => setExportFormat(fmt)}
                className="h-8 text-xs font-bold"
              >
                {fmt === "pdf" ? "PDF (وکتور چاپی)" : "PNG (تصویر باکیفیت)"}
              </Button>
            ))}
          </div>
        </div>

        {/* Scale */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200/50 dark:border-slate-800/50">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-400">کیفیت و رزولوشن:</span>
          <div className="flex items-center gap-1.5">
            {[1, 2, 4].map((s) => (
              <Button
                key={s}
                size="sm"
                variant={exportScale === s ? "primary" : "secondary"}
                onPress={() => setExportScale(s)}
                className="h-7 text-xs font-bold"
              >
                {s}x {s === 1 ? "(وب)" : s === 2 ? "(HD)" : "(Ultra)"}
              </Button>
            ))}
          </div>
        </div>

        {/* Grid option for Classical Tree */}
        {exportStyle === "tree" && (
          <div
            className="flex items-center justify-between pt-2 border-t border-slate-200/50 dark:border-slate-800/50 cursor-pointer"
            onClick={() => setExportGrid(!exportGrid)}
          >
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">شطرنجی پس‌زمینه:</span>
            <Checkbox isSelected={exportGrid} style={{ pointerEvents: "none" }}>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
            </Checkbox>
          </div>
        )}
      </div>

      {/* ── 4. PROGRESS BAR ────────────────────────────────────────────── */}
      {isExporting && (
        <div className="space-y-1.5 pt-1">
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-emerald-600 dark:bg-emerald-500 h-full transition-all duration-300"
              style={{ width: `${exportProgress}%` }}
            ></div>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center font-bold">
            در حال پردازش و تولید فایل باکیفیت ({exportProgress}٪)...
          </p>
        </div>
      )}

      {/* ── 5. SUBMIT BUTTON ───────────────────────────────────────────── */}
      <Button
        className="w-full h-11 text-sm font-bold bg-emerald-700 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 rounded-2xl cursor-pointer"
        isDisabled={isExporting}
        onPress={onDownload}
      >
        <i className="fa-solid fa-download me-2"></i>
        <span>دریافت خروجی {exportStyle === "sunburst" ? "خورشیدی" : exportStyle === "mindmap" ? "متقارن دوطرفه" : "درختی"} ({exportFormat.toUpperCase()})</span>
      </Button>
    </div>
  );
}
