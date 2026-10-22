import { jsPDF } from "jspdf";
import type { HierarchyNode, HierarchyTree } from "./treeHierarchy";

export interface ExportResult {
  width: number;
  height: number;
  actualScale: number;
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

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("مرورگر نتوانست تصویر را کدگذاری کند."))),
      type,
      quality,
    );
  });
}

/**
 * Generates pure SVG string for the Sunburst (خورشیدی) layout.
 * Accurately branches distinct wives and their respective children into concentric rings.
 */
export function generateSunburstSVG(hierarchy: HierarchyTree, size = 2800): string {
  const cx = size / 2;
  const cy = size / 2;
  const R0 = 140;
  const ringWidth = 220;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="background-color: #06130f; font-family: 'Vazirmatn', system-ui, sans-serif;">\n`;
  svg += `<defs>
    <filter id="sb-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="4" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>\n`;

  // Background
  svg += `<rect width="100%" height="100%" fill="#06130f"/>\n`;

  const topBranches = hierarchy.root.children || [];
  const totalLeaves = topBranches.reduce((sum, b) => sum + b.leafCount, 0) || 1;
  const branchColors = ["#10b981", "#3b82f6", "#8b5cf6", "#06b6d4", "#eab308", "#f43f5e", "#14b8a6", "#f97316"];

  function drawWedge(
    node: HierarchyNode,
    rIn: number,
    rOut: number,
    aStart: number,
    aEnd: number,
    color: string,
    isSpouse = false,
  ) {
    const aMid = (aStart + aEnd) / 2;
    const isLeft = Math.cos(aMid) < 0;

    const x1 = cx + rOut * Math.cos(aStart);
    const y1 = cy + rOut * Math.sin(aStart);
    const x2 = cx + rOut * Math.cos(aEnd);
    const y2 = cy + rOut * Math.sin(aEnd);
    const x3 = cx + rIn * Math.cos(aEnd);
    const y3 = cy + rIn * Math.sin(aEnd);
    const x4 = cx + rIn * Math.cos(aStart);
    const y4 = cy + rIn * Math.sin(aStart);

    const largeArc = aEnd - aStart > Math.PI ? 1 : 0;
    const pathD = `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${rOut} ${rOut} 0 ${largeArc} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} L ${x3.toFixed(1)} ${y3.toFixed(1)} A ${rIn} ${rIn} 0 ${largeArc} 0 ${x4.toFixed(1)} ${y4.toFixed(1)} Z`;

    const fillColor = isSpouse ? "#ec489925" : `${color}25`;
    const strokeColor = isSpouse ? "#ec4899" : color;
    const strokeWidth = isSpouse ? 2 : 1.5;
    const strokeDash = isSpouse ? 'stroke-dasharray="5,3"' : "";

    svg += `<path d="${pathD}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-opacity="0.85" ${strokeDash}/>\n`;

    // Text Label
    const rMid = (rIn + rOut) / 2;
    const tx = cx + rMid * Math.cos(aMid);
    const ty = cy + rMid * Math.sin(aMid);

    let deg = (aMid * 180) / Math.PI;
    if (isLeft) {
      deg += 180;
    }

    const span = aEnd - aStart;
    if (span > 0.035) {
      let displayName = node.name;
      if (isSpouse) {
        displayName = node.spouseRole ? `${node.spouseRole}: ${node.name}` : `همسر: ${node.name}`;
      }
      const cleanName = displayName.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const fontSize = rIn > 500 ? 11 : rIn > 300 ? 13 : 15;
      const textFill = isSpouse ? "#f9a8d4" : "#f8fafc";
      svg += `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" fill="${textFill}" font-size="${fontSize}" font-weight="bold" text-anchor="middle" dominant-baseline="central" transform="rotate(${deg.toFixed(1)}, ${tx.toFixed(1)}, ${ty.toFixed(1)})">${cleanName}</text>\n`;
    }

    // Children & Marriages recursion
    const nextItems: HierarchyNode[] = isSpouse
      ? node.children || []
      : (node.marriages && node.marriages.length > 0)
      ? node.marriages
      : (node.children || []);

    if (nextItems.length > 0) {
      let currentAngle = aStart;
      nextItems.forEach((item) => {
        const itemSpan = (item.leafCount / node.leafCount) * span;
        const itemEnd = currentAngle + itemSpan;
        drawWedge(item, rOut, rOut + ringWidth, currentAngle, itemEnd, color, !!item.isSpouse);
        currentAngle = itemEnd;
      });
    }
  }

  // Draw top branches starting from top (12 o'clock)
  let currentAngle = -Math.PI / 2;
  topBranches.forEach((branch, idx) => {
    const bColor = branchColors[idx % branchColors.length];
    const span = (branch.leafCount / totalLeaves) * 2 * Math.PI;
    const aEnd = currentAngle + span;
    drawWedge(branch, R0, R0 + ringWidth, currentAngle, aEnd, bColor, false);
    currentAngle = aEnd;
  });

  // Center Medallion (Root Patriarch)
  svg += `<circle cx="${cx}" cy="${cy}" r="${R0 - 4}" fill="#0d231b" stroke="#f59e0b" stroke-width="3" stroke-dasharray="6,4" filter="url(#sb-glow)"/>\n`;
  svg += `<circle cx="${cx}" cy="${cy}" r="${R0 - 16}" fill="none" stroke="#d97706" stroke-width="1.2" stroke-opacity="0.6"/>\n`;
  svg += `<text x="${cx}" y="${cy - 24}" fill="#fbbf24" font-size="12" font-weight="bold" text-anchor="middle">👑 بزرگ خاندان</text>\n`;
  const rootCleanName = hierarchy.root.name.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  svg += `<text x="${cx}" y="${cy + 6}" fill="#ffffff" font-size="18" font-weight="900" text-anchor="middle">${rootCleanName}</text>\n`;
  if (hierarchy.root.spouse) {
    const rootSpouseClean = hierarchy.root.spouse.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    svg += `<text x="${cx}" y="${cy + 28}" fill="#a7f3d0" font-size="11" text-anchor="middle">همسر: ${rootSpouseClean}</text>\n`;
  }
  if (hierarchy.root.birth) {
    const deathText = hierarchy.root.death === "living" ? "در قید حیات" : hierarchy.root.death;
    svg += `<text x="${cx}" y="${cy + 48}" fill="#94a3b8" font-size="10" text-anchor="middle">${hierarchy.root.birth} - ${deathText}</text>\n`;
  }

  svg += `</svg>`;
  return svg;
}

/**
 * Generates pure SVG string for the Mindmap (متقارن دوطرفه) layout.
 * Accurately connects each husband to each of his distinct wives (rose cards),
 * and each wife directly to her biological children.
 */
export function generateMindmapSVG(hierarchy: HierarchyTree, width = 3400, height = 2200): string {
  const NODE_H = 50;
  const V_GAP = 16;
  const H_GAP = 85;

  // Compute heights of subtrees recursively
  function computeHeight(item: HierarchyNode): number {
    if (!item.isSpouse) {
      if (!item.marriages || item.marriages.length === 0) {
        if (!item.children || item.children.length === 0) {
          (item as unknown as { _h: number })._h = NODE_H;
          return NODE_H;
        }
        let total = 0;
        item.children.forEach((c) => (total += computeHeight(c)));
        total += (item.children.length - 1) * V_GAP;
        const res = Math.max(NODE_H, total);
        (item as unknown as { _h: number })._h = res;
        return res;
      }
      let total = 0;
      item.marriages.forEach((m) => (total += computeHeight(m)));
      total += (item.marriages.length - 1) * V_GAP;
      const res = Math.max(NODE_H, total);
      (item as unknown as { _h: number })._h = res;
      return res;
    }

    // If it's a marriage / spouse node
    if (!item.children || item.children.length === 0) {
      (item as unknown as { _h: number })._h = NODE_H;
      return NODE_H;
    }
    let total = 0;
    item.children.forEach((c) => (total += computeHeight(c)));
    total += (item.children.length - 1) * V_GAP;
    const res = Math.max(NODE_H, total);
    (item as unknown as { _h: number })._h = res;
    return res;
  }

  const rightBranches = hierarchy.rightBranches || [];
  const leftBranches = hierarchy.leftBranches || [];

  rightBranches.forEach((b) => computeHeight(b));
  leftBranches.forEach((b) => computeHeight(b));

  let rightTotalH = 0;
  rightBranches.forEach((b) => (rightTotalH += ((b as unknown as { _h: number })._h || NODE_H) + 24));
  rightTotalH = Math.max(0, rightTotalH - 24);

  let leftTotalH = 0;
  leftBranches.forEach((b) => (leftTotalH += ((b as unknown as { _h: number })._h || NODE_H) + 24));
  leftTotalH = Math.max(0, leftTotalH - 24);

  // Dynamic canvas sizing to ensure zero clipping
  const actualH = Math.max(height, Math.max(rightTotalH, leftTotalH) + 300);
  const actualW = width;
  const cx = actualW / 2;
  const cy = actualH / 2;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${actualW}" height="${actualH}" viewBox="0 0 ${actualW} ${actualH}" style="background-color: #06130f; font-family: 'Vazirmatn', system-ui, sans-serif;">\n`;
  svg += `<defs>
    <filter id="mm-shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#000000" flood-opacity="0.45"/>
    </filter>
  </defs>\n`;

  // Background
  svg += `<rect width="100%" height="100%" fill="#06130f"/>\n`;

  function drawBezier(x1: number, y1: number, x2: number, y2: number, color: string, isDashed = false) {
    const dx = Math.abs(x2 - x1) * 0.5;
    const sign = x2 > x1 ? 1 : -1;
    const d = `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${(x1 + sign * dx).toFixed(1)} ${y1.toFixed(1)}, ${(x2 - sign * dx).toFixed(1)} ${y2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    const strokeDash = isDashed ? 'stroke-dasharray="4,4"' : "";
    svg += `<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-opacity="0.85" ${strokeDash}/>\n`;
  }

  // Recursive item renderer
  function renderItem(item: HierarchyNode, x: number, topY: number, dir: number, color: string) {
    const itemH = (item as unknown as { _h: number })._h || NODE_H;
    const cardY = topY + itemH / 2 - NODE_H / 2;
    const cardCenterY = topY + itemH / 2;
    const cardW = item.isSpouse ? 210 : 190;
    const cardLeft = dir === 1 ? x : x - cardW;

    const isSpouse = !!item.isSpouse;
    const bgColor = isSpouse ? "#1e1b2e" : "#0d231b";
    const borderColor = isSpouse ? "#ec4899" : color;
    const iconColor = isSpouse ? "#f472b6" : color;

    // Card background
    svg += `<rect x="${cardLeft.toFixed(1)}" y="${cardY.toFixed(1)}" width="${cardW}" height="${NODE_H}" rx="12" fill="${bgColor}" stroke="${borderColor}" stroke-width="${isSpouse ? 1.8 : 1.5}" filter="url(#mm-shadow)"/>\n`;
    svg += `<rect x="${dir === 1 ? cardLeft.toFixed(1) : (cardLeft + cardW - 4).toFixed(1)}" y="${cardY.toFixed(1)}" width="4" height="${NODE_H}" rx="2" fill="${borderColor}"/>\n`;

    // Icon Circle
    const iconX = dir === 1 ? cardLeft + 22 : cardLeft + cardW - 22;
    svg += `<circle cx="${iconX.toFixed(1)}" cy="${(cardY + NODE_H / 2).toFixed(1)}" r="13" fill="${borderColor}25" stroke="${borderColor}" stroke-width="1.2"/>\n`;

    // Icon symbol (Ring for spouse, User/Gender for person)
    const iconSymbol = isSpouse ? "💍" : item.gender === "f" ? "♀" : "♂";
    svg += `<text x="${iconX.toFixed(1)}" y="${(cardY + NODE_H / 2 + 5).toFixed(1)}" fill="${iconColor}" font-size="12" text-anchor="middle">${iconSymbol}</text>\n`;

    // Name & Subtitle
    const textX = dir === 1 ? cardLeft + 42 : cardLeft + cardW - 42;
    const anchor = dir === 1 ? "start" : "end";
    const titleText = isSpouse ? `${item.spouseRole || "همسر"}: ${item.name}` : item.name;
    const cleanTitle = titleText.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    svg += `<text x="${textX.toFixed(1)}" y="${(cardY + 22).toFixed(1)}" fill="#ffffff" font-size="13" font-weight="bold" text-anchor="${anchor}">${cleanTitle}</text>\n`;

    let subText = "";
    if (isSpouse) {
      subText = `${item.children.length} فرزند`;
    } else if (item.birth) {
      subText = `${item.birth} - ${item.death === "living" ? "در قید حیات" : item.death}`;
    }
    if (subText) {
      const cleanSub = subText.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      svg += `<text x="${textX.toFixed(1)}" y="${(cardY + 38).toFixed(1)}" fill="${isSpouse ? "#f9a8d4" : "#94a3b8"}" font-size="10" text-anchor="${anchor}">${cleanSub}</text>\n`;
    }

    const outX = dir === 1 ? cardLeft + cardW : cardLeft;

    // If it's a person, connect to marriages
    if (!isSpouse && item.marriages && item.marriages.length > 0) {
      let curY = topY;
      const nextX = outX + dir * H_GAP;
      item.marriages.forEach((mar) => {
        const marH = (mar as unknown as { _h: number })._h || NODE_H;
        const marTargetY = curY + marH / 2;
        drawBezier(outX, cardCenterY, nextX, marTargetY, "#ec4899", true);
        renderItem(mar, nextX, curY, dir, "#ec4899");
        curY += marH + V_GAP;
      });
    } else if (!isSpouse && (!item.marriages || item.marriages.length === 0) && item.children && item.children.length > 0) {
      let curY = topY;
      const nextX = outX + dir * H_GAP;
      item.children.forEach((child) => {
        const childH = (child as unknown as { _h: number })._h || NODE_H;
        const childTargetY = curY + childH / 2;
        drawBezier(outX, cardCenterY, nextX, childTargetY, color, false);
        renderItem(child, nextX, curY, dir, color);
        curY += childH + V_GAP;
      });
    }

    // If it's a spouse, connect directly to her children
    if (isSpouse && item.children && item.children.length > 0) {
      let curY = topY;
      const nextX = outX + dir * H_GAP;
      item.children.forEach((child) => {
        const childH = (child as unknown as { _h: number })._h || NODE_H;
        const childTargetY = curY + childH / 2;
        drawBezier(outX, cardCenterY, nextX, childTargetY, color, false);
        renderItem(child, nextX, curY, dir, color);
        curY += childH + V_GAP;
      });
    }
  }

  // Draw Center Root Card (Mohammad Hasan Najaf + Batool / Oum Taha)
  const rootW = 260;
  const rootH = 75;
  svg += `<rect x="${cx - rootW / 2}" y="${cy - rootH / 2}" width="${rootW}" height="${rootH}" rx="18" fill="#0d231b" stroke="#f59e0b" stroke-width="2.5" stroke-dasharray="6,4" filter="url(#mm-shadow)"/>\n`;
  svg += `<text x="${cx}" y="${cy - 12}" fill="#fbbf24" font-size="12" font-weight="bold" text-anchor="middle">👑 بزرگ خاندان</text>\n`;
  const rootCleanName = hierarchy.root.name.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  svg += `<text x="${cx}" y="${cy + 10}" fill="#ffffff" font-size="17" font-weight="900" text-anchor="middle">${rootCleanName}</text>\n`;
  if (hierarchy.root.spouse) {
    const rootSpouseClean = hierarchy.root.spouse.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    svg += `<text x="${cx}" y="${cy + 27}" fill="#a7f3d0" font-size="11" text-anchor="middle">همسر: ${rootSpouseClean}</text>\n`;
  }

  // Draw Right Branches
  let rY = cy - rightTotalH / 2;
  rightBranches.forEach((b) => {
    const bHeight = (b as unknown as { _h: number })._h || NODE_H;
    const branchCenterY = rY + bHeight / 2;
    drawBezier(cx + rootW / 2, cy, cx + rootW / 2 + 60, branchCenterY, b.color || "#059669");
    renderItem(b, cx + rootW / 2 + 60, rY, 1, b.color || "#059669");
    rY += bHeight + 24;
  });

  // Draw Left Branches
  let lY = cy - leftTotalH / 2;
  leftBranches.forEach((b) => {
    const bHeight = (b as unknown as { _h: number })._h || NODE_H;
    const branchCenterY = lY + bHeight / 2;
    drawBezier(cx - rootW / 2, cy, cx - rootW / 2 - 60, branchCenterY, b.color || "#0284c7");
    renderItem(b, cx - rootW / 2 - 60, lY, -1, b.color || "#0284c7");
    lY += bHeight + 24;
  });

  svg += `</svg>`;
  return svg;
}

/**
 * Converts an SVG string into a High-Resolution Canvas.
 */
async function svgToCanvas(
  svgString: string,
  width: number,
  height: number,
  scale = 1,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("محیط ترسیم بوم مرورگر بارگذاری نشد.");

  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const img = new Image();

  await new Promise<void>((resolve, reject) => {
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve();
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });

  return canvas;
}

/**
 * Exports Sunburst or Mindmap directly to PDF or PNG.
 */
export async function exportCustomDiagram(
  svgString: string,
  width: number,
  height: number,
  format: "pdf" | "png",
  scale: number,
  filename: string,
  onProgress: (p: number) => void,
): Promise<ExportResult> {
  onProgress(20);
  const canvas = await svgToCanvas(svgString, width, height, Math.max(1, scale));
  onProgress(60);

  if (format === "png") {
    const blob = await canvasToBlob(canvas, "image/png");
    downloadBlob(blob, `${filename}.png`);
    onProgress(100);
    return { width: canvas.width, height: canvas.height, actualScale: scale };
  }

  // Format is PDF (A3 / Auto)
  onProgress(75);
  const isLandscape = width >= height;
  const pdf = new jsPDF({
    orientation: isLandscape ? "landscape" : "portrait",
    unit: "pt",
    format: "a3",
    compress: true,
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 16;
  const availW = pageWidth - margin * 2;
  const availH = pageHeight - margin * 2;

  const fit = Math.min(availW / canvas.width, availH / canvas.height);
  const imgW = canvas.width * fit;
  const imgH = canvas.height * fit;
  const x = (pageWidth - imgW) / 2;
  const y = (pageHeight - imgH) / 2;

  const jpeg = canvas.toDataURL("image/jpeg", 0.95);
  pdf.addImage(jpeg, "JPEG", x, y, imgW, imgH, undefined, "FAST");
  pdf.save(`${filename}.pdf`);
  onProgress(100);

  return { width: canvas.width, height: canvas.height, actualScale: scale };
}
