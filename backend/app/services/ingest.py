import io
from typing import Optional

import fitz  # PyMuPDF
import pandas as pd

from ..core.logging import get_logger

logger = get_logger(__name__)

_VISION_THRESHOLD = 100  # chars — below this the PDF is treated as scanned
_PDF_RENDER_ZOOM = 2.0   # 2× zoom when rasterising a scanned PDF page


class IngestResult:
    __slots__ = ("text", "image_bytes", "media_type", "input_type")

    def __init__(
        self,
        text: Optional[str],
        image_bytes: Optional[bytes],
        media_type: Optional[str],
        input_type: str,
    ) -> None:
        self.text = text
        self.image_bytes = image_bytes
        self.media_type = media_type
        self.input_type = input_type  # "pdf_text" | "pdf_vision" | "image" | "xlsx"


class IngestService:
    async def process(self, data: bytes, content_type: str, filename: str) -> IngestResult:
        ct = content_type.lower()
        fn = filename.lower()

        if ct == "application/pdf" or fn.endswith(".pdf"):
            return await self._process_pdf(data)

        if ct in ("image/jpeg", "image/jpg") or fn.endswith((".jpg", ".jpeg")):
            return IngestResult(None, data, "image/jpeg", "image")

        if ct == "image/png" or fn.endswith(".png"):
            return IngestResult(None, data, "image/png", "image")

        if (
            ct in (
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "application/vnd.ms-excel",
            )
            or fn.endswith((".xlsx", ".xls"))
        ):
            return await self._process_xlsx(data)

        raise ValueError(f"Unsupported file type: {content_type} / {filename}")

    async def _process_pdf(self, data: bytes) -> IngestResult:
        doc = fitz.open(stream=data, filetype="pdf")
        try:
            text_parts = [page.get_text() for page in doc]
            full_text = "\n".join(text_parts).strip()
        finally:
            doc.close()

        if len(full_text) >= _VISION_THRESHOLD:
            logger.info("pdf_text_extracted", chars=len(full_text))
            return IngestResult(full_text, None, None, "pdf_text")

        # Scanned PDF — rasterise first page for Claude Vision
        logger.info("pdf_scanned_vision_fallback", chars=len(full_text))
        doc = fitz.open(stream=data, filetype="pdf")
        try:
            page = doc[0]
            mat = fitz.Matrix(_PDF_RENDER_ZOOM, _PDF_RENDER_ZOOM)
            pix = page.get_pixmap(matrix=mat)
            img_bytes = pix.tobytes("png")
        finally:
            doc.close()

        return IngestResult(None, img_bytes, "image/png", "pdf_vision")

    async def _process_xlsx(self, data: bytes) -> IngestResult:
        buf = io.BytesIO(data)
        dfs: dict = pd.read_excel(buf, sheet_name=None)
        parts: list[str] = []
        for sheet_name, df in dfs.items():
            parts.append(f"=== Sheet: {sheet_name} ===")
            parts.append(df.to_string(index=False, na_rep=""))
        text = "\n\n".join(parts)
        logger.info("xlsx_extracted", sheets=len(dfs), chars=len(text))
        return IngestResult(text, None, None, "xlsx")
