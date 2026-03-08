import os
import requests
import time
from bs4 import BeautifulSoup
from datetime import datetime
import re

# ==============================================================================
# KHU VỰC TÙY CHỈNH NÂNG CAO
# ==============================================================================
STOCK_CODES_TO_DOWNLOAD = ["VHM", "VIC", "TCB"]
START_YEAR = 2020  # Chỉ tải báo cáo từ năm 2020 trở đi

# Mỗi bộ lọc là một danh sách các từ khóa PHẢI CÙNG XUẤT HIỆN
# Ví dụ: ["bctc", "cong ty me"] nghĩa là tiêu đề phải chứa cả "bctc" VÀ "cong ty me"
KEYWORD_SETS = [
    ["bctc", "công ty mẹ"],
    ["bctc", "hợp nhất", "quý"],
    ["Báo cáo tài chính"] # Lọc báo cáo thường niên
]
# ==============================================================================

def sanitize_filename(filename):
    return "".join([c for c in filename if c.isalpha() or c.isdigit() or c in (' ', '_', '-')]).rstrip()

def extract_year_from_title(title):
    """Trích xuất năm từ tiêu đề báo cáo"""
    # Tìm các pattern năm: "năm 2020", "2020", "Năm 2021"
    patterns = [
        r'năm\s+(\d{4})',  # "năm 2020"
        r'(\d{4})',         # "2020"
    ]
    for pattern in patterns:
        match = re.search(pattern, title.lower())
        if match:
            year = int(match.group(1))
            if 2000 <= year <= datetime.now().year:  # Kiểm tra năm hợp lệ
                return year
    return None

def download_reports_final_api(download_dir, stock_code, keyword_sets):
    target_dir = os.path.join(download_dir, stock_code)
    os.makedirs(target_dir, exist_ok=True)
    print(f"--- Bắt đầu xử lý mã {stock_code} qua API ---")

    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
    })

    try:
        main_page_url = f"https://finance.vietstock.vn/{stock_code}/tai-tai-lieu.htm"
        print(f"Đang truy cập trang chính để lấy token...")
        main_page_response = session.get(main_page_url, timeout=30)
        main_page_response.raise_for_status()

        soup = BeautifulSoup(main_page_response.text, 'lxml')
        token = soup.find('input', {'name': '__RequestVerificationToken'}).get('value')
        print("✔️ Lấy token thành công!")

        api_url = "https://finance.vietstock.vn/data/getdocument"
        page = 1
        total_downloaded = 0
        while True:
            payload = {"code": stock_code, "page": page, "type": 1, "__RequestVerificationToken": token}
            print(f"\nĐang yêu cầu dữ liệu trang {page}...")
            api_response = session.post(api_url, data=payload, timeout=30)
            api_response.raise_for_status()
            
            reports = api_response.json()
            if not reports:
                print("Không còn báo cáo nào. Kết thúc.")
                break

            for report in reports:
                report_title = report.get('Title', '').strip()
                pdf_url = report.get('Url', '').strip()
                if not report_title or not pdf_url: continue
                
                # --- KIỂM TRA NĂM ---
                report_year = extract_year_from_title(report_title)
                if report_year and report_year < START_YEAR:
                    print(f"⏭️ Bỏ qua (năm {report_year} < {START_YEAR}): '{report_title}'")
                    continue
                
                # --- LOGIC LỌC NÂNG CAO ---
                normalized_title = report_title.lower()
                matched_set = None
                for keyword_set in keyword_sets:
                    # all() sẽ kiểm tra xem TẤT CẢ các từ khóa trong bộ có nằm trong tiêu đề không
                    if all(keyword.lower() in normalized_title for keyword in keyword_set):
                        matched_set = keyword_set
                        break 
                
                if not matched_set:
                    continue # Bỏ qua nếu không khớp với bộ lọc nào

                year_info = f" (năm {report_year})" if report_year else ""
                print(f"✔️ Khớp bộ lọc {matched_set}{year_info}: '{report_title}'")
                safe_filename = sanitize_filename(report_title) + ".pdf"
                dest_path = os.path.join(target_dir, safe_filename)

                if os.path.exists(dest_path):
                    print("  -> Đã tồn tại, bỏ qua.")
                    continue
                
                print("  -> Đang tải...")
                try:
                    file_res = session.get(pdf_url, stream=True, timeout=60)
                    file_res.raise_for_status()
                    with open(dest_path, 'wb') as f:
                        for chunk in file_res.iter_content(chunk_size=8192): f.write(chunk)
                    print(f"  -> Đã lưu thành công: {safe_filename}")
                    total_downloaded += 1
                except requests.exceptions.RequestException as e:
                    print(f"  -> Lỗi khi tải file PDF: {e}")
            
            page += 1
            time.sleep(1)

    except Exception as e:
        print(f"Lỗi nghiêm trọng khi xử lý mã {stock_code}: {e}")
    print(f"\nTổng cộng đã tải về {total_downloaded} báo cáo mới cho mã {stock_code}.")

if __name__ == "__main__":
    DOWNLOAD_DIRECTORY = "./downloads_vietstock_final"
    os.makedirs(DOWNLOAD_DIRECTORY, exist_ok=True)
    for code in STOCK_CODES_TO_DOWNLOAD:
        download_reports_final_api(DOWNLOAD_DIRECTORY, code, KEYWORD_SETS)
        print(f"==================== Hoàn thành mã {code} ====================")
        time.sleep(3)