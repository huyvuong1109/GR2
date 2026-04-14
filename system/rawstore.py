# -*- coding: utf-8 -*-
"""
raw_store.py - Luu/doc raw OCR items vao master_raw.json

Format:
{
  "VCB": [
    {
      "ticker": "VCB",
      "quarter": 1, "year": 2023,
      "company_type": "bank",
      "company_name": "Vietcombank",
      "unit": "trieu VND",
      "is_ytd": false,
      "pdf_filename": "...",
      "ocr_chars": 12345,
      "items": {
        "CDKT": [{"item_code": "...", "item_name": "...", "value": 0, "notes_ref": null}],
        "KQKD": [...],
        "LCTT": [...]
      }
    }
  ],
  "ACB": [...]
}
"""

import json
import os
import threading
from typing import Optional

_LOCK = threading.Lock()


def load(path: str) -> dict:
    """Doc master_raw.json, tra ve {} neu chua co."""
    if not os.path.exists(path):
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save(path: str, data: dict):
    """Ghi atomic vao master_raw.json."""
    tmp = path + ".tmp"
    with _LOCK:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, path)


def upsert_period(
    path: str,
    ticker: str,
    quarter: int,
    year: int,
    company_type: str,
    company_name: str,
    unit: str,
    is_ytd: bool,
    pdf_filename: str,
    ocr_chars: int,
    report,  # ParsedReport
) -> int:
    """
    Them/cap nhat 1 ky bao cao vao master_raw.json.
    Tra ve so items da luu.
    """
    data = load(path)

    if ticker not in data:
        data[ticker] = []

    # Xoa period cu neu co
    data[ticker] = [
        p for p in data[ticker]
        if not (p["quarter"] == quarter and p["year"] == year)
    ]

    # Build items theo statement
    items = {"CDKT": [], "KQKD": [], "LCTT": []}
    stmt_map = {
        "CDKT": report.balance_sheet.items,
        "KQKD": report.income_statement.items,
        "LCTT": report.cash_flow.items,
    }
    total = 0
    for stmt_name, stmt_items in stmt_map.items():
        for order, item in enumerate(stmt_items):
            if item.value is None:
                continue
            items[stmt_name].append({
                "item_order": order,
                "item_code":  getattr(item, "item_code",  None),
                "item_name":  item.item_name,
                "notes_ref":  getattr(item, "notes_ref",  None),
                "value":      int(item.value),
            })
            total += 1

    period = {
        "ticker":       ticker,
        "quarter":      quarter,
        "year":         year,
        "company_type": company_type,
        "company_name": company_name,
        "unit":         unit,
        "is_ytd":       is_ytd,
        "pdf_filename": pdf_filename,
        "ocr_chars":    ocr_chars,
        "items":        items,
    }

    data[ticker].append(period)

    # Sort theo nam/quy
    data[ticker].sort(key=lambda p: (p["year"], p["quarter"]))

    save(path, data)
    return total


def iter_periods(path: str):
    """Iterate qua tung period trong master_raw.json."""
    data = load(path)
    for ticker, periods in data.items():
        for period in periods:
            yield period