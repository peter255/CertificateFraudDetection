/**
 * Lightweight tests for Azure layout highlight matching.
 * Run: npx --yes tsx --test src/utils/azureLayout.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TamperRegion } from "../types/verification";
import {
  extractAzureAnalyzeResult,
  polygonToXywh,
  remapTamperRegionsToAzureLayout,
  resolveAzureHighlight,
} from "./azureLayout";

const SAMPLE_ANALYZE = {
  apiVersion: "2024-11-30",
  content: "Holder Name: Jane Doe Issuer: Contoso Academy Certificate ID: CERT-12345",
  pages: [
    {
      pageNumber: 1,
      width: 8.5,
      height: 11,
      unit: "inch",
      words: [
        {
          content: "CERT-12345",
          polygon: [5.0, 4.0, 6.5, 4.0, 6.5, 4.3, 5.0, 4.3],
          span: { offset: 60, length: 10 },
        },
        {
          content: "Jane",
          polygon: [1.0, 2.0, 1.5, 2.0, 1.5, 2.3, 1.0, 2.3],
          span: { offset: 13, length: 4 },
        },
      ],
      lines: [
        {
          content: "Issuer: Contoso Academy",
          polygon: [1.0, 3.0, 4.0, 3.0, 4.0, 3.3, 1.0, 3.3],
          spans: [{ offset: 22, length: 23 }],
        },
      ],
    },
  ],
  paragraphs: [
    {
      content: "Awarded for outstanding completion of the program.",
      boundingRegions: [
        {
          pageNumber: 1,
          polygon: [1.0, 6.0, 7.0, 6.0, 7.0, 7.0, 1.0, 7.0],
        },
      ],
      spans: [{ offset: 80, length: 50 }],
    },
  ],
  keyValuePairs: [
    {
      key: { content: "Certificate ID", boundingRegions: [], spans: [] },
      value: {
        content: "CERT-12345",
        boundingRegions: [
          {
            pageNumber: 1,
            polygon: [5.0, 4.0, 6.5, 4.0, 6.5, 4.3, 5.0, 4.3],
          },
        ],
        spans: [{ offset: 60, length: 10 }],
      },
    },
    {
      key: { content: "Issuer", boundingRegions: [], spans: [] },
      value: {
        content: "Contoso Academy",
        boundingRegions: [
          {
            pageNumber: 1,
            polygon: [2.0, 3.0, 4.0, 3.0, 4.0, 3.3, 2.0, 3.3],
          },
        ],
      },
    },
  ],
};

describe("azureLayout", () => {
  it("converts polygons to axis-aligned xywh", () => {
    const xywh = polygonToXywh([1, 2, 3, 2, 3, 4, 1, 4]);
    assert.deepEqual(xywh, [1, 2, 2, 2]);
  });

  it("extracts analyzeResult from structural_profile nesting", () => {
    const profile = {
      pdf_structure_analysis: {
        ocr_fields: {
          raw: {
            api: "azure_document_intelligence",
            analyzeResult: SAMPLE_ANALYZE,
          },
        },
      },
    };
    const found = extractAzureAnalyzeResult(profile);
    assert.ok(found);
    assert.equal((found!.pages as unknown[]).length, 1);
  });

  it("maps seal/logo findings to a full figure region, not a thin stripe", () => {
    const analyze = {
      pages: [
        {
          pageNumber: 1,
          width: 8.5,
          height: 11,
          words: [
            {
              content: "udemy",
              // Degenerate vertical sliver (bad glyph box)
              polygon: [1.0, 0.3, 1.02, 0.3, 1.02, 2.5, 1.0, 2.5],
            },
          ],
          lines: [
            {
              content: "udemy",
              polygon: [0.6, 0.35, 2.0, 0.35, 2.0, 0.75, 0.6, 0.75],
            },
          ],
        },
      ],
      figures: [
        {
          boundingRegions: [
            {
              pageNumber: 1,
              polygon: [0.5, 0.3, 2.2, 0.3, 2.2, 0.9, 0.5, 0.9],
            },
          ],
        },
      ],
      keyValuePairs: [],
      paragraphs: [],
    };

    const vendorSliver: TamperRegion = {
      id: "vf-sliver",
      label: "Seal / Signature / Logo",
      description:
        "Repeated high-detail image blocks were found in certificate graphic zones, consistent with possible copy-move reuse.",
      severity: "medium",
      bbox: [100, 10, 3, 800], // needle strip in vendor pixel space
      page: 1,
      imageWidth: 1000,
      imageHeight: 1400,
      bboxSource: "vendor",
    };

    const remapped = remapTamperRegionsToAzureLayout([vendorSliver], analyze);
    assert.equal(remapped[0].bboxSource, "azure_document_intelligence");
    assert.equal(remapped[0].extras?.azureMatchKind, "figure");
    // Full logo-ish width, not a few pixels.
    assert.ok(remapped[0].bbox[2] / remapped[0].imageWidth > 0.1);
    assert.ok(remapped[0].bbox[3] / remapped[0].imageHeight < 0.2);
    assert.ok(remapped[0].bbox[1] < remapped[0].imageHeight * 0.2);
  });

  it("prefers quoted student name over narrative brand words like udemy", () => {
    const analyze = {
      apiVersion: "2024-11-30",
      content: "udemy Certificate Marina Azer",
      pages: [
        {
          pageNumber: 1,
          width: 8.5,
          height: 11,
          words: [
            {
              content: "udemy",
              polygon: [0.5, 0.4, 1.8, 0.4, 1.8, 0.7, 0.5, 0.7],
            },
            {
              content: "Marina",
              polygon: [2.5, 7.5, 3.4, 7.5, 3.4, 7.9, 2.5, 7.9],
            },
            {
              content: "Azer",
              polygon: [3.5, 7.5, 4.2, 7.5, 4.2, 7.9, 3.5, 7.9],
            },
          ],
          lines: [
            {
              content: "udemy",
              polygon: [0.5, 0.4, 1.8, 0.4, 1.8, 0.7, 0.5, 0.7],
            },
            {
              content: "Marina Azer",
              polygon: [2.5, 7.5, 4.2, 7.5, 4.2, 7.9, 2.5, 7.9],
            },
          ],
        },
      ],
      keyValuePairs: [],
      paragraphs: [],
    };

    const hit = resolveAzureHighlight(analyze, {
      label: "Visual Text Overlap",
      description:
        'The student name "Marina Azer" is rendered in a font size and weight that is drastically inconsistent with the document\'s hierarchy and standard Udemy templates.',
    });
    assert.ok(hit);
    assert.match(hit!.content, /Marina/i);
    assert.notEqual(normalizeTest(hit!.content), "udemy");
    // Geometry should be near the name (bottom), not the logo (top).
    assert.ok(hit!.xywh[1] > 5);
  });

  it("prefers the student subject over an instructor comparison name", () => {
    const analyze = {
      pages: [
        {
          pageNumber: 1,
          width: 8.5,
          height: 11,
          unit: "inch",
          words: [
            {
              content: "John",
              polygon: [3.0, 3.0, 3.4, 3.0, 3.4, 3.25, 3.0, 3.25],
            },
            {
              content: "Honai",
              polygon: [3.45, 3.0, 4.0, 3.0, 4.0, 3.25, 3.45, 3.25],
            },
            {
              content: "Marina",
              polygon: [2.5, 5.0, 3.1, 5.0, 3.1, 5.5, 2.5, 5.5],
            },
            {
              content: "Azer",
              polygon: [3.15, 5.0, 3.7, 5.0, 3.7, 5.5, 3.15, 5.5],
            },
          ],
          lines: [
            {
              content: "John Honai",
              polygon: [3.0, 3.0, 4.0, 3.0, 4.0, 3.25, 3.0, 3.25],
            },
            {
              content: "Marina Azer",
              polygon: [2.5, 5.0, 3.7, 5.0, 3.7, 5.5, 2.5, 5.5],
            },
          ],
        },
      ],
      keyValuePairs: [],
      paragraphs: [],
    };

    const hit = resolveAzureHighlight(analyze, {
      label: "Student Name",
      description:
        "The name 'Marina Azer' uses a different font weight, typeface, and rendering sharpness compared to the instructor name 'John Honai', indicating a digital replacement.",
    });

    assert.ok(hit);
    assert.match(hit!.content, /Marina/i);
    assert.doesNotMatch(hit!.content, /Honai/i);
    assert.ok(hit!.xywh[1] > 4.5);
  });

  it("prefers keyValuePairs boundingRegions for structured fields", () => {
    const hit = resolveAzureHighlight(SAMPLE_ANALYZE, {
      label: "Certificate ID anomaly",
      description: 'Suspicious value "CERT-12345" near the footer',
      fieldHints: ["certificate_id"],
    });
    assert.ok(hit);
    assert.equal(hit!.kind, "keyValuePair");
    assert.deepEqual(hit!.xywh, [5, 4, 1.5, 0.3]);
    assert.equal(hit!.imageWidth, 8.5);
    assert.equal(hit!.imageHeight, 11);
  });

  it("falls back to words when KV does not match", () => {
    const slim = {
      ...SAMPLE_ANALYZE,
      keyValuePairs: [],
    };
    const hit = resolveAzureHighlight(slim, {
      label: "Name edit",
      description: 'Possible manipulation around "Jane"',
    });
    assert.ok(hit);
    assert.equal(hit!.kind, "word");
    assert.equal(hit!.content, "Jane");
  });

  it("falls back to lines before paragraphs", () => {
    const slim = {
      ...SAMPLE_ANALYZE,
      keyValuePairs: [],
      pages: [
        {
          ...SAMPLE_ANALYZE.pages[0],
          words: [],
        },
      ],
    };
    const hit = resolveAzureHighlight(slim, {
      label: "Issuer mismatch",
      description: 'Issuer text "Contoso Academy" appears altered',
    });
    assert.ok(hit);
    assert.equal(hit!.kind, "line");
  });

  it("remaps tamper regions to Azure and keeps vendor when unmatched", () => {
    const vendorOnly: TamperRegion = {
      id: "vf-1:10,10,50,50",
      label: "Unrelated flicker",
      description: "No matching OCR token zzzqqq",
      severity: "medium",
      bbox: [10, 10, 50, 50],
      page: 1,
      imageWidth: 1000,
      imageHeight: 1400,
      bboxSource: "vendor",
    };
    const certId: TamperRegion = {
      id: "vf-1:100,200,80,40",
      label: "Certificate ID",
      description: 'Value "CERT-12345" looks forged',
      severity: "high",
      bbox: [100, 200, 80, 40],
      page: 1,
      imageWidth: 1000,
      imageHeight: 1400,
      bboxSource: "vendor",
    };

    const remapped = remapTamperRegionsToAzureLayout(
      [vendorOnly, certId],
      SAMPLE_ANALYZE
    );

    assert.equal(remapped[0].bboxSource, "vendor");
    assert.deepEqual(remapped[0].bbox, [10, 10, 50, 50]);

    assert.equal(remapped[1].bboxSource, "azure_document_intelligence");
    assert.deepEqual(remapped[1].rawBBox, [5, 4, 1.5, 0.3]);
    assert.ok(remapped[1].bbox[2] >= 1.5);
    assert.equal(remapped[1].imageWidth, 8.5);
    assert.equal(remapped[1].extras?.azureMatchKind, "keyValuePair");
  });
});

function normalizeTest(text: string): string {
  return text.toLowerCase().trim();
}