from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
import os

BASE_DIR = Path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
USER_DB_PATH = os.path.join(BASE_DIR, 'user.db')
USER_DATABASE_URL = f"sqlite:///{USER_DB_PATH}"

engine = create_engine(USER_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
