# -*- coding: utf-8 -*-
"""
upload_to_kaggle.py
===================
Tu dong zip va upload PDF len Kaggle dataset theo nhom ma.

Cach chay:
  python upload_to_kaggle.py --group group_01
  python upload_to_kaggle.py --group group_02
  python upload_to_kaggle.py --all          # upload tat ca nhom

File ticker_groups.json (dat canh script nay):
{
  "group_01": ["VCB", "BID", "CTG", "TCB", "VPB"],
  "group_02": ["MBB", "ACB", "HDB", "STB", "TPB"],
  ...
}

Yeu cau:
  pip install kaggle
  File ~/.kaggle/kaggle.json voi {"username": "...", "key": "..."}
  Lay tai: kaggle.com -> Account -> API -> Create New Token
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path


# ==============================================================================
# CAU HINH MAC DINH — sua cho phu hop
# ==============================================================================

DEFAULT_PDF_ROOT    = r"D:\X1G8\GR2\FinancialApp\system\downloads"
DEFAULT_GROUPS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ticker_groups.json")


# ==============================================================================
# HELPER
# ==============================================================================

def _run(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess:
    print(f"  $ {' '.join(str(c) for c in cmd)}")
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.stdout.strip():
        print(f"    {r.stdout.strip()}")
    if r.stderr.strip():
        print(f"    [err] {r.stderr.strip()[:200]}")
    if check and r.returncode != 0:
        raise RuntimeError(f"Command failed (exit {r.returncode})")
    return r


def load_groups(groups_file: str) -> dict[str, list[str]]:
    if not os.path.exists(groups_file):
        print(f"[WARN] Khong tim thay {groups_file}")
        print("       Tao file ticker_groups.json mac dinh...")
        default = {
            "group_01": ["VCB", "BID", "CTG", "TCB", "VPB"],
            "group_02": ["MBB", "ACB", "HDB", "STB", "TPB"],
        }
        with open(groups_file, "w", encoding="utf-8") as f:
            json.dump(default, f, indent=2, ensure_ascii=False)
        print(f"       Da tao: {groups_file} — hay chinh sua lai.")
        return default

    with open(groups_file, "r", encoding="utf-8") as f:
        return json.load(f)


def zip_ticker(pdf_root: Path, ticker: str, out_zip: Path) -> int:
    """Zip tat ca PDF cua 1 ticker. Tra ve so file."""
    ticker_dir = pdf_root / ticker
    if not ticker_dir.exists():
        # Thu voi ten khac nhau (viet thuong, viet hoa)
        for candidate in pdf_root.iterdir():
            if candidate.is_dir() and candidate.name.upper() == ticker.upper():
                ticker_dir = candidate
                break
        else:
            print(f"    [WARN] Khong tim thay folder: {ticker_dir}")
            return 0

    pdfs = list(ticker_dir.rglob("*.pdf"))
    if not pdfs:
        print(f"    [WARN] {ticker}: khong co file PDF")
        return 0

    with zipfile.ZipFile(out_zip, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for pdf in sorted(pdfs):
            zf.write(pdf, pdf.relative_to(ticker_dir))

    size_mb = out_zip.stat().st_size / (1024 * 1024)
    print(f"    [zip] {ticker}.zip — {len(pdfs)} files, {size_mb:.1f} MB")
    return len(pdfs)


def dataset_exists(kaggle_user: str, slug: str) -> bool:
    r = _run(["kaggle", "datasets", "list", kaggle_user, "--csv"], check=False)
    return slug in r.stdout


def write_metadata(upload_dir: Path, kaggle_user: str, slug: str, title: str) -> None:
    meta = {
        "title": title,
        "id": f"{kaggle_user}/{slug}",
        "licenses": [{"name": "CC0-1.0"}],
        "isPrivate": True,
    }
    with open(upload_dir / "dataset-metadata.json", "w") as f:
        json.dump(meta, f, indent=2)


def upload_group(
    pdf_root: Path,
    tickers: list[str],
    kaggle_user: str,
    group_name: str,
) -> None:
    """Zip va upload 1 nhom ticker len 1 dataset rieng."""
    slug  = f"bctc-{group_name}".replace("_", "-")
    title = f"BCTC Vietnam - {group_name.upper()}"

    print(f"\n{'='*55}")
    print(f"NHOM: {group_name}  ({len(tickers)} ma)")
    print(f"Dataset: {kaggle_user}/{slug}")
    print(f"{'='*55}")

    tmp = Path(tempfile.mkdtemp(prefix=f"bctc_{group_name}_"))
    try:
        # Zip tung ticker
        total_files = 0
        zipped: list[str] = []
        for ticker in tickers:
            out_zip = tmp / f"{ticker}.zip"
            n = zip_ticker(pdf_root, ticker, out_zip)
            if n > 0:
                total_files += n
                zipped.append(ticker)

        if not zipped:
            print(f"  [SKIP] Khong co ticker nao co PDF trong nhom {group_name}")
            return

        print(f"\n  Tong: {len(zipped)} ticker, {total_files} file PDF")

        # Ghi metadata
        write_metadata(tmp, kaggle_user, slug, title)

        # Kiem tra dataset ton tai chua
        if not dataset_exists(kaggle_user, slug):
            print(f"\n  Tao dataset moi: {slug}")
            _run(["kaggle", "datasets", "create", "-p", str(tmp), "--dir-mode", "zip"])
        else:
            print(f"\n  Cap nhat dataset: {slug}")
            _run([
                "kaggle", "datasets", "version",
                "-p", str(tmp),
                "-m", f"Update {group_name}: {', '.join(zipped[:5])}",
                "--dir-mode", "zip",
            ])

        print(f"\n  DONE: https://kaggle.com/datasets/{kaggle_user}/{slug}")

    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def print_notebook_instructions(kaggle_user: str, groups: dict[str, list[str]]) -> None:
    """In huong dan dung trong Kaggle notebook."""
    slugs = [f"bctc-{g}" for g in groups]
    print("\n" + "="*60)
    print("HUONG DAN TRONG KAGGLE NOTEBOOK")
    print("="*60)
    print("""
# Cell 1 — Giai nen tat ca dataset vao /kaggle/working/pdf/
import zipfile, glob, os

PDF_ROOT = "/kaggle/working/pdf"
os.makedirs(PDF_ROOT, exist_ok=True)

# Duyet qua tat ca dataset da them vao notebook
for zip_path in sorted(glob.glob("/kaggle/input/bctc-*/*.zip")):
    ticker  = os.path.splitext(os.path.basename(zip_path))[0]
    out_dir = os.path.join(PDF_ROOT, ticker)
    if not os.path.exists(out_dir):
        os.makedirs(out_dir, exist_ok=True)
        with zipfile.ZipFile(zip_path) as zf:
            zf.extractall(out_dir)
        print(f"Extracted {ticker}: {len(zf.namelist())} files")

INPUT_DIRS = [d for d in glob.glob(f"{PDF_ROOT}/*") if os.path.isdir(d)]
print(f"Tim thay {len(INPUT_DIRS)} cong ty")
""")
    print("Them cac dataset vao notebook:")
    for slug in slugs:
        print(f"  + {kaggle_user}/{slug}")


# ==============================================================================
# TIEN ICH: Tao ticker_groups.json tu danh sach cua ban
# ==============================================================================

def generate_groups_file(tickers: list[str], group_size: int, output_path: str) -> None:
    """
    Chia danh sach ticker thanh nhom nho va ghi ra file JSON.
    VD: generate_groups_file(["VCB","ACB",...], group_size=10, output_path="ticker_groups.json")
    """
    groups: dict[str, list[str]] = {}
    for i in range(0, len(tickers), group_size):
        name = f"group_{i // group_size + 1:02d}"
        groups[name] = tickers[i : i + group_size]

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(groups, f, indent=2, ensure_ascii=False)

    print(f"Da tao {len(groups)} nhom vao {output_path}")
    for name, lst in groups.items():
        print(f"  {name}: {lst}")


# ==============================================================================
# CLI
# ==============================================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Zip va upload BCTC PDF len Kaggle dataset theo nhom"
    )
    parser.add_argument("--pdf-root",    default=DEFAULT_PDF_ROOT, help="Folder chua cac subfolder ticker")
    parser.add_argument("--groups-file", default=DEFAULT_GROUPS_FILE, help="File JSON dinh nghia cac nhom")
    parser.add_argument("--kaggle-user", required=True, help="Kaggle username")
    parser.add_argument("--group",       default=None, help="Ten nhom can upload (vd: group_01)")
    parser.add_argument("--all",         action="store_true", help="Upload tat ca cac nhom")
    parser.add_argument(
        "--generate-groups",
        nargs="+",
        metavar="TICKER",
        help="Tao ticker_groups.json tu danh sach ticker (VD: --generate-groups VCB ACB BID)",
    )
    parser.add_argument("--group-size",  type=int, default=10, help="So ma moi nhom khi tao (mac dinh: 10)")

    args = parser.parse_args()

    # Tao groups file
    if args.generate_groups:
        generate_groups_file(
            tickers=[t.upper() for t in args.generate_groups],
            group_size=args.group_size,
            output_path=args.groups_file,
        )
        sys.exit(0)

    pdf_root = Path(args.pdf_root)
    if not pdf_root.exists():
        print(f"[ERROR] Khong tim thay: {pdf_root}")
        sys.exit(1)

    groups = load_groups(args.groups_file)

    if args.all:
        for group_name, tickers in groups.items():
            upload_group(pdf_root, tickers, args.kaggle_user, group_name)
        print_notebook_instructions(args.kaggle_user, groups)

    elif args.group:
        if args.group not in groups:
            print(f"[ERROR] Nhom '{args.group}' khong co trong {args.groups_file}")
            print(f"        Cac nhom hien co: {list(groups.keys())}")
            sys.exit(1)
        upload_group(pdf_root, groups[args.group], args.kaggle_user, args.group)
        print_notebook_instructions(args.kaggle_user, {args.group: groups[args.group]})

    else:
        print("Vui long chi dinh --group <ten_nhom> hoac --all")
        print(f"Cac nhom trong {args.groups_file}:")
        for name, lst in groups.items():
            print(f"  {name}: {lst}")
        parser.print_help()