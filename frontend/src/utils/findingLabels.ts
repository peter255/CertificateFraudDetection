/**
 * User-facing polish for forensic findings — labels, short copy, no internals.
 */

const INTERNAL_KEY_HINT =
  /\b(bbox|bounding[_ ]?box|signal[_ ]?id|field[_ ]?id|raw[_ ]?bbox|xywh|xyxy|extras|json)\b/i;

const SNAKE_TOKEN = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/gi;

/** "certificate_reference" → "Certificate Reference" */
export function humanizeLabel(raw: string | null | undefined): string {
  if (!raw || !String(raw).trim()) return "";
  const text = String(raw).trim();

  // Already human-readable (has spaces / Title Case) — light cleanup only.
  if (!/[_\-.]/.test(text) && /[A-Z]/.test(text) && /\s/.test(text)) {
    return text.replace(/\s+/g, " ").trim();
  }

  return text
    .replace(/[.\-]+/g, "_")
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .split(/_+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Humanize snake_case tokens embedded in a free-text sentence. */
export function humanizeInlineTokens(text: string): string {
  return text.replace(SNAKE_TOKEN, (token) => humanizeLabel(token));
}

/**
 * Strip internal identifiers, coordinates, and JSON dumps from customer copy.
 */
export function sanitizeFindingText(raw: string | null | undefined): string {
  if (!raw || !String(raw).trim()) return "";
  let text = String(raw).trim();

  // Drop JSON objects / arrays embedded in prose.
  text = text.replace(/\{[^{}]{0,400}\}/g, " ");
  text = text.replace(/\[[^\[\]]{0,400}\]/g, " ");

  // Drop explicit coordinate / id dumps.
  text = text.replace(
    /\b(?:bbox|bounding[_ ]?box|box)\s*[:=]?\s*\(?\s*-?\d+(?:\.\d+)?(?:\s*,\s*-?\d+(?:\.\d+)?){3}\s*\)?/gi,
    ""
  );
  text = text.replace(
    /\b(?:signal[_ ]?id|field[_ ]?id|region[_ ]?id|id)\s*[:=]\s*[\w.-]+/gi,
    ""
  );
  text = text.replace(
    /\bRelated bboxes:\s*\d+/gi,
    ""
  );
  text = text.replace(
    /\bMarked area ratio:\s*[\d.]+/gi,
    ""
  );
  text = text.replace(
    /\b(?:Field fit|Field importance|Assignment confidence|Field assignment)\s*:\s*[^·—]+/gi,
    ""
  );
  text = text.replace(/\bConfidence:\s*[\d.]+%?/gi, "");
  text = text.replace(/\bSeverity:\s*\w+/gi, "");

  // Drop leftover key:value pairs that look internal.
  text = text
    .split(/\s*[·—|]\s*/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !INTERNAL_KEY_HINT.test(part))
    .join(" · ");

  text = humanizeInlineTokens(text);
  text = text.replace(/\s{2,}/g, " ").replace(/\s+([.,;:])/g, "$1").trim();
  text = text.replace(/^[·—\s]+|[·—\s]+$/g, "").trim();
  return text;
}

/** Collapse to ~1–2 short lines for list rows. */
export function shortenFindingDescription(
  raw: string | null | undefined,
  maxChars = 120
): string {
  const cleaned = sanitizeFindingText(raw);
  if (!cleaned) return "";
  if (cleaned.length <= maxChars) return cleaned;

  let cut = cleaned.slice(0, maxChars - 1);
  const seps = [". ", "! ", "? ", "; ", ", ", " "];
  for (const sep of seps) {
    const idx = cut.lastIndexOf(sep);
    if (idx >= Math.floor(maxChars * 0.55)) {
      cut = cut.slice(0, idx + (sep.trim() ? 1 : 0));
      break;
    }
  }
  cut = cut.replace(/[ ,;]+$/g, "");
  if (!/[.!?]$/.test(cut)) cut += "…";
  return cut;
}

/**
 * Map engine severity/status to a balanced UI level.
 * Default is medium — never inflate unknown values to critical.
 */
export function normalizeFindingSeverity(
  raw: string | null | undefined,
  status?: string | null
): "critical" | "high" | "medium" | "low" {
  const s = (raw || "").toLowerCase().trim();
  if (s === "critical" || s === "severe") return "critical";
  if (s === "high") return "high";
  if (s === "medium" || s === "moderate" || s === "warning" || s === "warn") {
    return "medium";
  }
  if (
    s === "low" ||
    s === "info" ||
    s === "informational" ||
    s === "pass" ||
    s === "ok" ||
    s === "none"
  ) {
    return "low";
  }

  const st = (status || "").toLowerCase().trim();
  if (st === "fail" || st === "failed" || st === "error") return "high";
  if (st === "warning" || st === "warn") return "medium";
  if (st === "pass" || st === "ok" || st === "info") return "low";
  return "medium";
}

/** Stable spatial key for deduplicating highlightable findings. */
export function spatialFindingKey(
  page: number,
  bbox: [number, number, number, number] | number[]
): string {
  const rounded = bbox.slice(0, 4).map((n) => Math.round(Number(n)));
  return `${page}:${rounded.join(",")}`;
}

/** Intersection-over-union for two xywh boxes. */
export function bboxIoU(
  a: [number, number, number, number] | number[],
  b: [number, number, number, number] | number[]
): number {
  const ax2 = a[0] + a[2];
  const ay2 = a[1] + a[3];
  const bx2 = b[0] + b[2];
  const by2 = b[1] + b[3];
  const ix1 = Math.max(a[0], b[0]);
  const iy1 = Math.max(a[1], b[1]);
  const ix2 = Math.min(ax2, bx2);
  const iy2 = Math.min(ay2, by2);
  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const inter = iw * ih;
  if (inter <= 0) return 0;
  const areaA = Math.max(0, a[2]) * Math.max(0, a[3]);
  const areaB = Math.max(0, b[2]) * Math.max(0, b[3]);
  const union = areaA + areaB - inter;
  return union > 0 ? inter / union : 0;
}

/** True when a is mostly inside b (or vice versa). */
export function bboxMostlyContained(
  a: [number, number, number, number] | number[],
  b: [number, number, number, number] | number[],
  ratio = 0.7
): boolean {
  const ax2 = a[0] + a[2];
  const ay2 = a[1] + a[3];
  const bx2 = b[0] + b[2];
  const by2 = b[1] + b[3];
  const ix1 = Math.max(a[0], b[0]);
  const iy1 = Math.max(a[1], b[1]);
  const ix2 = Math.min(ax2, bx2);
  const iy2 = Math.min(ay2, by2);
  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const inter = iw * ih;
  const areaA = Math.max(0, a[2]) * Math.max(0, a[3]);
  const areaB = Math.max(0, b[2]) * Math.max(0, b[3]);
  if (areaA <= 0 || areaB <= 0) return false;
  return inter / Math.min(areaA, areaB) >= ratio;
}

/**
 * Drop boxes that are noise (tiny) or cover almost the whole page (useless highlight).
 */
export function isUsefulHighlightBox(
  bbox: [number, number, number, number] | number[],
  imageWidth: number,
  imageHeight: number
): boolean {
  const w = Number(bbox[2]);
  const h = Number(bbox[3]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return false;
  if (!Number.isFinite(imageWidth) || !Number.isFinite(imageHeight)) return false;
  if (imageWidth <= 0 || imageHeight <= 0) return false;
  const area = w * h;
  const pageArea = imageWidth * imageHeight;
  if (pageArea <= 0) return false;
  const ratio = area / pageArea;
  // Tiny speck or near-full-page box — both confuse the user.
  if (ratio < 0.0008) return false;
  if (ratio > 0.85) return false;
  return true;
}

/** Build a stable unique finding id from page + bbox (never reuse engine type/ids). */
export function uniqueFindingId(
  page: number,
  bbox: [number, number, number, number] | number[]
): string {
  return `vf-${spatialFindingKey(page, bbox)}`;
}
