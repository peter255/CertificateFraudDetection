/**
 * Run: npx --yes tsx --test src/utils/findingScope.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DOCUMENT_LEVEL_NOTE,
  classifyFindingScope,
} from "./findingScope";

describe("findingScope", () => {
  it("classifies concrete certificate fields as element-level", () => {
    assert.equal(
      classifyFindingScope({
        label: "Student Name",
        description: 'The student name "Marina Azer" has inconsistent font weight.',
      }),
      "element"
    );
    assert.equal(
      classifyFindingScope({
        label: "Certificate Reference",
        description: "Reference Number: 0004 shows different alignment.",
      }),
      "element"
    );
    assert.equal(
      classifyFindingScope({
        label: "Seal / Signature / Logo",
        description: "Repeated high-detail image blocks in graphic zones.",
      }),
      "element"
    );
    assert.equal(
      classifyFindingScope({ label: "QR Code", description: "QR appears pasted." }),
      "element"
    );
  });

  it("keeps template mismatch document-level even when description mentions student name", () => {
    assert.equal(
      classifyFindingScope({
        label: "Visual Template Mismatch",
        description:
          "The layout is fundamentally inverted compared to official Udemy templates; the course title is placed at the top while the student name is at the bottom.",
      }),
      "document"
    );
  });

  it("treats vague visual text overlap as document-level (no safe Azure target)", () => {
    assert.equal(
      classifyFindingScope({
        label: "Visual Text Overlap",
        description: "Visible OCR text regions overlap in an academic certificate field.",
      }),
      "document"
    );
  });

  it("classifies metadata / AI / provenance as document-level", () => {
    assert.equal(
      classifyFindingScope({
        label: "Metadata Analysis",
        description: "Creation and modification dates are inconsistent.",
      }),
      "document"
    );
    assert.equal(
      classifyFindingScope({
        label: "AI-Generated Detection",
        description: "Content Credentials identify OpenAI generation.",
      }),
      "document"
    );
    assert.equal(
      classifyFindingScope({
        label: "File Structure",
        description: "PDF structure provenance indicators.",
      }),
      "document"
    );
  });

  it("exposes the user-facing document-level note", () => {
    assert.match(DOCUMENT_LEVEL_NOTE, /cannot be mapped to a single location/i);
  });
});
