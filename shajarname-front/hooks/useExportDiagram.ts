import { useRef, useState, type RefObject } from "react";
import { toCanvas } from "html-to-image";
import { jsPDF } from "jspdf";
import {
  computeDiagramBounds,
  resolveExportScale,
  type DiagramRect,
} from "../lib/exportDiagram";

interface ExportOptions {
  scale?: number;
  includeGrid?: boolean;
}

export interface DiagramExportResult {
  requestedScale: number;
  actualScale: number;
  width: number;
  height: number;
}

interface CapturedDiagram extends DiagramExportResult {
  canvas: HTMLCanvasElement;
}

const FALLBACK_AVATAR_SVG =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">` +
    `<rect width="128" height="128" rx="64" fill="#e2e8f0"/>` +
    `<circle cx="64" cy="48" r="24" fill="#94a3b8"/>` +
    `<path d="M64 80c-26 0-44 14-44 32v4h88v-4c0-18-18-32-44-32z" fill="#94a3b8"/>` +
    `</svg>`
  );

function collectVisibleCardRects(canvas: HTMLElement): DiagramRect[] {
  return Array.from(canvas.querySelectorAll<HTMLElement>(".tree-card"))
    .filter((element) => {
      const style = window.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0;
    })
    .map((element) => ({
      left: element.offsetLeft,
      top: element.offsetTop,
      width: element.offsetWidth,
      height: element.offsetHeight,
    }));
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("مرورگر نتوانست تصویر را کدگذاری کند."))),
      type,
      quality,
    );
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function captureDiagram(
  source: HTMLElement,
  options: ExportOptions,
  onProgress: (progress: number) => void,
): Promise<CapturedDiagram> {
  const requestedScale = options.scale ?? 1;
  const bounds = computeDiagramBounds(collectVisibleCardRects(source));
  const actualScale = resolveExportScale(bounds.width, bounds.height, requestedScale);

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  Object.assign(host.style, {
    position: "fixed",
    left: "-100000px",
    top: "0",
    pointerEvents: "none",
    zIndex: "-1",
  });

  const stage = document.createElement("div");
  stage.dir = document.documentElement.dir;
  Object.assign(stage.style, {
    position: "relative",
    overflow: "hidden",
    width: `${bounds.width}px`,
    height: `${bounds.height}px`,
    background: options.includeGrid ? "#e8ece8" : "#ffffff",
  });

  const clone = source.cloneNode(true) as HTMLElement;
  clone.removeAttribute("id");
  clone.querySelectorAll(".export-hidden, .tree-card-actions").forEach((node) => node.remove());
  if (!options.includeGrid) clone.classList.remove("canvas-grid");
  Object.assign(clone.style, {
    position: "absolute",
    left: `${-bounds.left}px`,
    top: `${-bounds.top}px`,
    width: `${source.scrollWidth}px`,
    height: `${source.scrollHeight}px`,
    transform: "none",
    transformOrigin: "top left",
    transition: "none",
    margin: "0",
  });

  // Pre-process all images in clone:
  // Convert loaded images to data URLs, or replace 404/broken ones with SVG placeholder.
  // This completely eliminates cross-origin and 404 fetch errors in html-to-image.
  const cloneImages = Array.from(clone.querySelectorAll<HTMLImageElement>("img"));
  const liveImages = Array.from(source.querySelectorAll<HTMLImageElement>("img"));

  for (let i = 0; i < cloneImages.length; i++) {
    const cloneImg = cloneImages[i];
    const liveImg = liveImages[i];

    if (!liveImg || !liveImg.complete || liveImg.naturalWidth === 0) {
      cloneImg.src = FALLBACK_AVATAR_SVG;
      cloneImg.removeAttribute("srcset");
      continue;
    }

    try {
      const c = document.createElement("canvas");
      c.width = liveImg.naturalWidth;
      c.height = liveImg.naturalHeight;
      const ctx = c.getContext("2d");
      if (ctx) {
        ctx.drawImage(liveImg, 0, 0);
        cloneImg.src = c.toDataURL("image/png");
        cloneImg.removeAttribute("srcset");
      } else {
        cloneImg.src = FALLBACK_AVATAR_SVG;
      }
    } catch {
      cloneImg.src = FALLBACK_AVATAR_SVG;
      cloneImg.removeAttribute("srcset");
    }
  }

  stage.appendChild(clone);
  host.appendChild(stage);
  document.body.appendChild(host);

  try {
    onProgress(30);
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    onProgress(50);

    const rendered = await toCanvas(stage, {
      width: bounds.width,
      height: bounds.height,
      pixelRatio: actualScale,
      backgroundColor: options.includeGrid ? "#e8ece8" : "#ffffff",
      cacheBust: true,
      skipFonts: true,
      imagePlaceholder: FALLBACK_AVATAR_SVG,
    });

    if (rendered.width === 0 || rendered.height === 0) {
      throw new Error("خروجی تولید شده خالی بود.");
    }

    onProgress(85);
    return {
      canvas: rendered,
      requestedScale,
      actualScale,
      width: bounds.width,
      height: bounds.height,
    };
  } finally {
    host.remove();
  }
}

export function useExportDiagram(canvasRef: RefObject<HTMLElement | null>) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const isExportingRef = useRef(false);

  const runExport = async <T,>(task: (canvas: HTMLElement) => Promise<T>): Promise<T> => {
    const canvas = canvasRef.current;
    if (!canvas) throw new Error("بوم شجره‌نامه آماده نیست.");
    if (isExportingRef.current) throw new Error("یک فرایند خروجی از قبل در حال اجراست.");

    isExportingRef.current = true;
    setIsExporting(true);
    setExportProgress(10);
    try {
      return await task(canvas);
    } finally {
      isExportingRef.current = false;
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const exportToPNG = (filename: string, options: ExportOptions = {}) =>
    runExport(async (canvas) => {
      const captured = await captureDiagram(canvas, options, setExportProgress);
      const blob = await canvasToBlob(captured.canvas, "image/png");
      downloadBlob(blob, `${filename}.png`);
      setExportProgress(100);
      const result: DiagramExportResult = {
        requestedScale: captured.requestedScale,
        actualScale: captured.actualScale,
        width: captured.width,
        height: captured.height,
      };
      captured.canvas.width = 0;
      captured.canvas.height = 0;
      return result;
    });

  const exportToPDF = (filename: string, options: ExportOptions = {}) =>
    runExport(async (canvas) => {
      const captured = await captureDiagram(canvas, options, setExportProgress);
      const pdf = new jsPDF({
        orientation: captured.width > captured.height ? "landscape" : "portrait",
        unit: "pt",
        format: "a3",
        compress: true,
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const availableWidth = pageWidth - margin * 2;
      const availableHeight = pageHeight - margin * 2;
      const fit = Math.min(
        availableWidth / captured.canvas.width,
        availableHeight / captured.canvas.height,
      );
      const imageWidth = captured.canvas.width * fit;
      const imageHeight = captured.canvas.height * fit;
      const x = (pageWidth - imageWidth) / 2;
      const y = (pageHeight - imageHeight) / 2;
      const jpeg = captured.canvas.toDataURL("image/jpeg", 0.94);
      pdf.addImage(jpeg, "JPEG", x, y, imageWidth, imageHeight, undefined, "FAST");
      pdf.save(`${filename}.pdf`);
      setExportProgress(100);
      const result: DiagramExportResult = {
        requestedScale: captured.requestedScale,
        actualScale: captured.actualScale,
        width: captured.width,
        height: captured.height,
      };
      captured.canvas.width = 0;
      captured.canvas.height = 0;
      return result;
    });

  return { exportToPNG, exportToPDF, isExporting, exportProgress };
}
