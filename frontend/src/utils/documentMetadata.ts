/**
 * Builds Document Information fields from the uploaded file and
 * engine-returned metadata already present on VerificationResult.
 * Never invents values — missing fields stay null / omitted.
 */

import type { DocumentInfoData, VerificationResult } from "../types/verification";

const INVALID_VALUES = new Set([
  "",
  "-",
  "—",
  "–",
  "unknown",
  "n/a",
  "na",
  "null",
  "undefined",
  "pending",
  "not available",
  "not provided",
  "none",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function isDisplayable(value: string | null | undefined): value is string {
  if (value == null) return false;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && !INVALID_VALUES.has(normalized);
}

function cleanString(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return isDisplayable(trimmed) ? trimmed : null;
}

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function formatBytes(bytes: number): string | null {
  if (!Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMaybeDate(value: unknown): string | null {
  const raw = cleanString(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return raw;
}

function collectPools(result: VerificationResult | null): Record<string, unknown>[] {
  if (!result) return [];
  const pools: Record<string, unknown>[] = [];
  const push = (value: unknown) => {
    const rec = asRecord(value);
    if (rec) pools.push(rec);
  };

  push(result.technical.structuralProfile);
  push(result.technical.classification);
  push(result.technical.layerDetails);
  push(result.technical.engineResults);

  const layer = result.technical.layerDetails;
  if (layer) {
    push(layer.document_preparation);
    push(layer.exif);
    push(layer.metadata);
    push(asRecord(layer.document_preparation)?.ocr);
    push(asRecord(layer.document_preparation)?.metadata);
    push(asRecord(layer.overlay_detector)?.metadata);
  }

  return pools;
}

function findFirst(pools: Record<string, unknown>[], keys: string[]): unknown {
  const keySet = new Set(keys.map((k) => k.toLowerCase()));

  const walk = (node: unknown, currentDepth: number): unknown => {
    if (currentDepth > 5 || node == null) return undefined;
    const rec = asRecord(node);
    if (!rec) return undefined;

    for (const [key, value] of Object.entries(rec)) {
      if (keySet.has(key.toLowerCase()) && value != null && value !== "") {
        if (typeof value === "object" && !Array.isArray(value)) continue;
        return value;
      }
    }

    for (const value of Object.values(rec)) {
      const found = walk(value, currentDepth + 1);
      if (found !== undefined) return found;
    }
    return undefined;
  };

  for (const pool of pools) {
    const found = walk(pool, 0);
    if (found !== undefined) return found;
  }
  return undefined;
}

function fileTypeFromName(fileName: string | null): string | null {
  if (!fileName || !fileName.includes(".")) return null;
  const ext = fileName.split(".").pop()?.trim().toLowerCase();
  return ext ? ext.toUpperCase() : null;
}

function mimeToFileType(mime: string | null): string | null {
  if (!mime) return null;
  const subtype = mime.split("/")[1]?.split(";")[0]?.trim();
  if (!subtype) return null;
  if (subtype === "jpeg") return "JPG";
  return subtype.toUpperCase();
}

const KNOWN_EXTRA_KEYS = [
  "producer",
  "creator",
  "author",
  "title",
  "software",
  "camera",
  "device",
  "orientation",
  "bit_depth",
  "bits_per_pixel",
  "compression",
  "pdf_version",
  "page_size",
  "paper_size",
];

/**
 * Assemble document-info values from the selected file and active engine result.
 */
export function buildDocumentInfoData(input: {
  file: File | null;
  result: VerificationResult | null;
  pageCount: number | null;
  uploadTime: Date | null;
  processingMs: number | null;
  formatUploadTime: (date: Date) => string;
  formatProcessingTime: (ms: number) => string;
}): DocumentInfoData | null {
  const { file, result } = input;
  if (!file && !result) return null;

  const pools = collectPools(result);
  const fileName = cleanString(file?.name) ?? null;
  const mimeType =
    cleanString(file?.type) ||
    cleanString(
      findFirst(pools, ["mime_type", "mimeType", "content_type", "contentType", "mimetype"])
    );

  const fileKind =
    cleanString(result?.fileKind) ||
    cleanString(findFirst(pools, ["file_kind", "fileKind", "kind"]));

  const fileType =
    fileTypeFromName(fileName) ||
    mimeToFileType(mimeType) ||
    cleanString(findFirst(pools, ["file_type", "fileType", "format"]));

  const widthRaw = findFirst(pools, [
    "width",
    "image_width",
    "imageWidth",
    "pixel_width",
    "page_width",
  ]);
  const heightRaw = findFirst(pools, [
    "height",
    "image_height",
    "imageHeight",
    "pixel_height",
    "page_height",
  ]);

  let width = cleanString(widthRaw);
  let height = cleanString(heightRaw);
  if ((!width || !height) && result?.tamperRegions?.length) {
    const region = result.tamperRegions.find(
      (r) =>
        Number.isFinite(r.imageWidth) &&
        Number.isFinite(r.imageHeight) &&
        r.imageWidth > 0 &&
        r.imageHeight > 0
    );
    if (region) {
      width = width ?? String(region.imageWidth);
      height = height ?? String(region.imageHeight);
    }
  }

  const dpiX = findFirst(pools, ["dpi", "x_dpi", "xDpi", "dpi_x", "horizontal_dpi"]);
  const dpiY = findFirst(pools, ["y_dpi", "yDpi", "dpi_y", "vertical_dpi"]);
  const dpiXClean = cleanString(dpiX);
  const dpiYClean = cleanString(dpiY);
  const dpi =
    dpiXClean && dpiYClean && dpiXClean !== dpiYClean
      ? `${dpiXClean} × ${dpiYClean}`
      : dpiXClean || dpiYClean;

  // Explicit resolution field only — do not synthesize from width/height.
  const resolution = cleanString(
    findFirst(pools, ["resolution", "image_resolution", "pixel_resolution"])
  );

  const pagesFromEngine = findFirst(pools, [
    "pages",
    "page_count",
    "pageCount",
    "num_pages",
    "number_of_pages",
    "page_total",
  ]);
  const pages =
    cleanString(pagesFromEngine) ||
    (input.pageCount !== null && input.pageCount > 0 ? String(input.pageCount) : null);

  const fileHash = cleanString(
    findFirst(pools, [
      "file_hash",
      "fileHash",
      "hash",
      "sha256",
      "sha_256",
      "md5",
      "checksum",
      "digest",
    ])
  );

  const createdDate = formatMaybeDate(
    findFirst(pools, [
      "created",
      "created_at",
      "createdAt",
      "creation_date",
      "creationDate",
      "create_date",
      "date_created",
    ])
  );

  const modifiedDate = formatMaybeDate(
    findFirst(pools, [
      "modified",
      "modified_at",
      "modifiedAt",
      "modification_date",
      "modificationDate",
      "modify_date",
      "date_modified",
      "last_modified",
    ])
  );

  // verifiedAt lives only on Investigation Banner — not Document Information.
  const processingTime =
    result?.engineDurationMs != null && Number.isFinite(result.engineDurationMs)
      ? input.formatProcessingTime(result.engineDurationMs)
      : input.processingMs != null
        ? input.formatProcessingTime(input.processingMs)
        : null;

  const extras: Array<{ label: string; value: string }> = [];
  const usedLabels = new Set<string>();

  // Metadata notes / ML / OCR labels belong in Technical Analysis (engineResults),
  // not Document Information.

  for (const key of KNOWN_EXTRA_KEYS) {
    const value = cleanString(findFirst(pools, [key]));
    if (!value) continue;
    const label = humanizeKey(key);
    if (usedLabels.has(label.toLowerCase())) continue;
    usedLabels.add(label.toLowerCase());
    extras.push({ label, value });
  }

  const structural = result?.technical.structuralProfile;
  if (structural) {
    for (const [key, value] of Object.entries(structural)) {
      if (typeof value === "object") continue;
      const cleaned = cleanString(value);
      if (!cleaned) continue;
      const label = humanizeKey(key);
      const labelKey = label.toLowerCase();
      if (usedLabels.has(labelKey)) continue;
      if (
        /mime|width|height|dpi|resolution|hash|page|created|modified|color|scan|kind|type|size/.test(
          key.toLowerCase()
        )
      ) {
        continue;
      }
      usedLabels.add(labelKey);
      extras.push({ label, value: cleaned });
    }
  }

  return {
    fileName,
    fileSize: file ? formatBytes(file.size) : null,
    fileType,
    mimeType,
    width,
    height,
    resolution,
    dpi,
    colorSpace: cleanString(
      findFirst(pools, [
        "color_space",
        "colorSpace",
        "colorspace",
        "colour_space",
        "color_mode",
        "colorMode",
      ])
    ),
    pages,
    fileHash,
    createdDate,
    modifiedDate,
    verifiedAt: null,
    documentType: cleanString(result?.documentType),
    holderName: cleanString(result?.holderName),
    issuingAuthority: cleanString(result?.issuingAuthority),
    issueDate: cleanString(result?.issueDate),
    fileKind,
    isScan: typeof result?.isScan === "boolean" ? result.isScan : null,
    processingTime,
    uploadTime: input.uploadTime ? input.formatUploadTime(input.uploadTime) : null,
    extras,
  };
}
