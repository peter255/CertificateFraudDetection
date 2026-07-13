/**
 * Localization math for Engine V2 bounding boxes.
 *
 * Vendor coords are never invented. This module only:
 *  1) Interprets the vendor 4-tuple format using image dimensions (+ optional area ratio)
 *  2) Projects source-image pixels onto the measured display content box
 */

export type BBoxFormat =
  | "xywh"
  | "xyxy"
  | "normalized-xywh"
  | "normalized-xyxy"
  | "ambiguous-xywh";

/** Canonical render form: [x, y, width, height] in source pixels, origin top-left. */
export type Xywh = [number, number, number, number];

export interface InterpretedBBox {
  /** Canonical xywh in source image pixels (top-left origin). */
  xywh: Xywh;
  /** Original vendor 4-tuple (unchanged). */
  raw: Xywh;
  format: BBoxFormat;
  /** True when xywh and xyxy both fit and area ratio did not break the tie. */
  ambiguous: boolean;
}

export interface OverlayProjection {
  /** Display rectangle in CSS pixels relative to the content box. */
  left: number;
  top: number;
  width: number;
  height: number;
  /** Uniform scale applied (min of x/y) to avoid stretching. */
  scale: number;
  scaleX: number;
  scaleY: number;
  /** Letterbox offsets when content aspect ≠ vendor aspect. */
  offsetX: number;
  offsetY: number;
  contentWidth: number;
  contentHeight: number;
  imageWidth: number;
  imageHeight: number;
}

const EPS = 1.02; // allow 2% overflow for rounding

function asQuad(value: unknown): Xywh | null {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const nums = value.map((n) => Number(n));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  return [nums[0], nums[1], nums[2], nums[3]];
}

function areaOf(xywh: Xywh): number {
  return Math.max(0, xywh[2]) * Math.max(0, xywh[3]);
}

function fitsXywh(xywh: Xywh, imageWidth: number, imageHeight: number): boolean {
  const [x, y, w, h] = xywh;
  if (w <= 0 || h <= 0) return false;
  if (x < 0 || y < 0) return false;
  if (w > imageWidth * EPS || h > imageHeight * EPS) return false;
  if (x + w > imageWidth * EPS || y + h > imageHeight * EPS) return false;
  return true;
}

function fitsXyxy(raw: Xywh, imageWidth: number, imageHeight: number): boolean {
  const [x1, y1, x2, y2] = raw;
  if (!(x2 > x1 && y2 > y1)) return false;
  if (x1 < 0 || y1 < 0) return false;
  if (x2 > imageWidth * EPS || y2 > imageHeight * EPS) return false;
  return true;
}

function xyxyToXywh(raw: Xywh): Xywh {
  return [raw[0], raw[1], raw[2] - raw[0], raw[3] - raw[1]];
}

function denormXywh(raw: Xywh, imageWidth: number, imageHeight: number): Xywh {
  return [raw[0] * imageWidth, raw[1] * imageHeight, raw[2] * imageWidth, raw[3] * imageHeight];
}

function denormXyxy(raw: Xywh, imageWidth: number, imageHeight: number): Xywh {
  const abs: Xywh = [raw[0] * imageWidth, raw[1] * imageHeight, raw[2] * imageWidth, raw[3] * imageHeight];
  return xyxyToXywh(abs);
}

function isNormalizedQuad(raw: Xywh): boolean {
  return raw.every((n) => n >= 0 && n <= 1.0001);
}

function pickByAreaRatio(
  a: Xywh,
  b: Xywh,
  imageWidth: number,
  imageHeight: number,
  areaRatio: number
): Xywh | null {
  const denom = imageWidth * imageHeight;
  if (denom <= 0) return null;
  const errA = Math.abs(areaOf(a) / denom - areaRatio);
  const errB = Math.abs(areaOf(b) / denom - areaRatio);
  // Require a clear winner to avoid guessing.
  if (Math.abs(errA - errB) < 1e-6) return null;
  return errA < errB ? a : b;
}

/**
 * Interpret a vendor bbox using page dimensions.
 * Never invents coordinates — returns null when the 4-tuple cannot be validated.
 */
export function interpretBBox(
  value: unknown,
  imageWidth: number,
  imageHeight: number,
  areaRatio?: number | null
): InterpretedBBox | null {
  const raw = asQuad(value);
  if (!raw) return null;
  if (!Number.isFinite(imageWidth) || !Number.isFinite(imageHeight)) return null;
  if (imageWidth <= 0 || imageHeight <= 0) return null;

  // Normalized 0–1 forms (uncommon for this engine, but validate explicitly).
  if (isNormalizedQuad(raw) && (raw[2] <= 1 || raw[3] <= 1)) {
    const asNxywh = denormXywh(raw, imageWidth, imageHeight);
    const asNxyxy =
      raw[2] > raw[0] && raw[3] > raw[1]
        ? denormXyxy(raw, imageWidth, imageHeight)
        : null;

    if (asNxyxy && fitsXywh(asNxyxy, imageWidth, imageHeight) && fitsXywh(asNxywh, imageWidth, imageHeight)) {
      if (typeof areaRatio === "number" && Number.isFinite(areaRatio)) {
        const picked = pickByAreaRatio(asNxywh, asNxyxy, imageWidth, imageHeight, areaRatio);
        if (picked === asNxyxy) {
          return { xywh: asNxyxy, raw, format: "normalized-xyxy", ambiguous: false };
        }
        if (picked === asNxywh) {
          return { xywh: asNxywh, raw, format: "normalized-xywh", ambiguous: false };
        }
      }
      // Prefer normalized xyxy when corners ordering is valid — width/height in 0–1
      // for xywh of a mid-size box is often < corner coords, but both can fit.
      if (raw[2] > raw[0] && raw[3] > raw[1] && (raw[2] > 0.5 || raw[3] > 0.5)) {
        return { xywh: asNxyxy, raw, format: "normalized-xyxy", ambiguous: true };
      }
      return { xywh: asNxywh, raw, format: "normalized-xywh", ambiguous: true };
    }
    if (asNxyxy && fitsXywh(asNxyxy, imageWidth, imageHeight) && !fitsXywh(asNxywh, imageWidth, imageHeight)) {
      return { xywh: asNxyxy, raw, format: "normalized-xyxy", ambiguous: false };
    }
    if (fitsXywh(asNxywh, imageWidth, imageHeight)) {
      return { xywh: asNxywh, raw, format: "normalized-xywh", ambiguous: false };
    }
  }

  const xywhCandidate: Xywh = [raw[0], raw[1], raw[2], raw[3]];
  const xyxyCandidate = fitsXyxy(raw, imageWidth, imageHeight) ? xyxyToXywh(raw) : null;
  const xywhOk = fitsXywh(xywhCandidate, imageWidth, imageHeight);
  const xyxyOk = xyxyCandidate != null && fitsXywh(xyxyCandidate, imageWidth, imageHeight);

  if (xywhOk && !xyxyOk) {
    return { xywh: xywhCandidate, raw, format: "xywh", ambiguous: false };
  }
  if (!xywhOk && xyxyOk && xyxyCandidate) {
    return { xywh: xyxyCandidate, raw, format: "xyxy", ambiguous: false };
  }
  if (xywhOk && xyxyOk && xyxyCandidate) {
    if (typeof areaRatio === "number" && Number.isFinite(areaRatio)) {
      const picked = pickByAreaRatio(
        xywhCandidate,
        xyxyCandidate,
        imageWidth,
        imageHeight,
        areaRatio
      );
      if (picked === xyxyCandidate) {
        return { xywh: xyxyCandidate, raw, format: "xyxy", ambiguous: false };
      }
      if (picked === xywhCandidate) {
        return { xywh: xywhCandidate, raw, format: "xywh", ambiguous: false };
      }
    }

    // Overflow test: if treating c,d as width/height would exceed the page,
    // the tuple must be corners. (Already handled by xywhOk alone.)
    // When both fit: prefer xywh when width/height are plausible vs corners.
    // Corner format typically has c ≈ large x2; if c+a would still fit as width,
    // prefer the interpretation where the box is smaller / more local — use
    // xyxy when (c,d) look like absolute coordinates (c > imageWidth/2 and c > a).
    const looksLikeCorners =
      raw[2] > raw[0] &&
      raw[3] > raw[1] &&
      raw[2] <= imageWidth &&
      raw[3] <= imageHeight &&
      (raw[2] / imageWidth > 0.45 || raw[3] / imageHeight > 0.45) &&
      areaOf(xyxyCandidate) < areaOf(xywhCandidate);

    if (looksLikeCorners) {
      return { xywh: xyxyCandidate, raw, format: "xyxy", ambiguous: true };
    }

    // Default: COCO-style xywh (field name is `bbox` on this engine).
    return { xywh: xywhCandidate, raw, format: "ambiguous-xywh", ambiguous: true };
  }

  return null;
}

/**
 * Project source-pixel xywh onto the file surface box.
 *
 * The overlay host MUST be exactly the rendered file (img / PDF canvas).
 * We map with independent scaleX/scaleY so boxes track the file pixels —
 * no letterboxing and no container offsets.
 */
export function projectToContent(
  xywh: Xywh,
  imageWidth: number,
  imageHeight: number,
  contentWidth: number,
  contentHeight: number
): OverlayProjection | null {
  if (
    ![...xywh, imageWidth, imageHeight, contentWidth, contentHeight].every(
      (n) => Number.isFinite(n)
    )
  ) {
    return null;
  }
  if (imageWidth <= 0 || imageHeight <= 0 || contentWidth <= 0 || contentHeight <= 0) {
    return null;
  }

  const scaleX = contentWidth / imageWidth;
  const scaleY = contentHeight / imageHeight;
  const [x, y, w, h] = xywh;
  return {
    left: x * scaleX,
    top: y * scaleY,
    width: w * scaleX,
    height: h * scaleY,
    scale: Math.min(scaleX, scaleY),
    scaleX,
    scaleY,
    offsetX: 0,
    offsetY: 0,
    contentWidth,
    contentHeight,
    imageWidth,
    imageHeight,
  };
}

/** Percentage placement when content aspect matches vendor aspect (no letterbox). */
export function projectAsPercent(xywh: Xywh, imageWidth: number, imageHeight: number) {
  const [x, y, w, h] = xywh;
  return {
    leftPct: (x / imageWidth) * 100,
    topPct: (y / imageHeight) * 100,
    widthPct: (w / imageWidth) * 100,
    heightPct: (h / imageHeight) * 100,
  };
}

/**
 * Green-debug: draw the raw vendor 4-tuple as if it were already xywh
 * (no format conversion) — exposes mis-detected formats visually.
 */
export function projectRawAsXywh(
  raw: Xywh,
  imageWidth: number,
  imageHeight: number,
  contentWidth: number,
  contentHeight: number
): OverlayProjection | null {
  return projectToContent(raw, imageWidth, imageHeight, contentWidth, contentHeight);
}
