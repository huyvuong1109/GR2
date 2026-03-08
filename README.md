# 📊 Financial Analysis Platform

> Nền tảng phân tích tài chính thông minh cho thị trường chứng khoán Việt Nam

---

## 🎯 Tính năng chính

### 📈 Dashboard (Tổng quan thị trường)
- Tổng quan vốn hóa thị trường và khối lượng giao dịch
- Top cổ phiếu theo vốn hóa với biểu đồ tương tác
- Phân bổ theo ngành với Pie Chart
- **Danh sách công ty** - Click để xem báo cáo tài chính chi tiết

### 🔍 Stock Screener (Sàng lọc cổ phiếu)
- **6 chiến lược preset**: Value, Growth, Dividend, Quality, Turnaround, GARP
- **Bộ lọc tùy chỉnh**: P/E, P/B, ROE, ROA, D/E, Dividend Yield
- **Piotroski F-Score** (0-9): Đánh giá sức khỏe tài chính
- Xuất kết quả ra Excel/CSV
- Chọn nhiều cổ phiếu để so sánh

### 🏢 Company Analysis (Phân tích công ty)
- **Health Score** (0-100): Tổng hợp 8 chỉ số tài chính
- **F-Score** (0-9): Đánh giá theo phương pháp Piotroski
- Biểu đồ doanh thu, lợi nhuận 5 năm
- 4 tab chi tiết: Overview, Health, Financials, Ratios
- Cảnh báo rủi ro tự động (ROE thấp, nợ cao, lỗ ròng)

### 📋 Financial Reports (Báo cáo tài chính)
- **Cân đối kế toán**: Tài sản, Nợ phải trả, Vốn chủ sở hữu
- **Kết quả hoạt động kinh doanh**: Doanh thu, Chi phí, Lợi nhuận
- **Lưu chuyển tiền tệ**: Operating, Investing, Financing cash flows
- So sánh theo năm trong modal chi tiết
- Xuất báo cáo Excel

### ⚖️ Comparison Tool (So sánh cổ phiếu)
- So sánh 2-5 công ty cùng lúc
- **Radar Chart**: So sánh đa chiều (ROE, ROA, P/E, P/B, D/E, Current Ratio)
- **Bar Chart**: So sánh doanh thu, lợi nhuận, tổng tài sản
- Bảng tổng hợp với highlight công ty tốt nhất
- Tìm kiếm công ty nhanh

### 💰 Valuation (Định giá)
- **Graham Formula**: Tính giá trị nội tại
- **DCF Model**: Định giá dòng tiền chiết khấu

---

## ⚡ Cài đặt nhanh (5 phút)

### Yêu cầu hệ thống
- **Python**: 3.9+
- **Node.js**: 18+
- **npm** hoặc **pnpm**

### Bước 1: Cài đặt Backend

```bash
# Tạo virtual environment
python -m venv venv

# Kích hoạt venv (Windows)
venv\Scripts\activate

# Kích hoạt venv (macOS/Linux)
source venv/bin/activate

# Cài đặt dependencies
pip install -r requirements.txt

# Tạo database mẫu (nếu chưa có)
python Database/seed_data.py
```

### Bước 2: Cài đặt Frontend

```bash
cd frontend-react
npm install
# hoặc: pnpm install
```

### Bước 3: Chạy ứng dụng

**Cách 1: Script tự động (Windows)**
```bash
# Từ thư mục gốc
start.bat
```

**Cách 2: Chạy thủ công**

Terminal 1 - Backend:
```bash
python run.py
# hoặc: python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Terminal 2 - Frontend:
```bash
cd frontend-react
npm run dev
```

### Bước 4: Truy cập ứng dụng

- **Frontend**: http://localhost:5173 (hoặc port Vite hiển thị)
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs (Swagger UI)

---

## 📂 Cấu trúc dự án

```
FinancialApp/
├── backend/                    # FastAPI Backend
│   ├── main.py                # API endpoints chính
│   ├── database.py            # Database connection & queries
│   ├── financial_analysis.py  # F-Score, Health Score logic
│   └── config.py              # Configuration settings
│
├── frontend-react/             # React Frontend
│   ├── src/
│   │   ├── pages/             # Trang chính
│   │   │   ├── Dashboard.jsx           # Tổng quan
│   │   │   ├── ScreenerNew.jsx         # Sàng lọc CP
│   │   │   ├── CompanyAnalysisNew.jsx  # Phân tích công ty
│   │   │   ├── Comparison.jsx          # So sánh
│   │   │   ├── FinancialReports.jsx    # Danh sách BC
│   │   │   ├── CompanyReports.jsx      # BC từng công ty
│   │   │   └── Valuation.jsx           # Định giá
│   │   ├── components/        # UI components
│   │   │   ├── Layout.jsx
│   │   │   ├── charts/        # Recharts components
│   │   │   └── ui/            # Reusable UI (Card, Button, Badge...)
│   │   ├── services/
│   │   │   └── api.js         # API service layer
│   │   └── utils/
│   │       ├── formatters.js  # Format số, tiền tệ
│   │       └── helpers.js     # Helper functions
│   └── package.json
│
├── Database/
│   ├── models.py              # SQLAlchemy models
│   ├── seed_data.py           # Script tạo dữ liệu mẫu
│   └── master_db/
│       └── master.db          # SQLite database
│
├── update_stock_prices.py     # Script cập nhật giá
├── requirements.txt           # Python dependencies
├── run.py                     # Script chạy backend nhanh
└── README.md
```

---

## 🔌 API Endpoints

### Companies (Công ty)
```
GET  /api/companies              # Danh sách tất cả công ty
GET  /api/companies/{ticker}     # Chi tiết công ty
GET  /api/companies/search       # Tìm kiếm công ty
```

### Financial Data (Dữ liệu tài chính)
```
GET  /api/financial-summary/{ticker}           # Tổng hợp tài chính 10 năm
GET  /api/balance-sheet-structure/{ticker}     # Cơ cấu tài sản & nguồn vốn
GET  /api/cash-flow/{ticker}                   # Dòng tiền
GET  /api/companies/{ticker}/balance-sheets    # BCĐKT chi tiết
GET  /api/companies/{ticker}/income-statements # BCKQKD chi tiết
GET  /api/companies/{ticker}/cash-flows        # BCLCTT chi tiết
```

### Screening & Analysis
```
POST /api/screener/advanced                    # Sàng lọc nâng cao
GET  /api/screening/presets                    # Các preset có sẵn
GET  /api/analysis/{ticker}/health-score       # Health Score + F-Score
POST /api/compare                              # So sánh cổ phiếu
```

### Valuation (Định giá)
```
POST /api/valuation/graham                     # Graham Formula
POST /api/valuation/dcf                        # DCF Model
GET  /api/valuation/{ticker}/comparables       # So sánh tương đối
```

### Market (Thị trường)
```
GET  /api/market/overview                      # Tổng quan thị trường
GET  /api/market/sectors                       # Phân tích ngành
GET  /api/market/top-gainers                   # Top tăng giá
GET  /api/market/top-losers                    # Top giảm giá
```

### Export
```
GET  /api/export/{ticker}?format=csv           # Xuất dữ liệu CSV
```

---

## 📊 Database Schema

Database sử dụng **SQLite** với các bảng chính:

- `companies`: Thông tin công ty
- `balance_sheets`: Bảng cân đối kế toán
- `income_statements`: Báo cáo kết quả kinh doanh
- `cash_flows`: Báo cáo lưu chuyển tiền tệ
- `financial_ratios`: Các chỉ số tài chính

**Sample data** (15+ công ty, 11 năm dữ liệu 2015-2025):
```bash
python Database/seed_data.py
```

---

## 🔧 Cấu hình

### Backend (`.env` - tùy chọn)
```env
DATABASE_URL=sqlite:///./Database/master_db/master.db
API_HOST=0.0.0.0
API_PORT=8000
```

### Frontend (`frontend-react/.env`)
```env
VITE_API_URL=http://localhost:8000
```

---

## 🔄 Cập nhật giá cổ phiếu

```bash
python update_stock_prices.py
```

Script này sẽ cập nhật giá mới nhất từ nguồn dữ liệu (cần cấu hình API key nếu dùng dịch vụ trả phí).

---

## 🐛 Khắc phục sự cố

### Port đã được sử dụng

**Windows:**
```bash
# Kill process trên port 8000 (Backend)
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Kill process trên port 5173 (Frontend)
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

**macOS/Linux:**
```bash
# Kill process trên port 8000
lsof -ti:8000 | xargs kill -9

# Kill process trên port 5173
lsof -ti:5173 | xargs kill -9
```

### Module không tìm thấy

```bash
# Backend
pip install -r requirements.txt

# Frontend
cd frontend-react
npm install
```

### Database không có dữ liệu

```bash
python Database/seed_data.py
```

### CORS Error

Kiểm tra `backend/main.py` đã enable CORS:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Hoặc ["http://localhost:5173"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 🚀 Deployment

### Frontend (Vercel/Netlify)

```bash
cd frontend-react
npm run build

# Upload thư mục dist/ lên Vercel/Netlify
# Hoặc dùng Vercel CLI:
vercel --prod
```

**Environment Variables:**
```
VITE_API_URL=https://your-backend-api.com
```

### Backend (Railway/Render/Fly.io)

```bash
# Dockerfile hoặc deploy trực tiếp với command:
python -m uvicorn backend.main:app --host 0.0.0.0 --port $PORT
```

**Railway example:**
```
Build Command: pip install -r requirements.txt
Start Command: python -m uvicorn backend.main:app --host 0.0.0.0 --port $PORT
```

---

## 💡 Tips & Best Practices

1. **Sử dụng Preset Filters** trong Screener để tìm cổ phiếu nhanh theo chiến lược
2. **Health Score > 70** = công ty có sức khỏe tài chính tốt
3. **F-Score ≥ 7** = công ty có nền tảng vững chắc theo Piotroski
4. **Click vào mã cổ phiếu** ở bất kỳ đâu để xem phân tích chi tiết
5. **So sánh tối đa 5 công ty** để có cái nhìn tổng quan
6. **Xuất Excel/CSV** để lưu kết quả phân tích
7. **API Docs** tại `/docs` để test API nhanh với Swagger UI

---

## 🛠️ Tech Stack

### Backend
- **Framework**: FastAPI
- **ORM**: SQLAlchemy
- **Database**: SQLite (có thể chuyển sang PostgreSQL)
- **Validation**: Pydantic
- **Server**: Uvicorn (ASGI)

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: TailwindCSS
- **Charts**: Recharts
- **Animation**: Framer Motion
- **Routing**: React Router v6
- **State**: React Query (TanStack Query)
- **HTTP**: Axios

---

## 📖 Tài liệu bổ sung

- **Database Schema**: [Database/models.py](Database/models.py)
- **Sample Queries**: [backend/sample_queries.py](backend/sample_queries.py)
- **API Documentation**: http://localhost:8000/docs (khi chạy backend)

---

## 📝 Changelog

### v2.0 (Latest)
- ✅ Thêm trang Financial Reports với 3 loại báo cáo chi tiết
- ✅ Thêm trang Company Reports cho từng công ty
- ✅ Dashboard cải tiến với danh sách công ty thay cập nhật thị trường
- ✅ Health Score + F-Score integration
- ✅ Comparison tool với Radar & Bar charts
- ✅ Export CSV/Excel

### v1.0
- ✅ Stock Screener với 6 preset strategies
- ✅ Company Analysis cơ bản
- ✅ Valuation tools (Graham, DCF)

---

## 🤝 Contributing

Contributions are welcome! Vui lòng tạo Pull Request hoặc Issues.

---

## 📄 License

MIT License

---

**Happy Investing! 📈💰**

_Được xây dựng với ❤️ cho cộng đồng nhà đầu tư Việt Nam_
