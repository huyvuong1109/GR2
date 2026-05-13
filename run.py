"""
Run script - Khởi chạy FastAPI backend
"""
import subprocess
import sys
import os
from pathlib import Path

def main():
    """Chạy FastAPI backend server"""
    print("""
    ╔═══════════════════════════════════════════════════╗
    ║   📊 FINANCIAL ANALYSIS PLATFORM                  ║
    ║   FastAPI Backend Server                          ║
    ╚═══════════════════════════════════════════════════╝
    """)
    
    print("🔧 Khởi động FastAPI Backend...")
    print("📍 API sẽ chạy tại: http://localhost:8000")
    print("📖 API Docs: http://localhost:8000/docs")
    print("📈 Giá cổ phiếu sẽ tự động cập nhật mỗi 2 phút")
    print("=" * 50)
    
    # Chạy uvicorn với module path
    subprocess.run([
        sys.executable, "-m", "uvicorn",
        "backend.main:app",
        "--reload",
        "--host", "0.0.0.0",
        "--port", "8000"
    ])


if __name__ == "__main__":
    main()
