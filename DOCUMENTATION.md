# 📊 TÀI LIỆU TỔNG HỢP CHƯƠNG TRÌNH PHÂN TÍCH TÀI CHÍNH

> **Dự án:** Financial Analysis Platform  
> **Mục đích:** Nền tảng phân tích tài chính thông minh cho thị trường chứng khoán Việt Nam  
> **Ngày tạo tài liệu:** 28/01/2026

---

## 📁 CẤU TRÚC DỰ ÁN

```
FinancialApp/
├── backend/                    # Backend API (FastAPI + Python)
│   ├── main.py                # REST API endpoints
│   ├── database.py            # Kết nối và truy vấn Database
│   ├── financial_analysis.py  # Các hàm tính toán tài chính
│   └── config.py              # Cấu hình ứng dụng
│
├── Database/                   # Quản lý cơ sở dữ liệu
│   ├── models.py              # ORM Models (SQLAlchemy)
│   ├── seed_data.py           # Tạo dữ liệu mẫu
│   ├── merge_tool.py          # Gộp database từ nhiều nguồn
│   └── master_db/             # Database chính
│
├── frontend-react/             # Frontend (React + Vite)
│   └── src/
│       ├── App.jsx            # Routing chính
│       ├── pages/             # Các trang giao diện
│       ├── components/        # Components tái sử dụng
│       ├── services/api.js    # API client
│       └── utils/             # Helper functions
│
├── update_stock_prices.py      # Script cập nhật giá realtime
├── run.py                      # Script khởi động server
└── start.bat                   # Script khởi động Windows
```

---

## 🗃️ MÔ HÌNH DỮ LIỆU (Database Models)

### 1. Company - Thông tin doanh nghiệp
| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` | Integer | Khóa chính |
| `ticker` | String(10) | Mã chứng khoán (VD: VNM, FPT) |
| `name` | String(200) | Tên công ty |
| `industry` | String(100) | Ngành nghề |
| `market_cap` | BigInteger | Vốn hóa thị trường |
| `shares_outstanding` | BigInteger | Số cổ phiếu lưu hành |
| `current_price` | Float | Giá hiện tại |
| `price_updated_at` | String(50) | Thời gian cập nhật giá |

### 2. BalanceSheet - Bảng cân đối kế toán
| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` | Integer | Khóa chính |
| `company_id` | Integer | FK → companies |
| `period_type` | String | 'annual' hoặc 'quarterly' |
| `period_year` | Integer | Năm báo cáo |
| `period_quarter` | Integer | Quý (1-4, null nếu annual) |
| `total_assets` | BigInteger | Tổng tài sản |
| `current_assets` | BigInteger | Tài sản ngắn hạn |
| `cash_and_equivalents` | BigInteger | Tiền và tương đương tiền |
| `accounts_receivable` | BigInteger | Phải thu khách hàng |
| `inventories` | BigInteger | Hàng tồn kho |
| `fixed_assets` | BigInteger | Tài sản cố định |
| `total_liabilities` | BigInteger | Tổng nợ phải trả |
| `current_liabilities` | BigInteger | Nợ ngắn hạn |
| `short_term_debt` | BigInteger | Vay ngắn hạn |
| `long_term_debt` | BigInteger | Vay dài hạn |
| `total_equity` | BigInteger | Vốn chủ sở hữu |
| `retained_earnings` | BigInteger | Lợi nhuận chưa phân phối |

### 3. IncomeStatement - Báo cáo kết quả kinh doanh
| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` | Integer | Khóa chính |
| `company_id` | Integer | FK → companies |
| `period_year` | Integer | Năm báo cáo |
| `revenue` | BigInteger | Doanh thu thuần |
| `cost_of_goods_sold` | BigInteger | Giá vốn hàng bán |
| `gross_profit` | BigInteger | Lợi nhuận gộp |
| `selling_expenses` | BigInteger | Chi phí bán hàng |
| `admin_expenses` | BigInteger | Chi phí quản lý |
| `operating_income` | BigInteger | Lợi nhuận từ HĐKD |
| `financial_expenses` | BigInteger | Chi phí tài chính |
| `interest_expenses` | BigInteger | Chi phí lãi vay |
| `profit_before_tax` | BigInteger | Lợi nhuận trước thuế |
| `net_profit` | BigInteger | Lợi nhuận sau thuế |
| `net_profit_to_shareholders` | BigInteger | LNST của cổ đông công ty mẹ |

### 4. CashFlow - Báo cáo lưu chuyển tiền tệ
| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `id` | Integer | Khóa chính |
| `company_id` | Integer | FK → companies |
| `period_year` | Integer | Năm báo cáo |
| `operating_cash_flow` | BigInteger | Dòng tiền từ HĐKD (CFO) |
| `investing_cash_flow` | BigInteger | Dòng tiền từ HĐĐT (CFI) |
| `capex` | BigInteger | Chi đầu tư TSCĐ (CAPEX) |
| `financing_cash_flow` | BigInteger | Dòng tiền từ HĐTC (CFF) |
| `dividends_paid` | BigInteger | Chi trả cổ tức |
| `ending_cash` | BigInteger | Tiền cuối kỳ |

---

## 🔧 BACKEND - CÁC HÀM VÀ API

### A. Database Manager (`backend/database.py`)

#### Lớp `DatabaseManager`
Quản lý kết nối và truy vấn cơ sở dữ liệu.

| Phương thức | Mô tả | Đầu vào | Đầu ra |
|-------------|-------|---------|--------|
| `get_session()` | Context manager cho database session | - | Session |
| `get_all_companies()` | Lấy danh sách tất cả công ty | - | DataFrame |
| `get_company_by_ticker(ticker)` | Lấy thông tin công ty theo mã CK | ticker: str | dict |
| `get_financial_summary(ticker)` | Lấy tổng hợp dữ liệu tài chính 10 năm | ticker: str | DataFrame |
| `get_company_financials_detailed(ticker)` | Lấy dữ liệu tài chính chi tiết | ticker: str | dict |
| `get_balance_sheet_structure(ticker)` | Lấy cơ cấu BCĐKT để vẽ biểu đồ | ticker: str | DataFrame |
| `get_cash_flow_data(ticker)` | Lấy dữ liệu dòng tiền | ticker: str | DataFrame |
| `screen_stocks(filters)` | Bộ lọc cổ phiếu thông minh | filters: dict | DataFrame |
| `get_valuation_inputs(ticker)` | Lấy dữ liệu đầu vào cho định giá | ticker: str | dict |

#### Các chỉ số tài chính được tính tự động:
- **EPS** = Net Profit / Shares Outstanding
- **BVPS** = Total Equity / Shares Outstanding
- **P/E Ratio** = Current Price / EPS
- **P/B Ratio** = Current Price / BVPS
- **ROE** = Net Profit / Total Equity × 100%
- **ROA** = Net Profit / Total Assets × 100%
- **D/E Ratio** = Total Liabilities / Total Equity
- **Current Ratio** = Current Assets / Current Liabilities
- **Quick Ratio** = (Current Assets - Inventories) / Current Liabilities
- **Gross Margin** = Gross Profit / Revenue × 100%
- **Net Margin** = Net Profit / Revenue × 100%
- **ROIC** = NOPAT / Invested Capital × 100%

---

### B. Phân tích tài chính (`backend/financial_analysis.py`)

#### 1. `calculate_financial_ratios(company, balance_sheet, income_statement, prev_income, prev_balance)`
**Mục đích:** Tính toán tất cả các chỉ số tài chính quan trọng.

**Đầu ra (dict):**
```python
{
    # Định giá
    'pe_ratio': float,      # Price-to-Earnings
    'pb_ratio': float,      # Price-to-Book
    'ps_ratio': float,      # Price-to-Sales
    'market_cap': int,
    
    # Sinh lợi
    'roe': float,           # Return on Equity (%)
    'roa': float,           # Return on Assets (%)
    'ros': float,           # Return on Sales (%)
    
    # Biên lợi nhuận
    'gross_margin': float,  # Biên lợi nhuận gộp (%)
    'operating_margin': float,
    'net_margin': float,
    
    # Đòn bẩy tài chính
    'debt_to_equity': float,
    'debt_to_assets': float,
    'current_ratio': float,
    'quick_ratio': float,
    
    # Tăng trưởng
    'revenue_growth': float,  # % tăng trưởng doanh thu
    'profit_growth': float,   # % tăng trưởng lợi nhuận
    'equity_growth': float,
    
    # Per share
    'eps': float,           # Earnings Per Share
    'bvps': float,          # Book Value Per Share
}
```

---

#### 2. `calculate_piotroski_f_score(balance_sheet, prev_balance, income, prev_income, cash_flow, shares_outstanding)`
**Mục đích:** Tính Piotroski F-Score (0-9) - Đánh giá sức khỏe tài chính.

**9 tiêu chí đánh giá:**

| # | Tiêu chí | Nhóm | Điều kiện đạt |
|---|----------|------|---------------|
| 1 | ROA > 0 | Profitability | ROA dương |
| 2 | CFO > 0 | Profitability | Cash flow từ HĐKD dương |
| 3 | ROA tăng | Profitability | ROA năm nay > năm trước |
| 4 | CFO > Net Income | Profitability | Chất lượng lợi nhuận tốt |
| 5 | Long-term debt giảm | Leverage | Nợ dài hạn giảm |
| 6 | Current ratio tăng | Liquidity | Thanh khoản cải thiện |
| 7 | Không phát hành CP | Leverage | Không pha loãng cổ phiếu |
| 8 | Gross margin tăng | Efficiency | Biên lợi nhuận gộp cải thiện |
| 9 | Asset turnover tăng | Efficiency | Hiệu quả sử dụng tài sản |

**Đầu ra:**
```python
{
    'total_score': int,     # 0-9
    'criteria': {           # Chi tiết từng tiêu chí
        'roa_positive': {'passed': bool, 'value': float, 'description': str},
        'cfo_positive': {...},
        'roa_improving': {...},
        ...
    },
    'interpretation': {
        'level': str,       # excellent/good/average/weak/poor
        'label': str,       # Xuất sắc/Tốt/Trung bình/Yếu/Kém
        'color': str,       # green/blue/yellow/orange/red
        'description': str
    }
}
```

---

#### 3. `detect_risk_warnings(income_statements, cash_flows, balance_sheet, ratios)`
**Mục đích:** Phát hiện các cảnh báo rủi ro tài chính.

**Các cảnh báo được kiểm tra:**

| # | Loại cảnh báo | Mức độ | Điều kiện |
|---|---------------|--------|-----------|
| 1 | Lỗ liên tiếp | Critical | Lợi nhuận âm ≥ 2 kỳ |
| 2 | CFO âm | Critical | Cash flow HĐKD âm ≥ 2 kỳ |
| 3 | Đòn bẩy cao | Critical/Warning | D/E > 2 (hoặc > 3) |
| 4 | ROE âm | Critical | ROE < 0 |
| 5 | Thanh khoản thấp | Warning | Current Ratio < 1 |
| 6 | Biên LN thấp | Warning | Gross Margin < 10% |
| 7 | P/E cao | Info | P/E > 25 |
| 8 | Doanh thu giảm | Warning | Revenue growth < -10% |

---

#### 4. `calculate_health_score(f_score, ratios, warnings)`
**Mục đích:** Tính Health Score tổng hợp (0-100 điểm).

**Cấu trúc điểm:**
| Thành phần | Trọng số | Mô tả |
|------------|----------|-------|
| F-Score | 40 điểm | (F-Score / 9) × 40 |
| Định giá | 20 điểm | Dựa trên P/E và P/B |
| Tăng trưởng | 20 điểm | Dựa trên revenue và profit growth |
| Rủi ro | 20 điểm | Trừ điểm theo warnings |

---

### C. REST API Endpoints (`backend/main.py`)

#### 1. API Công ty

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/companies` | Lấy danh sách tất cả công ty |
| GET | `/api/companies/search?q={query}` | Tìm kiếm công ty |
| GET | `/api/companies/{ticker}` | Thông tin chi tiết công ty |
| GET | `/api/companies/{ticker}/financials` | Dữ liệu tài chính chi tiết |
| GET | `/api/companies/{ticker}/balance-sheets` | Danh sách BCĐKT |
| GET | `/api/companies/{ticker}/income-statements` | Danh sách BCKQKD |
| GET | `/api/companies/{ticker}/cash-flows` | Danh sách BCLCTT |

#### 2. API Dữ liệu tài chính

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/financial-summary/{ticker}` | Tổng hợp tài chính 10 năm |
| GET | `/api/balance-sheet-structure/{ticker}` | Cơ cấu tài sản/nguồn vốn |
| GET | `/api/cash-flow/{ticker}` | Dữ liệu dòng tiền |

#### 3. API Phân tích

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/analysis/{ticker}/ratios` | Tất cả chỉ số tài chính |
| GET | `/api/analysis/{ticker}/f-score` | Piotroski F-Score |
| GET | `/api/analysis/{ticker}/health-score` | Health Score tổng hợp |
| GET | `/api/analysis/{ticker}/warnings` | Cảnh báo rủi ro |

#### 4. API Sàng lọc cổ phiếu (Screener)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET/POST | `/api/screener` | Sàng lọc cơ bản |
| GET | `/api/screener/advanced` | Sàng lọc nâng cao |
| GET | `/api/screening/presets` | Các bộ lọc có sẵn |

**Tham số lọc:**
```
- min_roe, max_roe: ROE (%)
- min_pe, max_pe: P/E ratio
- min_pb, max_pb: P/B ratio
- max_de: D/E ratio tối đa
- min_profit_growth: % tăng trưởng LN tối thiểu
- min_revenue_growth: % tăng trưởng DT tối thiểu
- min_f_score: F-Score tối thiểu
- industry: Lọc theo ngành
- consecutive_roe_years: ROE đạt ngưỡng trong n năm liên tiếp
```

#### 5. API Định giá

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/valuation/{ticker}` | Dữ liệu đầu vào định giá |
| POST | `/api/valuation/graham` | Định giá Graham Formula |
| POST | `/api/valuation/dcf` | Định giá DCF |
| GET | `/api/valuation/{ticker}/comparables` | Công ty cùng ngành |

**Graham Formula:**
```
V = EPS × (8.5 + 2g)
Trong đó: g = tỷ lệ tăng trưởng (%)
```

**DCF Model:**
- Dự phóng EPS n năm
- Chiết khấu dòng tiền tương lai
- Tính Terminal Value

#### 6. API Thị trường

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/market/overview` | Tổng quan thị trường |
| GET | `/api/market/status` | Trạng thái thị trường (mở/đóng) |
| GET | `/api/market/sectors` | Phân bổ theo ngành |
| GET | `/api/market/top-gainers` | Top cổ phiếu tăng |
| GET | `/api/market/top-losers` | Top cổ phiếu giảm |
| GET | `/api/industries` | Danh sách ngành nghề |

#### 7. API So sánh & Xuất dữ liệu

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/compare` | So sánh 2-5 công ty |
| GET | `/api/compare?tickers=VNM,FPT,HPG` | So sánh (GET method) |
| GET | `/api/export/{ticker}?format=json` | Xuất JSON |
| GET | `/api/export/{ticker}?format=csv` | Xuất CSV |

#### 8. API Thông báo

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/notifications` | Lấy danh sách thông báo |
| PUT | `/api/notifications/{id}/read` | Đánh dấu đã đọc |
| DELETE | `/api/notifications/{id}` | Xóa thông báo |

#### 9. API Cập nhật giá

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/prices/refresh` | Cập nhật giá thủ công |
| GET | `/api/prices/status` | Trạng thái cập nhật giá |

---

## 🖥️ FRONTEND - CÁC TRANG VÀ COMPONENTS

### A. Các trang chính (`frontend-react/src/pages/`)

| File | Route | Chức năng |
|------|-------|-----------|
| `Dashboard.jsx` | `/` | Tổng quan thị trường, top cổ phiếu, phân bổ ngành |
| `ScreenerNew.jsx` | `/screener` | Sàng lọc cổ phiếu với 6 chiến lược preset |
| `CompanyAnalysisSimple.jsx` | `/company/:ticker` | Phân tích chi tiết công ty |
| `CompanyReports.jsx` | `/company/:ticker/reports` | Báo cáo tài chính chi tiết |
| `Comparison.jsx` | `/compare` | So sánh nhiều công ty |
| `FinancialReports.jsx` | `/reports` | Danh sách báo cáo tài chính |
| `Valuation.jsx` | `/valuation` | Công cụ định giá |
| `NotFound.jsx` | `*` | Trang 404 |

### B. API Client (`frontend-react/src/services/api.js`)

```javascript
// Companies API
companiesApi.getAll()
companiesApi.getByTicker(ticker)
companiesApi.getFinancials(ticker)
companiesApi.search(query)

// Financial Data API
financialApi.getSummary(ticker)
financialApi.getBalanceSheet(ticker)
financialApi.getIncomeStatement(ticker)
financialApi.getCashFlow(ticker)

// Screening API
screeningApi.screen(filters)
screeningApi.advanced(filters)
screeningApi.getPresets()

// Analysis API
analysisApi.getRatios(ticker)
analysisApi.getFScore(ticker)
analysisApi.getHealthScore(ticker)
analysisApi.getWarnings(ticker)

// Market API
marketApi.getOverview()
marketApi.getStatus()
marketApi.getSectorPerformance()
marketApi.getTopGainers()
marketApi.getTopLosers()

// Comparison API
comparisonApi.compare(tickers)

// Valuation API
valuationApi.graham(ticker, params)
valuationApi.dcf(ticker, params)

// Export API
exportApi.exportData(ticker, format)
exportApi.exportCSV(ticker)
```

---

## 🛠️ CÔNG CỤ HỖ TRỢ

### 1. Script cập nhật giá (`update_stock_prices.py`)

**Chức năng:** Cập nhật giá cổ phiếu realtime từ nhiều nguồn API.

**Các nguồn dữ liệu:**
1. **SSI API** (Primary): `https://iboard.ssi.com.vn/dchart/api/1.1/defaultAllStocks`
2. **TCBS API** (Backup): `https://apipubaws.tcbs.com.vn/stock-insight/v1/stock/second-tc-price`
3. **VPS API** (Backup 2): `https://bgapidatafeed.vps.com.vn/getliststockdata`

**Các hàm chính:**
| Hàm | Mô tả |
|-----|-------|
| `get_prices_from_ssi()` | Lấy giá từ SSI API |
| `get_prices_from_tcbs(tickers)` | Lấy giá từ TCBS API |
| `get_prices_from_vps(tickers)` | Lấy giá từ VPS API |
| `update_database(prices)` | Cập nhật giá vào database |

**Tự động cập nhật:** Chạy ngầm mỗi 2 phút khi server hoạt động.

---

### 2. Công cụ gộp Database (`Database/merge_tool.py`)

**Chức năng:** Gộp nhiều database từ các nguồn khác nhau (Kaggle, etc.) vào master.db.

**Quy trình:**
1. Đọc các file `.db` từ thư mục `new_db_from_kaggle/`
2. So sánh schema với master.db
3. Đồng bộ dữ liệu Company (insert/update)
4. Đồng bộ các báo cáo tài chính (balance_sheets, income_statements, cash_flows)

**Cách sử dụng:**
```bash
cd Database
python merge_tool.py
```

---

### 3. Script tạo dữ liệu mẫu (`Database/seed_data.py`)

**Chức năng:** Tạo dữ liệu mẫu cho 15 công ty với 10 năm báo cáo tài chính.

**Danh sách công ty mẫu:**
VNM, FPT, VCB, HPG, MWG, VHM, TCB, MSN, VIC, ACB, VRE, PNJ, REE, DHG, DGC

**Hàm chính:**
| Hàm | Mô tả |
|-----|-------|
| `generate_financial_data(company_id, ticker, industry)` | Sinh dữ liệu tài chính 10 năm |
| `seed_database()` | Khởi tạo và đổ dữ liệu vào database |

---

## 📊 CÁC CHỈ SỐ TÀI CHÍNH ĐƯỢC TÍNH TOÁN

### 1. Chỉ số định giá (Valuation Ratios)
| Chỉ số | Công thức | Ý nghĩa |
|--------|-----------|---------|
| P/E | Price / EPS | Giá trên thu nhập |
| P/B | Price / BVPS | Giá trên giá trị sổ sách |
| P/S | Price / Revenue per Share | Giá trên doanh thu |
| EV/EBITDA | Enterprise Value / EBITDA | Định giá doanh nghiệp |

### 2. Chỉ số sinh lời (Profitability Ratios)
| Chỉ số | Công thức | Ý nghĩa |
|--------|-----------|---------|
| ROE | Net Profit / Equity × 100% | Hiệu suất vốn chủ sở hữu |
| ROA | Net Profit / Assets × 100% | Hiệu suất tổng tài sản |
| ROIC | NOPAT / Invested Capital × 100% | Hiệu suất vốn đầu tư |
| Gross Margin | Gross Profit / Revenue × 100% | Biên lợi nhuận gộp |
| Net Margin | Net Profit / Revenue × 100% | Biên lợi nhuận ròng |
| Operating Margin | Operating Income / Revenue × 100% | Biên lợi nhuận hoạt động |

### 3. Chỉ số đòn bẩy (Leverage Ratios)
| Chỉ số | Công thức | Ý nghĩa |
|--------|-----------|---------|
| D/E | Total Liabilities / Equity | Tỷ lệ nợ trên vốn chủ |
| Debt/Assets | Total Liabilities / Assets | Tỷ lệ nợ trên tài sản |
| Interest Coverage | EBIT / Interest Expense | Khả năng trả lãi vay |

### 4. Chỉ số thanh khoản (Liquidity Ratios)
| Chỉ số | Công thức | Ý nghĩa |
|--------|-----------|---------|
| Current Ratio | Current Assets / Current Liabilities | Khả năng thanh toán ngắn hạn |
| Quick Ratio | (CA - Inventory) / CL | Khả năng thanh toán nhanh |
| Cash Ratio | Cash / Current Liabilities | Khả năng thanh toán tức thời |

### 5. Chỉ số tăng trưởng (Growth Ratios)
| Chỉ số | Công thức | Ý nghĩa |
|--------|-----------|---------|
| Revenue Growth | (Revenue_t - Revenue_t-1) / Revenue_t-1 × 100% | Tăng trưởng doanh thu |
| Profit Growth | (Profit_t - Profit_t-1) / Profit_t-1 × 100% | Tăng trưởng lợi nhuận |
| Equity Growth | (Equity_t - Equity_t-1) / Equity_t-1 × 100% | Tăng trưởng vốn chủ |
| EPS Growth | (EPS_t - EPS_t-1) / EPS_t-1 × 100% | Tăng trưởng EPS |

---

## 🚀 HƯỚNG DẪN CÀI ĐẶT VÀ CHẠY

### Yêu cầu hệ thống
- Python 3.9+
- Node.js 18+
- SQLite

### Cài đặt

```bash
# 1. Clone project
git clone <repo-url>
cd FinancialApp

# 2. Cài đặt Backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt

# 3. Cài đặt Frontend
cd frontend-react
npm install

# 4. Tạo database mẫu (nếu chưa có)
cd ../Database
python seed_data.py
```

### Chạy ứng dụng

```bash
# Cách 1: Script tự động (Windows)
start.bat

# Cách 2: Chạy thủ công
# Terminal 1 - Backend
python run.py

# Terminal 2 - Frontend
cd frontend-react
npm run dev
```

### Truy cập
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs

---

## 📝 GHI CHÚ KỸ THUẬT

### Công nghệ sử dụng

**Backend:**
- FastAPI - Web framework
- SQLAlchemy - ORM
- Pandas - Xử lý dữ liệu
- NumPy - Tính toán số học
- Uvicorn - ASGI server

**Frontend:**
- React 18
- Vite - Build tool
- TailwindCSS - Styling
- React Query - Data fetching
- Recharts - Biểu đồ
- Framer Motion - Animation
- React Router - Routing

**Database:**
- SQLite

---

*Tài liệu được tạo tự động bởi hệ thống. Cập nhật lần cuối: 28/01/2026*
