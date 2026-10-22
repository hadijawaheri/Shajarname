export interface DiagramRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface DiagramBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ExportScaleLimits {
  maxDimension: number;
  maxPixels: number;
}

export const DEFAULT_EXPORT_LIMITS: ExportScaleLimits = {
  // Conservative limits that work across current Chromium, Safari and Firefox.
  maxDimension: 16_000,
  maxPixels: 32_000_000,
};

export function computeDiagramBounds(
  rects: DiagramRect[],
  padding = 96,
): DiagramBounds {
  const valid = rects.filter(
    (rect) =>
      Number.isFinite(rect.left) &&
      Number.isFinite(rect.top) &&
      Number.isFinite(rect.width) &&
      Number.isFinite(rect.height) &&
      rect.width > 0 &&
      rect.height > 0,
  );

  if (valid.length === 0) {
    throw new Error("No visible family members are available to export.");
  }

  const minX = Math.min(...valid.map((rect) => rect.left));
  const minY = Math.min(...valid.map((rect) => rect.top));
  const maxX = Math.max(...valid.map((rect) => rect.left + rect.width));
  const maxY = Math.max(...valid.map((rect) => rect.top + rect.height));

  return {
    left: Math.floor(minX - padding),
    top: Math.floor(minY - padding),
    width: Math.ceil(maxX - minX + padding * 2),
    height: Math.ceil(maxY - minY + padding * 2),
  };
}

export function resolveExportScale(
  width: number,
  height: number,
  requestedScale: number,
  limits: ExportScaleLimits = DEFAULT_EXPORT_LIMITS,
): number {
  if (width <= 0 || height <= 0 || requestedScale <= 0) {
    throw new Error("Export dimensions and scale must be positive.");
  }

  const dimensionScale = Math.min(
    limits.maxDimension / width,
    limits.maxDimension / height,
  );
  const areaScale = Math.sqrt(limits.maxPixels / (width * height));
  const safeScale = Math.min(requestedScale, dimensionScale, areaScale);

  if (!Number.isFinite(safeScale) || safeScale < 0.25) {
    throw new Error("The family tree is too large to export as a single image.");
  }

  return Math.floor(safeScale * 100) / 100;
}
