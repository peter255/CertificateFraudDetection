/**
 * Classify detailed findings as element-level (mappable via Azure DI polygons)
 * vs document-level (overall forensic/template/metadata — no highlight).
 *
 * Label cues win over incidental words in the description (e.g. "template mismatch"
 * that merely mentions "student name" must stay document-level).
 */

export type FindingScope = "element" | "document";

export const DOCUMENT_LEVEL_NOTE =
  "This finding applies to the overall document structure or forensic characteristics and cannot be mapped to a single location. Therefore, no specific highlight is displayed to avoid misleading the user.";

export interface FindingScopeInput {
  label?: string | null;
  description?: string | null;
  layer?: string | null;
  location?: string | null;
  field?: string | null;
  fieldLabel?: string | null;
  check?: string | null;
  evidenceClass?: string | null;
}

/** Concrete localizable fields — matched primarily against the label / field name. */
const ELEMENT_LABEL_PATTERNS: RegExp[] = [
  /\bstudent\s*name\b/i,
  /\bholder(?:\s*name)?\b/i,
  /\brecipient(?:\s*name)?\b/i,
  /\bcandidate(?:\s*name)?\b/i,
  /\bcertificate\s*(?:id|no|number|#|reference)\b/i,
  /\breference\s*(?:number|no|#)\b/i,
  /\bcredential\s*(?:id|number)\b/i,
  /\bserial\s*number\b/i,
  /\bissue\s*date\b/i,
  /\baward(?:ed)?\s*date\b/i,
  /\bexpiration\s*date\b/i,
  /\bqr(?:\s*code)?\b/i,
  /\bbarcode\b/i,
  /\blogo\b/i,
  /\bseal\b/i,
  /\bsignature\b/i,
  /\bstamp\b/i,
  /\bemblem\b/i,
  /\bissuer(?:\s*name)?\b/i,
];

/** Whole-document findings — never draw a bbox. Prefer matching the label. */
const DOCUMENT_LABEL_PATTERNS: RegExp[] = [
  /\btemplate\s*mismatch\b/i,
  /\bvisual\s*template\b/i,
  /\blayout\s*(?:mismatch|inversion|inverted|overall)\b/i,
  /\boverall\s*layout\b/i,
  /\bmetadata\b/i,
  /\bfile\s*structure\b/i,
  /\bpdf\s*structure\b/i,
  /\bprovenance\b/i,
  /\bc2pa\b/i,
  /\bcontent\s*credentials?\b/i,
  /\bai[- ]generated\b/i,
  /\bai[- ]generation\b/i,
  /\bdocument[- ]level\b/i,
  /\bdocument\s*structure\b/i,
  /\bcopy[\s-]?move\b/i,
  /\bimage\s*block\b/i,
  /\bheatmap\b/i,
  /\bvisual\s*text\s*overlap\b/i,
];

const DOCUMENT_DESCRIPTION_PATTERNS: RegExp[] = [
  /\bfundamentally\s+inverted\b/i,
  /\bofficial\s+\w+\s+templates?\b/i,
  /\bentire\s+document\b/i,
  /\boverall\s+(?:document|layout|structure|forensic)\b/i,
  /\bcannot\s+be\s+mapped\b/i,
  /\bforensic\s+characteristics\b/i,
];

/**
 * Automatic scope from finding wording / field cues.
 */
export function classifyFindingScope(input: FindingScopeInput): FindingScope {
  const label = [input.label, input.fieldLabel, input.field, input.check]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .join(" ");
  const description = typeof input.description === "string" ? input.description : "";
  const extras = [input.layer, input.location, input.evidenceClass]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .join(" ");

  if (!label.trim() && !description.trim()) return "document";

  // 1) Document label is authoritative.
  if (DOCUMENT_LABEL_PATTERNS.some((re) => re.test(label))) {
    return "document";
  }

  // 2) Clear element label (Student Name, Logo, Certificate ID, …).
  if (ELEMENT_LABEL_PATTERNS.some((re) => re.test(label))) {
    return "element";
  }

  // 3) Document cues in description without a concrete element label.
  if (
    DOCUMENT_LABEL_PATTERNS.some((re) => re.test(description)) ||
    DOCUMENT_DESCRIPTION_PATTERNS.some((re) => re.test(description)) ||
    DOCUMENT_LABEL_PATTERNS.some((re) => re.test(extras))
  ) {
    return "document";
  }

  // 4) Element only when description has a quoted target AND a field cue —
  //    not merely mentioning "student name" inside a layout narrative.
  if (
    /["“'][^"”']{2,60}["”']/.test(description) &&
    ELEMENT_LABEL_PATTERNS.some((re) => re.test(description))
  ) {
    return "element";
  }

  // 5) Layout / template / copy-move without a named element → document.
  if (
    /\b(copy[\s-]?move|image\s*block|pixel\s*edit|layout|template|background|texture|overlap)\b/i.test(
      `${label} ${description}`
    )
  ) {
    return "document";
  }

  return "document";
}

export function isElementLevelFinding(input: FindingScopeInput): boolean {
  return classifyFindingScope(input) === "element";
}

export function isDocumentLevelFinding(input: FindingScopeInput): boolean {
  return classifyFindingScope(input) === "document";
}
