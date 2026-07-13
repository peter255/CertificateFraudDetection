/**
 * Single source of truth for product branding.
 * Drop an official logo at public/brand/mohesr-logo.png (or .svg) —
 * GovernmentBrand will pick it up without layout changes.
 */

export const PRODUCT_NAME = "Fraud Detection System";

export const PRODUCT_TAGLINE = "Enterprise Certificate Verification Platform";

export const PRODUCT_PILLARS = "Secure · AI Assisted · Digital Forensics";

export const ORGANIZATION_NAME = "MOHESR";

export const ORGANIZATION_FULL =
  "Ministry of Higher Education and Scientific Research";

/** Official report document title (UI + PDF). */
export const REPORT_TITLE = "Fraud Detection Report";

/** Path checked by GovernmentBrand — SVG preferred; PNG optional for PDF. */
export const BRAND_LOGO_PATHS = [
  "/brand/mohesr-logo.svg",
  "/brand/mohesr-logo.png",
] as const;

/** Preferred raster path for PDF embedding (jsPDF). */
export const BRAND_LOGO_PDF_PATH = "/brand/mohesr-logo.png";

export const BROWSER_TITLE = `${PRODUCT_NAME} · ${ORGANIZATION_NAME}`;
