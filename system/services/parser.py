# -*- coding: utf-8 -*-
"""Aggregated Financial Report Parser."""

import json
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator

from logger import get_logger
from services.llm_factory import create_llm_for_task

logger = get_logger(__name__)

DEFAULT_PARSER_MODEL = "google/gemini-2.5-flash-lite-preview-09-2025"


# ==============================================================================
# PYDANTIC MODELS
# ==============================================================================

class FinancialItem(BaseModel):
    item_code:     Optional[str]   = Field(default=None, description="Mã số chỉ tiêu")
    item_name:     str             = Field(description="Tên chỉ tiêu")
    value:         Optional[float] = Field(default=None, description="Giá trị số (đã chuyển về VND)")
    notes_ref:     Optional[str]   = Field(default=None, description="Thuyết minh")
    original_name: Optional[str]   = Field(default=None, description="Tên gốc trong báo cáo nếu khác")


class ParsedStatement(BaseModel):
    items: List[FinancialItem] = Field(default_factory=list)


class ParsedReport(BaseModel):
    company_name:     Optional[str] = Field(default=None)
    stock_ticker:     Optional[str] = Field(default=None)
    year:             Optional[int] = Field(default=None)
    quarter:          Optional[int] = Field(default=None)
    unit:             str           = Field(default="VND")
    is_ytd:           bool          = Field(default=False)
    balance_sheet:    ParsedStatement = Field(default_factory=ParsedStatement)
    income_statement: ParsedStatement = Field(default_factory=ParsedStatement)
    cash_flow:        ParsedStatement = Field(default_factory=ParsedStatement)
    bs_found:         bool          = Field(default=False)
    pl_found:         bool          = Field(default=False)
    cf_found:         bool          = Field(default=False)
    warnings:         List[str]     = Field(default_factory=list)

    @field_validator("quarter", mode="before")
    @classmethod
    def parse_quarter(cls, v):
        if v is None:
            return None
        if isinstance(v, int):
            return v
        if isinstance(v, str):
            m = re.search(r"(\d+)", v)
            if m:
                return int(m.group(1))
            try:
                return int(v)
            except ValueError:
                return None
        return None


# ==============================================================================
# EXTRACTION BUNDLE
# ==============================================================================

@dataclass
class ExtractionBundle:
    balance_sheet:    str = ""
    income_statement: str = ""
    cash_flow:        str = ""
    notes_text:       str = ""
    notes_tables:     str = ""
    other_text:       str = ""
    metadata:         Dict[str, Any] = field(default_factory=dict)

    def get_tables_content(self) -> str:
        parts = []
        if self.balance_sheet:
            parts.append("## BẢNG CÂN ĐỐI KẾ TOÁN\n" + self.balance_sheet)
        if self.income_statement:
            parts.append("## BÁO CÁO KẾT QUẢ HOẠT ĐỘNG KINH DOANH\n" + self.income_statement)
        if self.cash_flow:
            parts.append("## BÁO CÁO LƯU CHUYỂN TIỀN TỆ\n" + self.cash_flow)
        return "\n\n".join(parts)

    def has_content(self) -> bool:
        return bool(self.balance_sheet or self.income_statement or self.cash_flow)


# ==============================================================================
# PARSER
# ==============================================================================

class AggregatedParser:

    def __init__(self, model: Optional[str] = None):
        self.model = model or DEFAULT_PARSER_MODEL

    # ------------------------------------------------------------------
    # PUBLIC
    # ------------------------------------------------------------------

    def parse(self, bundle: ExtractionBundle) -> ParsedReport:
        if not bundle.has_content():
            logger.warning("No content to parse")
            return ParsedReport(warnings=["No financial tables found in extraction"])

        result = ParsedReport()

        # Apply metadata
        if bundle.metadata:
            result.company_name = bundle.metadata.get("company_name")
            result.stock_ticker = bundle.metadata.get("stock_ticker")
            result.year         = bundle.metadata.get("year")
            result.quarter      = bundle.metadata.get("quarter")
            result.unit         = bundle.metadata.get("unit", "VND") or "VND"
            result.is_ytd       = bundle.metadata.get("is_ytd", False)

        # Gọi LLM riêng cho từng báo cáo để tránh JSON bị cắt
        sections = []
        if bundle.balance_sheet:
            sections.append(("balance_sheet",    "## BẢNG CÂN ĐỐI KẾ TOÁN\n"                        + bundle.balance_sheet))
        if bundle.income_statement:
            sections.append(("income_statement", "## BÁO CÁO KẾT QUẢ HOẠT ĐỘNG KINH DOANH\n"        + bundle.income_statement))
        if bundle.cash_flow:
            sections.append(("cash_flow",        "## BÁO CÁO LƯU CHUYỂN TIỀN TỆ\n"                  + bundle.cash_flow))

        llm = create_llm_for_task("parsing", model=self.model)

        for section_name, content in sections:
            items = self._parse_section(llm, section_name, content, result.unit)
            if items is not None:
                if section_name == "balance_sheet":
                    result.balance_sheet.items = items
                elif section_name == "income_statement":
                    result.income_statement.items = items
                elif section_name == "cash_flow":
                    result.cash_flow.items = items
            else:
                result.warnings.append(f"{section_name}: parse failed")

        result.bs_found = len(result.balance_sheet.items) > 0
        result.pl_found = len(result.income_statement.items) > 0
        result.cf_found = len(result.cash_flow.items) > 0

        logger.info(
            f"Parsed: BS={len(result.balance_sheet.items)}, "
            f"PL={len(result.income_statement.items)}, "
            f"CF={len(result.cash_flow.items)} items"
        )
        return result

    def to_dict(self, report: ParsedReport) -> Dict[str, Any]:
        def _items(stmt):
            return [
                {
                    "item_code":     item.item_code,
                    "item_name":     item.item_name,
                    "value":         item.value,
                    "notes_ref":     item.notes_ref,
                    "original_name": item.original_name,
                }
                for item in stmt.items
            ]
        return {
            "metadata": {
                "company_name": report.company_name,
                "stock_ticker": report.stock_ticker,
                "year":         report.year,
                "quarter":      report.quarter,
                "unit":         report.unit,
                "is_ytd":       report.is_ytd,
            },
            "balance_sheet":    {"items": _items(report.balance_sheet)},
            "income_statement": {"items": _items(report.income_statement)},
            "cash_flow":        {"items": _items(report.cash_flow)},
            "status": {
                "bs_found": report.bs_found,
                "pl_found": report.pl_found,
                "cf_found": report.cf_found,
                "warnings": report.warnings,
            },
        }

    # ------------------------------------------------------------------
    # PRIVATE
    # ------------------------------------------------------------------

    def _parse_section(
        self, llm, section_name: str, content: str, unit: str
    ) -> Optional[List[FinancialItem]]:
        """
        Gọi LLM 1 lần cho 1 báo cáo, trả về list FinancialItem.
        Thử tối đa 2 lần nếu JSON lỗi.
        """
        system_msg = self._get_system_prompt()
        user_msg = (
            f"Trích xuất tất cả chỉ tiêu từ báo cáo sau:\n\n{content}\n\n"
            f"Đơn vị gốc trong báo cáo: {unit}\n"
            "Chỉ trả về JSON array, không markdown, không giải thích.\n"
            'Format: [{"item_code": "...", "item_name": "...", "value": 0, "notes_ref": null, "original_name": null}]'
        )

        for attempt in range(2):
            try:
                resp = llm.invoke([("system", system_msg), ("human", user_msg)])
                content_str = (getattr(resp, "content", None) or "").strip()

                # Ưu tiên lấy JSON trong code fence
                m = re.search(r"```(?:json)?\s*(\[.*?\])\s*```", content_str, flags=re.DOTALL)
                if m:
                    json_str = m.group(1)
                else:
                    # Fallback: tìm [...] đầu tiên
                    m = re.search(r"\[.*\]", content_str, flags=re.DOTALL)
                    if not m:
                        logger.warning(f"{section_name} attempt {attempt+1}: no JSON array found")
                        continue
                    json_str = m.group(0)

                items_data = json.loads(json_str)
                items = [FinancialItem(**i) for i in items_data]
                logger.info(f"{section_name}: {len(items)} items parsed")
                return items

            except Exception as e:
                logger.error(f"{section_name} attempt {attempt+1} failed: {e}")

        return None

    def _get_system_prompt(self) -> str:
        return """Bạn là chuyên gia phân tích báo cáo tài chính Việt Nam.
Nhiệm vụ: Trích xuất toàn bộ chỉ tiêu từ báo cáo tài chính sang JSON array.

## QUY TẮC:

### 1. Trích xuất chỉ tiêu
- Giữ đúng tên gốc trong báo cáo, không tự ý chuẩn hóa.
- Lấy mã số chỉ tiêu (item_code) nếu có (VD: 100, 110, 200...).
- Lấy số thuyết minh (notes_ref) nếu có.

### 2. Xử lý số liệu - chuyển về VND
- Đơn vị "triệu VND" → nhân 1.000.000
- Đơn vị "tỷ VND"    → nhân 1.000.000.000
- Đơn vị "nghìn VND" → nhân 1.000
- Số trong ngoặc đơn (1.234) = số âm -1.234.000 (nếu đơn vị triệu)

### 3. Định dạng số Việt Nam
- Dấu chấm (.) = phân cách hàng nghìn: 1.234.567 = 1234567
- Dấu phẩy (,) = phân cách thập phân: 1.234,56 = 1234.56

### 4. Quy ước dấu
- Chi phí, chi tiền: SỐ ÂM
- Doanh thu, thu nhập, thu tiền: SỐ DƯƠNG

### 5. Output
- Chỉ trả về JSON array thuần túy, không có markdown, không có giải thích.
- Nếu không đọc được giá trị số thì để value = null.
"""