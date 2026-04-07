def parse(self, bundle: ExtractionBundle) -> ParsedReport:
    if not bundle.has_content():
        logger.warning("No content to parse")
        return ParsedReport(warnings=["No financial tables found in extraction"])

    system_prompt = self._get_system_prompt()
    result = ParsedReport()

    # Apply metadata trước
    if bundle.metadata:
        result.company_name = bundle.metadata.get("company_name")
        result.stock_ticker = bundle.metadata.get("stock_ticker")
        result.year         = bundle.metadata.get("year")
        result.quarter      = bundle.metadata.get("quarter")
        result.unit         = bundle.metadata.get("unit", "VND")
        result.is_ytd       = bundle.metadata.get("is_ytd", False)

    # Parse từng báo cáo riêng lẻ -> tránh JSON quá dài bị cắt
    sections = []
    if bundle.balance_sheet:
        sections.append(("balance_sheet", "## BẢNG CÂN ĐỐI KẾ TOÁN\n" + bundle.balance_sheet))
    if bundle.income_statement:
        sections.append(("income_statement", "## BÁO CÁO KẾT QUẢ HOẠT ĐỘNG KINH DOANH\n" + bundle.income_statement))
    if bundle.cash_flow:
        sections.append(("cash_flow", "## BÁO CÁO LƯU CHUYỂN TIỀN TỆ\n" + bundle.cash_flow))

    import json, re as _re
    raw_llm = create_llm_for_task("parsing", model=self.model)

    for section_name, content in sections:
        try:
            messages = [
                (
                    "system",
                    system_prompt + "\n\nChỉ trả về JSON array của các FinancialItem. "
                    "Không markdown, không giải thích.\n"
                    'Format: [{"item_code": "...", "item_name": "...", "value": 0, "notes_ref": null, "original_name": null}]',
                ),
                (
                    "human",
                    f"Trích xuất tất cả chỉ tiêu từ báo cáo sau:\n\n{content}\n\n"
                    f"Đơn vị: {result.unit}\nChỉ trả về JSON array.",
                ),
            ]
            resp = raw_llm.invoke(messages)
            content_str = (getattr(resp, "content", None) or "").strip()

            # Lấy JSON array từ response
            m = _re.search(r"\[.*\]", content_str, flags=_re.DOTALL)
            if not m:
                logger.warning(f"{section_name}: Không tìm thấy JSON array")
                result.warnings.append(f"{section_name}: no JSON array found")
                continue

            items_data = json.loads(m.group(0))
            items = [FinancialItem(**item) for item in items_data]

            if section_name == "balance_sheet":
                result.balance_sheet.items = items
            elif section_name == "income_statement":
                result.income_statement.items = items
            elif section_name == "cash_flow":
                result.cash_flow.items = items

            logger.info(f"{section_name}: {len(items)} items parsed")

        except Exception as e:
            logger.error(f"{section_name} parse failed: {e}")
            result.warnings.append(f"{section_name}: {str(e)}")

    result.bs_found = len(result.balance_sheet.items) > 0
    result.pl_found = len(result.income_statement.items) > 0
    result.cf_found = len(result.cash_flow.items) > 0

    return result