/**
 * Azure Document Intelligence layout → UI highlight geometry.
 *
 * Azure analyzeResult is the authoritative source for overlay coordinates.
 * Vendor bboxes are only used when no confident Azure layout element matches.
 *
 * Matching is entity-driven (quoted values, field values, distinctive IDs) —
 * never "any word that happens to appear in the finding narrative" (that
 * incorrectly highlighted "udemy" when the finding was about "Marina Azer").
 */

import type { TamperRegion } from "../types/verification";
import { isDegenerateHighlightBox } from "./findingLabels";
import { classifyFindingScope } from "./findingScope";

export type AzureMatchKind = "keyValuePair" | "word" | "line" | "paragraph" | "figure";

export type Xywh = [number, number, number, number];

export interface AzureLayoutHit {
  kind: AzureMatchKind;
  page: number;
  xywh: Xywh;
  imageWidth: number;
  imageHeight: number;
  content: string;
  /** Higher is better; used to pick among same-priority candidates. */
  score: number;
}

export interface AzureHighlightQuery {
  label?: string | null;
  description?: string | null;
  /** Extra field / check names from the finding (e.g. certificate_id, issuer). */
  fieldHints?: Array<string | null | undefined>;
}

type PageDims = { width: number; height: number; pageNumber: number };

const FIELD_KEY_ALIASES: Record<string, string[]> = {
  holder: [
    "holder",
    "holder name",
    "recipient",
    "student name",
    "candidate name",
    "awarded to",
    "presented to",
  ],
  issuer: ["issuer", "issued by", "issuing authority", "organization", "institution"],
  date: [
    "date",
    "issue date",
    "issued on",
    "award date",
    "completion date",
    "expiration date",
    "expiry",
  ],
  certificate_id: [
    "certificate id",
    "certificate number",
    "certificate no",
    "credential id",
    "serial number",
    "reference number",
    "reference no",
  ],
};

/** Narrative / template words that must never drive geometry. */
const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "over",
  "under",
  "near",
  "around",
  "about",
  "appears",
  "altered",
  "possible",
  "manipulation",
  "suspicious",
  "anomaly",
  "anomalies",
  "finding",
  "visual",
  "text",
  "overlap",
  "font",
  "size",
  "weight",
  "rendered",
  "drastically",
  "inconsistent",
  "document",
  "hierarchy",
  "standard",
  "templates",
  "template",
  "udemy",
  "certificate",
  "completion",
  "student",
  "name",
  "shows",
  "different",
  "alignment",
  "edge",
  "sharpness",
  "compared",
  "other",
  "line",
  "field",
  "level",
  "high",
  "medium",
  "low",
  "confidence",
  "evidence",
  "layer",
  "image",
  "forensics",
  "ocr",
  "copy",
  "move",
  "reuse",
  "block",
  "blocks",
  "detail",
  "high-detail",
  "signed",
  "content",
  "credentials",
  "failed",
  "validation",
  "openai",
  "generation",
  "generated",
]);

/**
 * Pull Azure `analyzeResult` from verify / structural_profile payloads.
 */
export function extractAzureAnalyzeResult(
  ...roots: unknown[]
): Record<string, unknown> | null {
  for (const root of roots) {
    const found = findAnalyzeResult(root, 0);
    if (found) return found;
  }
  return null;
}

/**
 * Resolve the best Azure layout rectangle for a finding query.
 * Priority: figures (logo/seal) → keyValuePairs → entities (lines/words) → words → paragraphs.
 */
export function resolveAzureHighlight(
  analyzeResult: Record<string, unknown> | null | undefined,
  query: AzureHighlightQuery
): AzureLayoutHit | null {
  if (!analyzeResult || typeof analyzeResult !== "object") return null;

  const pages = asArray(analyzeResult.pages);
  const pageDims = buildPageDims(pages);
  if (!pageDims.size) return null;

  const graphic = isGraphicFinding(query);
  const needles = buildNeedles(query);

  const candidates: AzureLayoutHit[] = [];

  // Logo / seal / signature / graphic copy-move → Azure figures first.
  if (graphic) {
    const figHit = matchFigures(analyzeResult, pageDims, pages);
    if (figHit) candidates.push(figHit);
    const logoLine = matchTopBrandLine(pages, pageDims);
    if (logoLine) candidates.push(logoLine);
  }

  if (needles.entities.length || needles.fieldKeys.length || needles.strongTokens.length) {
    const kvHit = matchKeyValuePairs(analyzeResult, needles, pageDims);
    if (kvHit) candidates.push(kvHit);

    const entityLineHit = matchEntityOnLines(pages, needles, pageDims);
    if (entityLineHit) candidates.push(entityLineHit);

    const entityWordHit = matchEntityAsWordSpan(pages, needles, pageDims);
    if (entityWordHit) candidates.push(entityWordHit);

    const wordHit = matchStrongWords(pages, needles, pageDims);
    if (wordHit) candidates.push(wordHit);

    const paraHit = matchParagraphs(analyzeResult, needles, pageDims);
    if (paraHit) candidates.push(paraHit);
  }

  const usable = candidates.filter(
    (hit) =>
      hit.score >= (graphic && hit.kind === "figure" ? 10 : 12) &&
      !isDegenerateHighlightBox(hit.xywh, hit.imageWidth, hit.imageHeight) &&
      !(isContrastContent(hit.content, needles) && !isPrimaryContent(hit.content, needles))
  );
  if (!usable.length) return null;
  usable.sort((a, b) => b.score - a.score || kindRank(a.kind) - kindRank(b.kind));
  return usable[0];
}

/**
 * Remap tamper regions onto Azure layout geometry when a content match exists.
 * Document-level findings never receive a highlight box.
 * Element-level findings keep vendor boxes only as a last resort when Azure fails —
 * the UI will still require Azure for drawing (`canHighlight`).
 */
export function remapTamperRegionsToAzureLayout(
  regions: TamperRegion[],
  analyzeResult: Record<string, unknown> | null | undefined
): TamperRegion[] {
  if (!regions.length) return regions;

  return regions.map((region) => {
    const scope = classifyFindingScope({
      label: region.label,
      description: region.description,
      layer: region.layer,
      location: region.location,
    });

    if (scope === "document") {
      return {
        ...region,
        scope: "document",
        canHighlight: false,
        extras: {
          ...(region.extras && typeof region.extras === "object" ? region.extras : {}),
          findingScope: "document",
        },
      };
    }

    const query: AzureHighlightQuery = {
      label: region.label,
      description: region.description,
      fieldHints: [
        region.label,
        region.layer,
        region.location,
        ...(region.extras ? Object.keys(region.extras) : []),
      ],
    };

    let hit =
      analyzeResult != null ? resolveAzureHighlight(analyzeResult, query) : null;

    const vendorDegenerate = isDegenerateHighlightBox(
      region.bbox,
      region.imageWidth,
      region.imageHeight
    );

    // Graphic ELEMENT findings (logo/seal) with a bad vendor box: force figure/logo.
    // Never invent geometry for vague overlaps / template narratives.
    if (
      !hit &&
      analyzeResult &&
      isGraphicFinding(query) &&
      (vendorDegenerate ||
        /\b(logo|seal|signature|stamp|emblem)\b/i.test(query.label || ""))
    ) {
      const pages = asArray(analyzeResult.pages);
      const pageDims = buildPageDims(pages);
      hit =
        matchFigures(analyzeResult, pageDims, pages) ||
        matchTopBrandLine(pages, pageDims);
      if (hit && isDegenerateHighlightBox(hit.xywh, hit.imageWidth, hit.imageHeight)) {
        hit = null;
      }
    }

    // Require a real Azure hit for element highlights — never paint vendor slivers.
    if (!hit) {
      return {
        ...region,
        scope: "element",
        canHighlight: false,
        extras: {
          ...(region.extras && typeof region.extras === "object" ? region.extras : {}),
          findingScope: "element",
        },
      };
    }

    const padded = padHighlightBox(hit.xywh, hit.imageWidth, hit.imageHeight, hit.kind);
    const vendorSnapshot = {
      bbox: region.bbox,
      imageWidth: region.imageWidth,
      imageHeight: region.imageHeight,
      bboxSource: region.bboxSource ?? null,
      page: region.page,
    };

    const remapped: TamperRegion = {
      ...region,
      bbox: padded,
      rawBBox: hit.xywh,
      bboxFormat: "xywh",
      bboxAmbiguous: false,
      page: hit.page,
      imageWidth: hit.imageWidth,
      imageHeight: hit.imageHeight,
      bboxSource: "azure_document_intelligence",
      scope: "element",
      canHighlight: !isDegenerateHighlightBox(padded, hit.imageWidth, hit.imageHeight),
      extras: {
        ...(region.extras && typeof region.extras === "object" ? region.extras : {}),
        azureMatchKind: hit.kind,
        azureMatchContent: hit.content,
        vendorHighlight: vendorSnapshot,
        findingScope: "element",
      },
    };
    return remapped;
  });
}

// ── internals ───────────────────────────────────────────────────────────────

interface Needles {
  /** Subject of the finding — e.g. Marina Azer in a Student Name card. */
  primaryEntities: string[];
  /** Reference / comparison names — e.g. instructor name in the same sentence. */
  contrastEntities: string[];
  /** Alias of primaryEntities for matching (contrast names are excluded). */
  entities: string[];
  /** Distinctive single tokens (IDs, rare values) — not narrative stopwords. */
  strongTokens: string[];
  /** Field-key aliases activated by the finding (holder, issuer, …). */
  fieldKeys: string[];
}

const CONTRAST_BEFORE_QUOTE =
  /\b(?:instructor|issuer|teacher|facilitator|signatory|compared|unlike|versus|vs\.|rather than|different from|in contrast|whereas)\b[^.]{0,50}$/i;

const PRIMARY_BEFORE_QUOTE =
  /\b(?:the name|name of|field value|value|text|reads|shows|displays|labeled|student name)\s*["']?\s*$/i;

function classifyQuoteRole(beforeText: string): "primary" | "contrast" | "neutral" {
  if (CONTRAST_BEFORE_QUOTE.test(beforeText)) return "contrast";
  if (PRIMARY_BEFORE_QUOTE.test(beforeText)) return "primary";
  return "neutral";
}

function addEntity(
  raw: string,
  role: "primary" | "contrast" | "neutral",
  primary: Set<string>,
  contrast: Set<string>,
  strongTokens: Set<string>
): void {
  const ent = normalize(raw);
  if (ent.length < 2 || STOPWORDS.has(ent)) return;
  if (role === "contrast") {
    contrast.add(ent);
    return;
  }
  primary.add(ent);
  for (const tok of tokenize(ent)) {
    if (isStrongToken(tok)) strongTokens.add(tok);
  }
}

function extractContrastCueEntities(text: string, contrast: Set<string>): void {
  const patterns = [
    /\b(?:instructor|issuer|teacher|facilitator|signatory)\s+name\s+["“']([^"”']{2,80})["”']/gi,
    /\bcompared\s+(?:to|with)\s+(?:the\s+)?(?:instructor\s+)?name\s+["“']([^"”']{2,80})["”']/gi,
  ];
  for (const pattern of patterns) {
    let m: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((m = pattern.exec(text)) != null) {
      const ent = normalize(m[1]);
      if (ent.length >= 2) contrast.add(ent);
    }
  }
}

function isContrastContent(content: string, needles: Needles): boolean {
  const n = normalize(content);
  if (!n) return false;
  return needles.contrastEntities.some((c) => {
    const cn = normalize(c);
    return n === cn || n.includes(cn) || cn.includes(n);
  });
}

function isPrimaryContent(content: string, needles: Needles): boolean {
  const n = normalize(content);
  if (!n) return false;
  return needles.primaryEntities.some((p) => {
    const pn = normalize(p);
    return n === pn || n.includes(pn) || pn.includes(n);
  });
}

function holderFieldActive(needles: Needles): boolean {
  return needles.fieldKeys.includes("holder");
}

function buildNeedles(query: AzureHighlightQuery): Needles {
  const label = typeof query.label === "string" ? query.label : "";
  const description = typeof query.description === "string" ? query.description : "";
  const hints = (query.fieldHints || [])
    .map((v) => (typeof v === "string" ? v : ""))
    .filter(Boolean);

  const primary = new Set<string>();
  const contrast = new Set<string>();
  const strongTokens = new Set<string>();
  const fieldKeys = new Set<string>();

  // 1) Quoted strings — classify subject vs comparison by preceding text.
  const quoteRe = /["“']([^"”']{2,80})["”']/g;
  for (const bit of [label, description, ...hints]) {
    let m: RegExpExecArray | null;
    quoteRe.lastIndex = 0;
    while ((m = quoteRe.exec(bit)) != null) {
      const before = bit.slice(Math.max(0, m.index - 90), m.index);
      let role = classifyQuoteRole(before);
      // First quoted name in a long description is usually the subject.
      if (role === "neutral" && primary.size === 0 && contrast.size === 0) {
        role = "primary";
      }
      addEntity(m[1], role, primary, contrast, strongTokens);
    }
  }

  extractContrastCueEntities([label, description, ...hints].join(" "), contrast);

  // 2) Cue patterns: student name X, Reference Number: 0004, Certificate no. …
  const cuePatterns: RegExp[] = [
    /\bstudent name\s+([A-Z][A-Za-z.'\-]+(?:\s+[A-Z][A-Za-z.'\-]+){0,3})/i,
    /\b(?:name|holder|recipient)\s*[:\-]\s*([A-Z][A-Za-z.'\-]+(?:\s+[A-Z][A-Za-z.'\-]+){0,3})/,
    /\breference number\s*[:#]?\s*([A-Z0-9\-]+)/i,
    /\bcertificate\s*(?:no|number|id|#)\.?\s*[:#]?\s*([A-Z0-9\-]+)/i,
    /\b(UC-[A-Za-z0-9\-]+)\b/,
    /\b([A-Z]{1,5}-\d{3,}[A-Za-z0-9\-]*)\b/,
  ];
  for (const bit of [label, description]) {
    for (const pattern of cuePatterns) {
      const m = bit.match(pattern);
      if (!m?.[1]) continue;
      addEntity(m[1], "primary", primary, contrast, strongTokens);
    }
  }

  // Drop contrast names that were also marked primary (subject wins).
  for (const ent of primary) {
    contrast.delete(ent);
  }

  const primaryEntities = [...primary];
  const contrastEntities = [...contrast];
  const entities = [...primaryEntities];

  // 3) Compact labels that look like field names (not long sentences).
  for (const bit of [label, ...hints]) {
    const n = normalize(bit);
    if (n.length >= 3 && n.length <= 40 && n.split(" ").length <= 5) {
      for (const [canonical, aliases] of Object.entries(FIELD_KEY_ALIASES)) {
        if (aliases.some((a) => n.includes(a)) || n.includes(canonical.replace("_", " "))) {
          fieldKeys.add(canonical);
          for (const a of aliases) fieldKeys.add(a);
        }
      }
    }
  }

  // Activate field keys from description cues without adding narrative tokens.
  const haystack = normalize([label, description, ...hints].join(" "));
  for (const [canonical, aliases] of Object.entries(FIELD_KEY_ALIASES)) {
    if (aliases.some((a) => haystack.includes(a))) {
      fieldKeys.add(canonical);
      for (const a of aliases) fieldKeys.add(a);
    }
  }

  // 4) Strong standalone IDs inside description (avoid common words).
  for (const tok of tokenize(haystack)) {
    if (isStrongToken(tok) && (/\d/.test(tok) || tok.includes("-") || tok.length >= 6)) {
      strongTokens.add(tok);
    }
  }

  // Never use contrast-name tokens as standalone word anchors.
  for (const ent of contrastEntities) {
    for (const tok of tokenize(ent)) {
      strongTokens.delete(tok);
    }
  }

  return {
    primaryEntities,
    contrastEntities,
    entities,
    strongTokens: [...strongTokens],
    fieldKeys: [...fieldKeys],
  };
}

function matchKeyValuePairs(
  analyzeResult: Record<string, unknown>,
  needles: Needles,
  pageDims: Map<number, PageDims>
): AzureLayoutHit | null {
  let best: AzureLayoutHit | null = null;

  for (const item of asArray(analyzeResult.keyValuePairs)) {
    if (!item || typeof item !== "object") continue;
    const pair = item as Record<string, unknown>;
    const keyContent = contentOf(pair.key);
    const valueContent = contentOf(pair.value);
    const keyNorm = normalize(keyContent || "");
    const valueNorm = normalize(valueContent || "");

    if (holderFieldActive(needles) && /\binstructor\b/.test(keyNorm)) continue;
    if (valueNorm && isContrastContent(valueContent || "", needles)) continue;

    let score = 0;

    // Key aligns with a known field the finding talks about.
    if (keyNorm && needles.fieldKeys.some((k) => keyNorm === k || keyNorm.includes(k))) {
      score += 10;
    }

    // Value equals / contains a high-value entity.
    if (valueNorm) {
      for (const ent of needles.entities) {
        if (valueNorm === ent) score += 22;
        else if (valueNorm.includes(ent) || ent.includes(valueNorm)) score += 16;
      }
      for (const tok of needles.strongTokens) {
        if (valueNorm === tok || valueNorm.includes(tok)) score += 12;
      }
    }

    // Need either a solid entity/value hit or (field key + non-empty value region).
    if (score < 16 && !(score >= 10 && valueNorm)) continue;
    if (score < 12) continue;

    const region =
      firstBoundingRegion(pair.value) ||
      firstBoundingRegion(pair.key) ||
      firstBoundingRegion(pair);
    const hit = regionToHit(
      "keyValuePair",
      region,
      pageDims,
      valueContent || keyContent || "",
      score
    );
    if (hit && (!best || hit.score > best.score)) best = hit;
  }

  return best;
}

function matchEntityOnLines(
  pages: unknown[],
  needles: Needles,
  pageDims: Map<number, PageDims>
): AzureLayoutHit | null {
  if (!needles.entities.length) return null;
  let best: AzureLayoutHit | null = null;

  for (const page of pages) {
    if (!page || typeof page !== "object") continue;
    const p = page as Record<string, unknown>;
    const pageNumber = Number(p.pageNumber) || 1;
    for (const line of asArray(p.lines)) {
      if (!line || typeof line !== "object") continue;
      const l = line as Record<string, unknown>;
      const content = typeof l.content === "string" ? l.content : "";
      const n = normalize(content);
      if (n.length < 2) continue;
      if (isContrastContent(content, needles)) continue;
      if (holderFieldActive(needles) && /\binstructor\b/.test(n)) continue;

      let score = 0;
      let matched = "";
      for (const ent of needles.entities) {
        if (n === ent) {
          score = Math.max(score, 28);
          matched = content;
        } else if (n.includes(ent)) {
          // Prefer tighter lines (entity occupies more of the line).
          const coverage = ent.length / Math.max(n.length, 1);
          score = Math.max(score, 20 + Math.round(coverage * 8));
          matched = content;
        }
      }
      if (score < 20) continue;

      const hit = polygonHit("line", l.polygon, pageNumber, pageDims, matched || content, score);
      if (hit && (!best || hit.score > best.score)) best = hit;
    }
  }

  return best;
}

function matchEntityAsWordSpan(
  pages: unknown[],
  needles: Needles,
  pageDims: Map<number, PageDims>
): AzureLayoutHit | null {
  if (!needles.entities.length) return null;
  let best: AzureLayoutHit | null = null;

  for (const page of pages) {
    if (!page || typeof page !== "object") continue;
    const p = page as Record<string, unknown>;
    const pageNumber = Number(p.pageNumber) || 1;
    const words = asArray(p.words)
      .map((w) => {
        if (!w || typeof w !== "object") return null;
        const obj = w as Record<string, unknown>;
        const content = typeof obj.content === "string" ? obj.content : "";
        return { content, norm: normalize(content), polygon: obj.polygon };
      })
      .filter((w): w is { content: string; norm: string; polygon: unknown } => !!w && !!w.norm);

    for (const ent of needles.entities) {
      const parts = tokenize(ent);
      if (!parts.length) continue;

      for (let i = 0; i <= words.length - parts.length; i++) {
        let ok = true;
        for (let j = 0; j < parts.length; j++) {
          if (words[i + j].norm !== parts[j]) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;

        const polys = words.slice(i, i + parts.length).map((w) => w.polygon);
        const xywh = unionPolygons(polys);
        if (!xywh) continue;
        const dims = pageDims.get(pageNumber) || [...pageDims.values()][0];
        if (!dims || !isOnPage(xywh, dims.width, dims.height)) continue;

        const content = words
          .slice(i, i + parts.length)
          .map((w) => w.content)
          .join(" ");
        if (isContrastContent(content, needles)) continue;
        const score = 24 + parts.length * 2 + 8;
        const hit: AzureLayoutHit = {
          kind: parts.length > 1 ? "line" : "word",
          page: pageNumber,
          xywh,
          imageWidth: dims.width,
          imageHeight: dims.height,
          content,
          score,
        };
        if (!best || hit.score > best.score) best = hit;
      }
    }
  }

  return best;
}

function matchStrongWords(
  pages: unknown[],
  needles: Needles,
  pageDims: Map<number, PageDims>
): AzureLayoutHit | null {
  if (!needles.strongTokens.length) return null;
  let best: AzureLayoutHit | null = null;

  for (const page of pages) {
    if (!page || typeof page !== "object") continue;
    const p = page as Record<string, unknown>;
    const pageNumber = Number(p.pageNumber) || 1;
    for (const word of asArray(p.words)) {
      if (!word || typeof word !== "object") continue;
      const w = word as Record<string, unknown>;
      const content = typeof w.content === "string" ? w.content : "";
      const n = normalize(content);
      if (!isStrongToken(n)) continue;
      if (!needles.strongTokens.includes(n)) continue;

      const score = 14 + Math.min(6, n.length);
      const hit = polygonHit("word", w.polygon, pageNumber, pageDims, content, score);
      if (hit && (!best || hit.score > best.score)) best = hit;
    }
  }

  return best;
}

function matchParagraphs(
  analyzeResult: Record<string, unknown>,
  needles: Needles,
  pageDims: Map<number, PageDims>
): AzureLayoutHit | null {
  if (!needles.entities.length) return null;
  let best: AzureLayoutHit | null = null;

  for (const para of asArray(analyzeResult.paragraphs)) {
    if (!para || typeof para !== "object") continue;
    const p = para as Record<string, unknown>;
    const content = typeof p.content === "string" ? p.content : "";
    const n = normalize(content);
    if (n.length < 3) continue;
    if (isContrastContent(content, needles)) continue;

    let score = 0;
    for (const ent of needles.entities) {
      if (n.includes(ent)) {
        const coverage = ent.length / Math.max(n.length, 1);
        // Penalize huge paragraphs — prefer tight geometry.
        score = Math.max(score, 12 + Math.round(coverage * 10));
      }
    }
    if (score < 14) continue;

    const region = firstBoundingRegion(p);
    const hit = regionToHit("paragraph", region, pageDims, content, score);
    if (hit && (!best || hit.score > best.score)) best = hit;
  }

  return best;
}

function kindRank(kind: AzureMatchKind): number {
  switch (kind) {
    case "figure":
      return 0;
    case "keyValuePair":
      return 1;
    case "word":
      return 2;
    case "line":
      return 3;
    case "paragraph":
      return 4;
    default:
      return 9;
  }
}

function isGraphicFinding(query: AzureHighlightQuery): boolean {
  const label = normalize(typeof query.label === "string" ? query.label : "");
  // Only explicit seal/logo/signature labels — not generic "image block" / overlap copy.
  return /\b(logo|seal|signature|stamp|badge|emblem|watermark)\b/.test(label);
}

/**
 * Prefer Azure figures for seals/logos — full graphic region, not a letter sliver.
 * Bias toward larger figures in the upper portion of the page (typical logo placement).
 */
function matchFigures(
  analyzeResult: Record<string, unknown>,
  pageDims: Map<number, PageDims>,
  pages: unknown[]
): AzureLayoutHit | null {
  let best: AzureLayoutHit | null = null;

  for (const figure of asArray(analyzeResult.figures)) {
    if (!figure || typeof figure !== "object") continue;
    const f = figure as Record<string, unknown>;
    const region = firstBoundingRegion(f);
    if (!region) continue;
    const pageNumber = Number(region.pageNumber) || 1;
    const xywh = polygonToXywh(region.polygon);
    if (!xywh) continue;
    const dims = pageDims.get(pageNumber) || [...pageDims.values()][0];
    if (!dims || !isOnPage(xywh, dims.width, dims.height)) continue;
    if (isDegenerateHighlightBox(xywh, dims.width, dims.height)) continue;

    const area = xywh[2] * xywh[3];
    const pageArea = dims.width * dims.height;
    const areaPct = area / pageArea;
    // Ignore near-full-page figures and tiny icons.
    if (areaPct < 0.004 || areaPct > 0.45) continue;

    // Prefer top-of-page figures (logos) without ignoring mid-page seals.
    const centerY = (xywh[1] + xywh[3] / 2) / dims.height;
    let score = 18 + Math.round(areaPct * 40);
    if (centerY < 0.28) score += 10;
    else if (centerY < 0.55) score += 4;

    // Slight boost if a short brand-like word overlaps this figure.
    if (figureOverlapsBrand(pages, pageNumber, xywh)) score += 6;

    const hit: AzureLayoutHit = {
      kind: "figure",
      page: pageNumber,
      xywh,
      imageWidth: dims.width,
      imageHeight: dims.height,
      content: "figure",
      score,
    };
    if (!best || hit.score > best.score) best = hit;
  }

  return best;
}

/** Top-of-page short brand line (e.g. "udemy") when figures are missing. */
function matchTopBrandLine(
  pages: unknown[],
  pageDims: Map<number, PageDims>
): AzureLayoutHit | null {
  let best: AzureLayoutHit | null = null;

  for (const page of pages) {
    if (!page || typeof page !== "object") continue;
    const p = page as Record<string, unknown>;
    const pageNumber = Number(p.pageNumber) || 1;
    const dims = pageDims.get(pageNumber);
    if (!dims) continue;

    for (const line of asArray(p.lines)) {
      if (!line || typeof line !== "object") continue;
      const l = line as Record<string, unknown>;
      const content = typeof l.content === "string" ? l.content : "";
      const n = normalize(content);
      // Brand marks: one short token, rarely a full sentence.
      if (!n || n.includes(" ") || n.length < 3 || n.length > 18) continue;

      const xywh = polygonToXywh(l.polygon);
      if (!xywh || isDegenerateHighlightBox(xywh, dims.width, dims.height)) continue;
      const centerY = (xywh[1] + xywh[3] / 2) / dims.height;
      if (centerY > 0.22) continue;

      const areaPct = (xywh[2] * xywh[3]) / (dims.width * dims.height);
      if (areaPct < 0.002 || areaPct > 0.12) continue;

      const hit: AzureLayoutHit = {
        kind: "line",
        page: pageNumber,
        xywh,
        imageWidth: dims.width,
        imageHeight: dims.height,
        content,
        score: 16 + Math.round((1 - centerY) * 8),
      };
      if (!best || hit.score > best.score) best = hit;
    }
  }

  return best;
}

function figureOverlapsBrand(
  pages: unknown[],
  pageNumber: number,
  figureBox: Xywh
): boolean {
  for (const page of pages) {
    if (!page || typeof page !== "object") continue;
    const p = page as Record<string, unknown>;
    if ((Number(p.pageNumber) || 1) !== pageNumber) continue;
    for (const line of asArray(p.lines)) {
      if (!line || typeof line !== "object") continue;
      const l = line as Record<string, unknown>;
      const content = typeof l.content === "string" ? normalize(l.content) : "";
      if (!content || content.includes(" ") || content.length > 18) continue;
      const box = polygonToXywh(l.polygon);
      if (!box) continue;
      if (boxesOverlap(figureBox, box)) return true;
    }
  }
  return false;
}

function boxesOverlap(a: Xywh, b: Xywh): boolean {
  const ax2 = a[0] + a[2];
  const ay2 = a[1] + a[3];
  const bx2 = b[0] + b[2];
  const by2 = b[1] + b[3];
  return a[0] < bx2 && ax2 > b[0] && a[1] < by2 && ay2 > b[1];
}

/** Slight padding so logos/seals aren't clipped to ink-tight polygons. */
function padHighlightBox(
  xywh: Xywh,
  imageWidth: number,
  imageHeight: number,
  kind: AzureMatchKind
): Xywh {
  const padX = imageWidth * (kind === "figure" ? 0.012 : 0.006);
  const padY = imageHeight * (kind === "figure" ? 0.01 : 0.005);
  const x = Math.max(0, xywh[0] - padX);
  const y = Math.max(0, xywh[1] - padY);
  const x2 = Math.min(imageWidth, xywh[0] + xywh[2] + padX);
  const y2 = Math.min(imageHeight, xywh[1] + xywh[3] + padY);
  return [roundCoord(x), roundCoord(y), roundCoord(x2 - x), roundCoord(y2 - y)];
}

function polygonHit(
  kind: AzureMatchKind,
  polygon: unknown,
  pageNumber: number,
  pageDims: Map<number, PageDims>,
  content: string,
  score: number
): AzureLayoutHit | null {
  const xywh = polygonToXywh(polygon);
  if (!xywh) return null;
  const dims = pageDims.get(pageNumber) || [...pageDims.values()][0];
  if (!dims) return null;
  if (!isOnPage(xywh, dims.width, dims.height)) return null;
  return {
    kind,
    page: pageNumber,
    xywh,
    imageWidth: dims.width,
    imageHeight: dims.height,
    content,
    score,
  };
}

function regionToHit(
  kind: AzureMatchKind,
  region: Record<string, unknown> | null,
  pageDims: Map<number, PageDims>,
  content: string,
  score: number
): AzureLayoutHit | null {
  if (!region) return null;
  const pageNumber = Number(region.pageNumber) || 1;
  return polygonHit(kind, region.polygon, pageNumber, pageDims, content, score);
}

export function polygonToXywh(polygon: unknown): Xywh | null {
  if (!Array.isArray(polygon) || polygon.length < 8) return null;
  const nums = polygon.map((n) => Number(n));
  if (nums.some((n) => !Number.isFinite(n))) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = nums[i];
    const y = nums[i + 1];
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const w = maxX - minX;
  const h = maxY - minY;
  if (!(w > 0) || !(h > 0)) return null;
  return [roundCoord(minX), roundCoord(minY), roundCoord(w), roundCoord(h)];
}

function unionPolygons(polygons: unknown[]): Xywh | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let any = false;
  for (const polygon of polygons) {
    const box = polygonToXywh(polygon);
    if (!box) continue;
    any = true;
    minX = Math.min(minX, box[0]);
    minY = Math.min(minY, box[1]);
    maxX = Math.max(maxX, box[0] + box[2]);
    maxY = Math.max(maxY, box[1] + box[3]);
  }
  if (!any) return null;
  return [roundCoord(minX), roundCoord(minY), roundCoord(maxX - minX), roundCoord(maxY - minY)];
}

function roundCoord(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

function firstBoundingRegion(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== "object") return null;
  const obj = node as Record<string, unknown>;
  const regions = asArray(obj.boundingRegions);
  for (const region of regions) {
    if (region && typeof region === "object") {
      const r = region as Record<string, unknown>;
      if (Array.isArray(r.polygon) && r.polygon.length >= 8) return r;
    }
  }
  if (Array.isArray(obj.polygon) && obj.polygon.length >= 8) {
    return { pageNumber: obj.pageNumber ?? 1, polygon: obj.polygon };
  }
  return null;
}

function buildPageDims(pages: unknown[]): Map<number, PageDims> {
  const map = new Map<number, PageDims>();
  for (const page of pages) {
    if (!page || typeof page !== "object") continue;
    const p = page as Record<string, unknown>;
    const pageNumber = Number(p.pageNumber) || 1;
    const width = Number(p.width);
    const height = Number(p.height);
    if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
      map.set(pageNumber, { width, height, pageNumber });
    }
  }
  return map;
}

function isOnPage(xywh: Xywh, width: number, height: number): boolean {
  const [x, y, w, h] = xywh;
  if (w <= 0 || h <= 0) return false;
  if (x < -0.05 * width || y < -0.05 * height) return false;
  if (x + w > width * 1.05 || y + h > height * 1.05) return false;
  return true;
}

function contentOf(node: unknown): string | null {
  if (!node || typeof node !== "object") return null;
  const content = (node as Record<string, unknown>).content;
  return typeof content === "string" && content.trim() ? content.trim() : null;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[_:]+/g, " ")
    .replace(/[^a-z0-9.\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9.\-]+/g)
    .filter(Boolean);
}

function isStrongToken(tok: string): boolean {
  if (!tok || tok.length < 3) return false;
  if (STOPWORDS.has(tok)) return false;
  // Pure common short words
  if (tok.length <= 3 && !/\d/.test(tok)) return false;
  return true;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function findAnalyzeResult(node: unknown, depth: number): Record<string, unknown> | null {
  if (depth > 8 || node == null) return null;
  if (Array.isArray(node)) {
    for (const item of node.slice(0, 40)) {
      const found = findAnalyzeResult(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof node !== "object") return null;
  const obj = node as Record<string, unknown>;

  const direct = obj.analyzeResult;
  if (isAnalyzeResultShape(direct)) return direct as Record<string, unknown>;

  const raw = obj.raw;
  if (isAnalyzeResultShape(raw)) return raw as Record<string, unknown>;
  if (raw && typeof raw === "object") {
    const nested = (raw as Record<string, unknown>).analyzeResult;
    if (isAnalyzeResultShape(nested)) return nested as Record<string, unknown>;
  }

  const ocrFields = obj.ocr_fields ?? obj.ocrFields;
  if (ocrFields && typeof ocrFields === "object") {
    const found = findAnalyzeResult(ocrFields, depth + 1);
    if (found) return found;
  }

  const profile = obj.pdf_structure_analysis ?? obj.pdfStructureAnalysis;
  if (profile && typeof profile === "object") {
    const found = findAnalyzeResult(profile, depth + 1);
    if (found) return found;
  }

  for (const key of ["structural_profile", "structuralProfile", "raw_result", "rawResult"]) {
    if (key in obj) {
      const found = findAnalyzeResult(obj[key], depth + 1);
      if (found) return found;
    }
  }

  if (isAnalyzeResultShape(obj)) return obj;
  return null;
}

function isAnalyzeResultShape(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return (
    Array.isArray(obj.pages) || Array.isArray(obj.paragraphs) || Array.isArray(obj.keyValuePairs)
  );
}
