import os
import requests
import time
from bs4 import BeautifulSoup
from datetime import datetime
import re
import unicodedata

# ======================================================================
# DANH SÁCH ~200 MÃ PHỔ BIẾN (HOSE + HNX + UPCOM chọn lọc)
# ======================================================================
STOCK_CODES_TO_DOWNLOAD = [
    "VCB","BID","CTG","TCB","VPB","MBB","ACB","HDB","STB","TPB",
    "VIC","VHM","VRE","NVL","PDR","KDH","DXG","DIG","CEO","SCR",
    "HPG","HSG","NKG","GAS","PLX","POW","REE","PC1","PVS","PVD",
    "FPT","CMG","ELC","SAM","DGW","MWG","PNJ","FRT","VGI","CTR",
    "VNM","MSN","SAB","KDC","QNS","BAF","DBC","HAG","HNG","PAN",
    "VJC","HVN","VTP","GMD","HAH","VSC","SCS","TMS","ACV","AST",
    "SSI","VND","HCM","VCI","MBS","SHS","FTS","BVS","VDS","CTS",
    "DGC","DCM","DPM","CSV","LAS","BFC","PHR","TRC","DPR","GVR",
    "NT2","PPC","HND","QTP","GEG","REE","POW","NTC","SZC","IDC",
    "BMP","NTP","AAA","APH","TNG","STK","GIL","MSH","VGT","ADS",
    "HBC","CTD","CII","FCN","LCG","HHV","KSB","HT1","BCC","BTS",
    "VHC","ANV","IDI","CMX","FMC","ACL","ABT","AGF","TS4","SEA",
    "BVH","BMI","PVI","BIC","VNR","MIG","PTI","ABI","AIC","PGI",
    "DHG","DMC","IMP","TRA","OPC","PMC","DBD","DP3","TW3","DVN",
    "SBT","LSS","KTS","QNS","MIA","HSL","NAF","AFX","VOC","VSF",
    "VIB","EIB","OCB","MSB","LPB","NAB","BAB","BVB","SSB","KLB",
    "VIX","APS","ORS","AGR","TVS","TVB","APG","AAS","EVS","IVS",
    "KBC","ITA","SZL","TIP","IDC","BCM","KHG","NLG","IJC","HDG",
    "FOX","VGI","CTR","TTN","SGT","CMG","ELC","ONE","ICT","SMT",
    "HUT","C4G","HHV","LCG","DHA","VLB","KSB","BMC","YBM","HGM",
    "PVT","VIP","VOS","VNA","MVN","SGN","ACV","NCT","TCL","SCS",
    "VSH","CHP","TBC","SJD","TMP","DRL","SBH","HJS","TTE","VPD",
    "AAA","APH","NHH","DPR","DRC","CSM","SRC","PAC","SVC","TMT"
]

START_YEAR = 2023

KEYWORD_SETS = [
    ["bctc", "hop nhat", "quy"],
    ["bao cao tai chinh", "hop nhat", "quy"],
]

EXCLUDE_KEYWORDS = ["rieng le", "cong ty me", "cong ty con"]

# ======================================================================

def normalize_text(text):
    if not text:
        return ""
    normalized = unicodedata.normalize('NFD', text)
    without_accents = ''.join(c for c in normalized if unicodedata.category(c) != 'Mn')
    return ' '.join(without_accents.lower().split())

def sanitize_filename(filename):
    return "".join([c for c in filename if c.isalnum() or c in (' ', '_', '-')]).rstrip()

def extract_year_from_title(title):
    patterns = [r'năm\s+(\d{4})', r'(\d{4})']
    for pattern in patterns:
        match = re.search(pattern, title.lower())
        if match:
            year = int(match.group(1))
            if 2000 <= year <= datetime.now().year:
                return year
    return None

# ======================================================================

def download_reports(download_dir, stock_code, keyword_sets):
    target_dir = os.path.join(download_dir, stock_code)
    os.makedirs(target_dir, exist_ok=True)

    print(f"\n--- {stock_code} ---")

    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0"
    })

    try:
        main_url = f"https://finance.vietstock.vn/{stock_code}/tai-tai-lieu.htm"
        res = session.get(main_url, timeout=30)
        res.raise_for_status()

        soup = BeautifulSoup(res.text, 'lxml')
        token = soup.find('input', {'name': '__RequestVerificationToken'}).get('value')

        api_url = "https://finance.vietstock.vn/data/getdocument"
        page = 1
        total_downloaded = 0

        while True:
            payload = {
                "code": stock_code,
                "page": page,
                "type": 1,
                "__RequestVerificationToken": token
            }

            api_res = session.post(api_url, data=payload, timeout=30)
            api_res.raise_for_status()
            reports = api_res.json()

            if not reports:
                break

            for report in reports:
                title = report.get('Title', '').strip()
                url = report.get('Url', '').strip()

                if not title or not url:
                    continue

                # ❌ BỎ QUA nếu không phải PDF trực tiếp
                if not url.lower().endswith(".pdf"):
                    print(f"⏭️ Bỏ qua (không phải PDF): {title}")
                    continue

                # lọc năm
                year = extract_year_from_title(title)
                if year and year < START_YEAR:
                    continue

                normalized = normalize_text(title)

                if any(k in normalized for k in EXCLUDE_KEYWORDS):
                    continue

                matched = False
                for kw_set in keyword_sets:
                    if all(normalize_text(k) in normalized for k in kw_set):
                        matched = True
                        break

                if not matched:
                    continue

                filename = sanitize_filename(title) + ".pdf"
                path = os.path.join(target_dir, filename)

                if os.path.exists(path):
                    continue

                print(f"⬇️ {title}")

                try:
                    file_res = session.get(url, stream=True, timeout=60)
                    file_res.raise_for_status()

                    with open(path, 'wb') as f:
                        for chunk in file_res.iter_content(8192):
                            f.write(chunk)

                    total_downloaded += 1

                except Exception as e:
                    print(f"Lỗi tải: {e}")

            page += 1
            time.sleep(1)

        print(f"✔️ Tổng tải: {total_downloaded}")

    except Exception as e:
        print(f"Lỗi: {e}")

# ======================================================================

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.abspath(__file__))
    DOWNLOAD_DIR = os.path.join(base_dir, "downloads")

    os.makedirs(DOWNLOAD_DIR, exist_ok=True)

    for code in STOCK_CODES_TO_DOWNLOAD:
        download_reports(DOWNLOAD_DIR, code, KEYWORD_SETS)
        time.sleep(2)