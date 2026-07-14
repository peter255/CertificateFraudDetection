from __future__ import annotations

from fastapi import APIRouter

from app.shared.logging.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/v1")


def _include_vendor(import_path: str, router_attr: str = "router") -> None:
    """
    Register a vendor router independently.

    A failure (missing module, import error, etc.) is logged and skipped so
    other vendors keep serving. To permanently disable a vendor, remove its
    call below — no other vendor code needs to change.
    """
    try:
        module = __import__(import_path, fromlist=[router_attr])
        vendor_router = getattr(module, router_attr)
        router.include_router(vendor_router)
        logger.info("Registered vendor router: %s", import_path)
    except Exception as exc:  # noqa: BLE001 — isolation boundary
        logger.error(
            "Vendor router not registered (%s): %s. Other vendors are unaffected.",
            import_path,
            exc,
        )


# Each vendor is registered independently. Add a third vendor by appending one call.
_include_vendor("app.presentation.api.vendors.truthscan")
_include_vendor("app.presentation.api.vendors.paperwork")

# First-party forensic modules (non-vendor). Failures are isolated the same way.
_include_vendor("app.presentation.api.pdf_structure")
