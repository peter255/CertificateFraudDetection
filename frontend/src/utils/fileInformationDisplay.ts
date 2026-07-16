import type { FileInformationSection, VerificationResult } from "../types/verification";

type DisplayRow = { label: string; value: string };

export type CoreFileInfoCard = { label: string; value: string };

const ALWAYS_SHOW_LABELS = new Set(["Producer", "Original Creation Date"]);

const CORE_FIELD_ORDER: Array<{ key: keyof FileInformationSection; label: string }> = [
  { key: "fileName", label: "File Name" },
  { key: "mimeType", label: "MIME Type" },
  { key: "fileType", label: "File Type" },
  { key: "fileSize", label: "File Size" },
  { key: "fileSizeBytes", label: "File Size (Bytes)" },
  { key: "numPages", label: "Number of Pages" },
  { key: "creationDate", label: "Original Creation Date" },
  { key: "modificationDate", label: "Modification Date" },
  { key: "fileModified", label: "File Modified" },
  { key: "producer", label: "Producer" },
  { key: "creator", label: "Creator" },
  { key: "editingProducer", label: "Editing Software" },
  { key: "pdfVersion", label: "PDF Version" },
  { key: "title", label: "Title" },
  { key: "author", label: "Author" },
  { key: "subject", label: "Subject" },
  { key: "keywords", label: "Keywords" },
  { key: "isPdf", label: "Is PDF" },
  { key: "parseError", label: "Parse Error" },
];

const IMAGE_PROPERTY_ROWS: Array<{ key: string; label: string }> = [
  { key: "image_width", label: "Image Width" },
  { key: "image_height", label: "Image Height" },
  { key: "color_mode", label: "Color Mode" },
  { key: "format", label: "Format" },
  { key: "dpi", label: "DPI" },
  { key: "camera_make", label: "Camera Make" },
  { key: "camera_model", label: "Camera Model" },
  { key: "has_any_exif", label: "Has EXIF" },
  { key: "has_xmp", label: "Has XMP" },
];

const PROPERTY_ALIASES: Record<string, keyof FileInformationSection> = {
  document_creation_date: "creationDate",
  CreationDate: "creationDate",
  "/CreationDate": "creationDate",
  exif_datetime_original: "creationDate",
  xmp_create_date: "creationDate",
  creation_time: "creationDate",
  png_date: "creationDate",
  date: "creationDate",
  document_modification_date: "modificationDate",
  ModDate: "modificationDate",
  "/ModDate": "modificationDate",
  exif_datetime_modified: "modificationDate",
  xmp_modify_date: "modificationDate",
  exif_datetime_digitized: "modificationDate",
  modification_time: "modificationDate",
  software: "producer",
  editing_software_xmp: "editingProducer",
  description: "subject",
  comment: "keywords",
};

const IMAGE_PROPERTY_KEYS = new Set(IMAGE_PROPERTY_ROWS.map((row) => row.key));

function humanizePropertyKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDisplayValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => formatDisplayValue(item))
      .filter((item): item is string => Boolean(item));
    return parts.length ? parts.join(", ") : null;
  }
  if (typeof value === "object") {
    try {
      const json = JSON.stringify(value);
      return json === "{}" ? null : json;
    } catch {
      return null;
    }
  }
  return String(value);
}

function pickProducerFromProperties(props: Record<string, unknown>): string | null {
  const direct = pickFromProperties(props, [
    "software",
    "producer",
    "/Producer",
    "Producer",
    "editing_software_xmp",
    "exif_software",
    "editing_producer",
  ]);
  if (direct) return direct;

  for (const [key, value] of Object.entries(props)) {
    const lower = key.toLowerCase();
    if (
      lower.includes("software") ||
      lower.includes("producer") ||
      lower.includes("creatortool") ||
      lower.includes("creator_tool")
    ) {
      const formatted = formatDisplayValue(value);
      if (formatted) return formatted;
    }
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function findDeepString(
  roots: unknown[],
  keys: string[]
): string | null {
  const queue: unknown[] = [...roots];
  const seen = new Set<unknown>();
  const wanted = new Set(keys.map((key) => key.toLowerCase()));

  while (queue.length > 0) {
    const node = queue.shift();
    if (!node || seen.has(node)) continue;
    seen.add(node);

    if (Array.isArray(node)) {
      queue.push(...node);
      continue;
    }
    if (typeof node !== "object") continue;

    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (wanted.has(key.toLowerCase())) {
        const formatted = formatDisplayValue(value);
        if (formatted) return formatted;
      }
      if (value && typeof value === "object") {
        queue.push(value);
      }
    }
  }
  return null;
}

export function enrichFileInformationFromResult(
  info: FileInformationSection,
  result: VerificationResult | null
): FileInformationSection {
  if (!result || formatDisplayValue(info.producer)) return info;

  const structural = result.technical.structuralProfile;
  const pdfStructure = asRecord(structural?.pdf_structure_analysis);
  const pdfMetadata = asRecord(pdfStructure?.pdf_metadata);

  const producer =
    findDeepString(
      [
        pdfMetadata,
        pdfStructure,
        structural,
        result.technical.engineResults,
        result.technical.layerDetails,
        asRecord(result.technical.layerDetails)?.metadata,
        asRecord(result.technical.layerDetails)?.exif,
        asRecord(result.technical.layerDetails)?.document_preparation,
      ],
      [
        "producer",
        "Producer",
        "/Producer",
        "software",
        "Software",
        "editing_producer",
        "editing_software_xmp",
        "creator",
        "Creator",
      ]
    ) ?? null;

  return producer ? { ...info, producer } : info;
}

function pickFromProperties(
  props: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const formatted = formatDisplayValue(props[key]);
    if (formatted) return formatted;
  }
  return null;
}

export function normalizeFileInformation(
  info: FileInformationSection
): FileInformationSection {
  const props = info.documentProperties ?? {};

  const creationDate =
    formatDisplayValue(info.creationDate) ??
    pickFromProperties(props, [
      "document_creation_date",
      "CreationDate",
      "/CreationDate",
      "exif_datetime_original",
      "xmp_create_date",
      "creation_time",
      "png_date",
      "date",
    ]);

  const modificationDate =
    formatDisplayValue(info.modificationDate) ??
    pickFromProperties(props, [
      "document_modification_date",
      "ModDate",
      "/ModDate",
      "exif_datetime_modified",
      "xmp_modify_date",
      "exif_datetime_digitized",
      "modification_time",
    ]);

  const producer =
    formatDisplayValue(info.producer) ??
    pickProducerFromProperties(props) ??
    formatDisplayValue(info.editingProducer) ??
    formatDisplayValue(info.creator);

  return {
    ...info,
    creationDate,
    modificationDate,
    producer,
  };
}

function shouldSkipPropertyRow(
  key: string,
  value: unknown,
  normalized: FileInformationSection,
  shownLabels: Set<string>
): boolean {
  if (key === "note") return true;
  if (IMAGE_PROPERTY_KEYS.has(key)) return true;

  const alias = PROPERTY_ALIASES[key];
  if (alias) {
    const propVal = formatDisplayValue(value);
    const aliasVal = formatDisplayValue(normalized[alias]);
    if (propVal && aliasVal && propVal === aliasVal) return true;
  }

  const label = humanizePropertyKey(key);
  const formatted = formatDisplayValue(value);
  if (formatted && shownLabels.has(`${label}:${formatted}`.toLowerCase())) {
    return true;
  }
  return false;
}

function resolveFormatLabel(info: FileInformationSection, file: File | null): string {
  const fromType = formatDisplayValue(info.fileType);
  if (fromType) return fromType;

  const fromMime =
    formatDisplayValue(info.mimeType)?.split("/")[1]?.toUpperCase() ??
    file?.type?.split("/")[1]?.toUpperCase() ??
    null;
  if (fromMime) return fromMime;

  const fromProps = formatDisplayValue(info.documentProperties?.format);
  if (fromProps) return fromProps;

  return "—";
}

function resolvePageCount(info: FileInformationSection): string {
  const pages = info.numPages;
  if (pages != null && Number.isFinite(pages) && pages > 0) {
    return String(Math.trunc(pages));
  }
  return "1";
}

export function buildCoreFileInfoCards(
  info: FileInformationSection | null | undefined,
  file: File | null
): CoreFileInfoCard[] {
  const base: FileInformationSection =
    info ??
    ({
      fileType: file?.type?.split("/")[1]?.toUpperCase() ?? "—",
      fileSize: "—",
      numPages: 1,
      fileName: file?.name ?? null,
      mimeType: file?.type ?? null,
    } satisfies FileInformationSection);

  const fileName =
    formatDisplayValue(base.fileName) ?? file?.name?.trim() ?? "—";
  const format = resolveFormatLabel(base, file);
  const size = formatDisplayValue(base.fileSize) ?? "—";

  return [
    { label: "File Name", value: fileName },
    { label: "Format", value: format },
    { label: "Size", value: size },
    { label: "Number of Pages", value: resolvePageCount(base) },
  ];
}

export function buildFileInformationRows(
  info: FileInformationSection
): DisplayRow[] {
  const normalized = normalizeFileInformation(info);
  const rows: DisplayRow[] = [];
  const seen = new Set<string>();
  const shownLabels = new Set<string>();

  const pushRow = (label: string, value: unknown) => {
    const formatted =
      formatDisplayValue(value) ?? (ALWAYS_SHOW_LABELS.has(label) ? "—" : null);
    if (!formatted) return;
    const key = `${label}:${formatted}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    shownLabels.add(key);
    rows.push({ label, value: formatted });
  };

  for (const field of CORE_FIELD_ORDER) {
    pushRow(field.label, normalized[field.key]);
  }

  const props = normalized.documentProperties ?? {};
  for (const imageField of IMAGE_PROPERTY_ROWS) {
    pushRow(imageField.label, props[imageField.key]);
  }

  const sortedKeys = Object.keys(props).sort((a, b) => a.localeCompare(b));
  for (const key of sortedKeys) {
    if (shouldSkipPropertyRow(key, props[key], normalized, shownLabels)) continue;
    pushRow(humanizePropertyKey(key), props[key]);
  }

  return rows;
}

export function readImageDimensionsFromFile(
  file: File
): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith("image/")) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      if (width > 0 && height > 0) {
        resolve({ width, height });
      } else {
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

export function mergeClientImageMetadata(
  info: FileInformationSection,
  dimensions: { width: number; height: number } | null,
  file: File | null
): FileInformationSection {
  if (!dimensions && !file) return info;

  const props = { ...(info.documentProperties ?? {}) };
  if (dimensions) {
    if (!props.image_width) props.image_width = dimensions.width;
    if (!props.image_height) props.image_height = dimensions.height;
  }
  if (file?.type && !props.format) {
    props.format = file.type.split("/")[1]?.toUpperCase() ?? info.fileType;
  }
  if (dimensions && !props.has_any_exif) {
    props.has_any_exif = false;
  }
  if (!props.has_xmp) {
    props.has_xmp = false;
  }

  return {
    ...info,
    documentProperties: props,
  };
}
