# -*- coding: utf-8 -*-
"""
upload_to_kaggle.py
===================
Tu dong zip tung cong ty va upload len Kaggle dataset.

Yeu cau:
  pip install kaggle
  Dat file ~/.kaggle/kaggle.json (hoac %USERPROFILE%\.kaggle\kaggle.json tren Windows)
  Noi dung: {"username": "your_username", "key": "your_api_key"}

Cach lay kaggle.json:
  kaggle.com -> Account -> API -> Create New Token

Cach chay:
  python upload_to_kaggle.py --pdf-root "D:/X1G8/GR2/FinancialApp/system/pdf" --kaggle-user "your_username"

Sau khi chay xong:
  - Tren Kaggle se co dataset: your_username/bctc-all
  - Trong dataset co cac file zip: VCB.zip, ACB.zip, ...
  - Notebook Kaggle chi can thay INPUT_DIRS = glob("/kaggle/input/bctc-all/*.zip")
    roi giai nen ra la dung duoc

Luong xu ly:
  1. Quet pdf_root, lay tat ca subfolder (moi subfolder = 1 cong ty)
  2. Zip tung subfolder vao temp folder
  3. Kiem tra dataset da ton tai chua, neu chua thi tao moi
  4. Upload tat ca zip len dataset (hoac chi upload nhung zip moi/thay doi)
  5. In ket qua
"""

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path


# ==============================================================================
# KAGGLE API WRAPPER
# ==============================================================================

def _run(cmd: list[str], check=True) -> subprocess.CompletedProcess:
    """Chay lenh va in output."""
    print(f"  $ {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.stdout.strip():
        print(f"    {result.stdout.strip()}")
    if result.stderr.strip():
        print(f"    [stderr] {result.stderr.strip()}")
    if check and result.returncode != 0:
        raise RuntimeError(f"Command failed: {' '.join(cmd)}\n{result.stderr}")
    return result


def dataset_exists(kaggle_user: str, dataset_slug: str) -> bool:
    result = _run(
        ["kaggle", "datasets", "list", "-u", kaggle_user, "--csv"],
        check=False,
    )
    return dataset_slug in result.stdout


def create_dataset(
    kaggle_user: str,
    dataset_slug: str,
    title: str,
    zip_dir: Path,
    is_public: bool = False,
) -> None:
    """Tao dataset moi tren Kaggle."""
    # Tao dataset-metadata.json
    meta = {
        "title": title,
        "id": f"{kaggle_user}/{dataset_slug}",
        "licenses": [{"name": "CC0-1.0"}],
        "isPrivate": not is_public,
    }
    meta_path = zip_dir / "dataset-metadata.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    print(f"\nTao dataset moi: {kaggle_user}/{dataset_slug}")
    _run(["kaggle", "datasets", "create", "-p", str(zip_dir), "--dir-mode", "zip"])


def update_dataset(
    kaggle_user: str,
    dataset_slug: str,
    zip_dir: Path,
    version_notes: str = "Auto update",
) -> None:
    """Cap nhat dataset da ton tai."""
    # Tao dataset-metadata.json
    meta = {
        "title": dataset_slug,
        "id": f"{kaggle_user}/{dataset_slug}",
        "licenses": [{"name": "CC0-1.0"}],
    }
    meta_path = zip_dir / "dataset-metadata.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    print(f"\nCap nhat dataset: {kaggle_user}/{dataset_slug}")
    _run([
        "kaggle", "datasets", "version",
        "-p", str(zip_dir),
        "-m", version_notes,
        "--dir-mode", "zip",
    ])


# ==============================================================================
# ZIP HELPERS
# ==============================================================================

def _file_md5(path: Path) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def zip_company_folder(
    company_dir: Path,
    output_zip: Path,
    extensions: tuple[str, ...] = (".pdf",),
) -> int:
    """
    Zip toan bo file PDF trong company_dir vao output_zip.
    Tra ve so file da zip.
    """
    count = 0
    with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in sorted(company_dir.rglob("*")):
            if f.is_file() and f.suffix.lower() in extensions:
                zf.write(f, f.relative_to(company_dir))
                count += 1
    return count


def should_rezip(company_dir: Path, output_zip: Path) -> bool:
    """
    Kiem tra co can zip lai khong.
    Neu zip da ton tai va moi hon tat ca PDF trong folder -> bo qua.
    """
    if not output_zip.exists():
        return True
    zip_mtime = output_zip.stat().st_mtime
    for f in company_dir.rglob("*.pdf"):
        if f.stat().st_mtime > zip_mtime:
            return True
    return False


# ==============================================================================
# MAIN LOGIC
# ==============================================================================

def scan_companies(pdf_root: Path) -> list[tuple[str, Path]]:
    """
    Quet pdf_root, tra ve [(ticker, folder_path)].
    Bo qua nhung folder rong (khong co PDF).
    """
    result = []
    for item in sorted(pdf_root.iterdir()):
        if not item.is_dir():
            continue
        pdf_files = list(item.rglob("*.pdf"))
        if not pdf_files:
            print(f"  [skip] {item.name} - khong co PDF")
            continue
        ticker = item.name.upper()
        result.append((ticker, item))
        print(f"  [found] {ticker} - {len(pdf_files)} files")
    return result


def run_upload(
    pdf_root: str,
    kaggle_user: str,
    dataset_slug: str = "bctc-all",
    force_rezip: bool = False,
    batch_size: int = 50,
    is_public: bool = False,
) -> None:
    """
    Ham chinh: quet, zip, upload.

    batch_size: so cong ty moi lan update (Kaggle gioi han kich thuoc upload)
    """
    pdf_root_path = Path(pdf_root)
    if not pdf_root_path.exists():
        print(f"[ERROR] Khong tim thay folder: {pdf_root}")
        sys.exit(1)

    print(f"\n{'='*60}")
    print(f"PDF root  : {pdf_root}")
    print(f"Kaggle    : {kaggle_user}/{dataset_slug}")
    print(f"{'='*60}\n")

    # 1. Quet cong ty
    print("Quet cong ty...")
    companies = scan_companies(pdf_root_path)
    print(f"\nTim thay {len(companies)} cong ty co PDF\n")

    if not companies:
        print("Khong co gi de upload.")
        return

    # 2. Tao temp folder de chua zip
    tmp_dir = Path(tempfile.mkdtemp(prefix="bctc_upload_"))
    print(f"Temp dir: {tmp_dir}\n")

    try:
        # 3. Zip tung cong ty
        print("Zip cac folder...")
        zipped = []
        skipped = 0
        for ticker, folder in companies:
            out_zip = tmp_dir / f"{ticker}.zip"

            if not force_rezip and not should_rezip(folder, out_zip):
                print(f"  [skip] {ticker}.zip (khong thay doi)")
                skipped += 1
                # Van them vao danh sach de upload
                zipped.append((ticker, out_zip))
                continue

            n = zip_company_folder(folder, out_zip)
            size_mb = out_zip.stat().st_size / (1024 * 1024)
            print(f"  [zip]  {ticker}.zip - {n} files, {size_mb:.1f} MB")
            zipped.append((ticker, out_zip))

        print(f"\nDa zip: {len(zipped) - skipped} moi, {skipped} bo qua")

        # 4. Upload len Kaggle theo batch
        total_batches = (len(zipped) + batch_size - 1) // batch_size
        print(f"\nUpload {len(zipped)} files theo {total_batches} batch...\n")

        for batch_idx in range(total_batches):
            batch = zipped[batch_idx * batch_size : (batch_idx + 1) * batch_size]
            print(f"--- Batch {batch_idx + 1}/{total_batches} ({len(batch)} files) ---")

            # Copy batch vao upload_dir tam thoi
            upload_dir = tmp_dir / f"batch_{batch_idx}"
            upload_dir.mkdir(exist_ok=True)
            for ticker, zip_path in batch:
                shutil.copy2(zip_path, upload_dir / zip_path.name)

            # Kiem tra dataset da ton tai chua
            if batch_idx == 0 and not dataset_exists(kaggle_user, dataset_slug):
                create_dataset(
                    kaggle_user, dataset_slug,
                    title=f"BCTC Vietnam - All Companies",
                    zip_dir=upload_dir,
                    is_public=is_public,
                )
            else:
                tickers_in_batch = [t for t, _ in batch]
                update_dataset(
                    kaggle_user, dataset_slug,
                    zip_dir=upload_dir,
                    version_notes=f"Update batch {batch_idx + 1}: {', '.join(tickers_in_batch[:5])}...",
                )

            # Don dep batch dir
            shutil.rmtree(upload_dir)

        print(f"\n{'='*60}")
        print(f"HOAN THANH! Dataset: https://kaggle.com/datasets/{kaggle_user}/{dataset_slug}")
        print(f"{'='*60}\n")

        # 5. In huong dan dung trong notebook
        print("=== CAP NHAT NOTEBOOK KAGGLE ===\n")
        print("Trong notebook, thay INPUT_DIRS bang:\n")
        print("""import zipfile, glob, os

# Giai nen tat ca zip vao /kaggle/working/pdf/
ZIP_DIR  = "/kaggle/input/{}/{}"  # thay bang path thuc te
PDF_ROOT = "/kaggle/working/pdf"
os.makedirs(PDF_ROOT, exist_ok=True)

for zip_path in sorted(glob.glob(os.path.join(ZIP_DIR, "*.zip"))):
    ticker = os.path.splitext(os.path.basename(zip_path))[0]
    out_dir = os.path.join(PDF_ROOT, ticker)
    if not os.path.exists(out_dir):
        with zipfile.ZipFile(zip_path) as zf:
            zf.extractall(out_dir)
        print(f"Extracted {{ticker}}: {{len(zf.namelist())}} files")

# INPUT_DIRS la list cac subfolder sau khi giai nen
INPUT_DIRS = [d for d in glob.glob(os.path.join(PDF_ROOT, "*")) if os.path.isdir(d)]
print(f"Tim thay {{len(INPUT_DIRS)}} cong ty")
""".format(dataset_slug, dataset_slug))

    finally:
        # Don dep temp dir (giu lai neu can debug)
        keep = os.environ.get("KEEP_TEMP", "0") == "1"
        if not keep:
            shutil.rmtree(tmp_dir, ignore_errors=True)
        else:
            print(f"Temp dir giu lai: {tmp_dir}")


# ==============================================================================
# CLI
# ==============================================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Tu dong zip va upload BCTC PDF len Kaggle dataset"
    )
    parser.add_argument(
        "--pdf-root",
        required=True,
        help="Duong dan folder chua cac subfolder cong ty. VD: D:/GR2/system/pdf",
    )
    parser.add_argument(
        "--kaggle-user",
        required=True,
        help="Kaggle username cua ban",
    )
    parser.add_argument(
        "--dataset-slug",
        default="bctc-all",
        help="Ten dataset tren Kaggle (mac dinh: bctc-all)",
    )
    parser.add_argument(
        "--force-rezip",
        action="store_true",
        help="Zip lai tat ca du khong co thay doi",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=50,
        help="So cong ty moi lan push (mac dinh: 50)",
    )
    parser.add_argument(
        "--public",
        action="store_true",
        help="Dat dataset la public (mac dinh: private)",
    )

    args = parser.parse_args()
    run_upload(
        pdf_root=args.pdf_root,
        kaggle_user=args.kaggle_user,
        dataset_slug=args.dataset_slug,
        force_rezip=args.force_rezip,
        batch_size=args.batch_size,
        is_public=args.public,
    )