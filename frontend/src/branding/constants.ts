/**
 * Single source of truth for product branding.
 */

export const PRODUCT_NAME = "VERISCAN";

export const PRODUCT_TAGLINE = "Fraud verification system";

export const PRODUCT_PILLARS = "DOCUMENT INTEGRITY PROTOCOL · V4.2";

export const ORGANIZATION_NAME = "VERISCAN";

export const ORGANIZATION_FULL = "VERISCAN Document Integrity Protocol";

/** Official report document title (UI + PDF). */
export const REPORT_TITLE = "VERISCAN Forensic Report";

/** Path checked by GovernmentBrand — SVG preferred; PNG optional for PDF. */
export const BRAND_LOGO_PATHS = [
  "/brand/mohesr-logo.svg",
  "/brand/mohesr-logo.png",
] as const;

/** Preferred raster path for PDF embedding (jsPDF). */
export const BRAND_LOGO_PDF_PATH = "/brand/mohesr-logo.png";

export const BROWSER_TITLE = `${PRODUCT_NAME} · Document Integrity Protocol`;
