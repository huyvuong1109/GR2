"""
Legacy ORM models used by backend APIs.

This module intentionally keeps a minimal mapping to the existing
SQLite schema consumed by the current FastAPI backend.
"""

from sqlalchemy import BigInteger, Column, Float, ForeignKey, Integer, String, create_engine
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

Base = declarative_base()


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String(10), unique=True, nullable=False, index=True)
    name = Column(String(255))
    industry = Column(String(100))
    market_cap = Column(BigInteger)
    shares_outstanding = Column(BigInteger)
    current_price = Column(Float)

    balance_sheets = relationship("BalanceSheet", back_populates="company")
    income_statements = relationship("IncomeStatement", back_populates="company")
    cash_flows = relationship("CashFlow", back_populates="company")


class BalanceSheet(Base):
    __tablename__ = "balance_sheets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    period_type = Column(String(20), default="annual")
    period_year = Column(Integer, nullable=False, index=True)
    period_quarter = Column(Integer, nullable=True, index=True)

    total_assets = Column(BigInteger)
    current_assets = Column(BigInteger)
    cash_and_equivalents = Column(BigInteger)
    inventories = Column(BigInteger)

    total_liabilities = Column(BigInteger)
    current_liabilities = Column(BigInteger)
    short_term_debt = Column(BigInteger)
    long_term_debt = Column(BigInteger)

    total_equity = Column(BigInteger)

    company = relationship("Company", back_populates="balance_sheets")


class IncomeStatement(Base):
    __tablename__ = "income_statements"

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    period_type = Column(String(20), default="annual")
    period_year = Column(Integer, nullable=False, index=True)
    period_quarter = Column(Integer, nullable=True, index=True)

    revenue = Column(BigInteger)
    gross_profit = Column(BigInteger)
    selling_expenses = Column(BigInteger)
    admin_expenses = Column(BigInteger)
    operating_income = Column(BigInteger)
    financial_expenses = Column(BigInteger)
    interest_expenses = Column(BigInteger)
    profit_before_tax = Column(BigInteger)
    net_profit = Column(BigInteger)
    net_profit_to_shareholders = Column(BigInteger)

    company = relationship("Company", back_populates="income_statements")


class CashFlow(Base):
    __tablename__ = "cash_flows"

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    period_type = Column(String(20), default="annual")
    period_year = Column(Integer, nullable=False, index=True)
    period_quarter = Column(Integer, nullable=True, index=True)

    operating_cash_flow = Column(BigInteger)
    investing_cash_flow = Column(BigInteger)
    financing_cash_flow = Column(BigInteger)
    capex = Column(BigInteger)
    dividends_paid = Column(BigInteger)
    ending_cash = Column(BigInteger)
    net_change_in_cash = Column(BigInteger)

    company = relationship("Company", back_populates="cash_flows")


def init_db(database_url: str):
    """Create engine and ensure mapped tables exist."""
    engine = create_engine(database_url, echo=False)
    Base.metadata.create_all(engine)
    return engine


def get_session(engine):
    """Create a single SQLAlchemy session."""
    SessionLocal = sessionmaker(bind=engine)
    return SessionLocal()
