"""
Configuration settings for the Financial Analysis App
"""
import os
from pathlib import Path

# Base directory
BASE_DIR = Path(__file__).resolve().parent.parent

# Database settings
DATABASE_URL = f"sqlite:///{BASE_DIR}/Database/master_db/analytics(final).db"
DATABASE_PATH = BASE_DIR / "Database" / "master_db" / "analytics(final).db"

# API settings
API_HOST = "0.0.0.0"
API_PORT = 8000
API_DEBUG = True

# App settings
APP_NAME = "Financial Analysis Platform"
APP_VERSION = "1.0.0"
APP_DESCRIPTION = "Web App phục vụ phân tích báo cáo tài chính và đầu tư dài hạn"
