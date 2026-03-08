"""
Database Models - SQLAlchemy ORM definitions
Mô hình dữ liệu cho Báo cáo tài chính doanh nghiệp
"""
from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, create_engine, BigInteger
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from datetime import datetime
import sys
sys.path.append('..')

Base = declarative_base()


class Company(Base):
    """Thông tin doanh nghiệp"""
    __tablename__ = 'companies'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String(10), unique=True, nullable=False, index=True)  # Mã CK
    name = Column(String(200), nullable=False)  # Tên công ty
    industry = Column(String(100))  # Ngành nghề
    market_cap = Column(BigInteger)  # Vốn hóa thị trường
    shares_outstanding = Column(BigInteger)  # Số CP lưu hành
    current_price = Column(Float)  # Giá hiện tại
    price_updated_at = Column(String(50))  # Thời gian cập nhật giá
    
    # Relationships
    balance_sheets = relationship("BalanceSheet", back_populates="company")
    income_statements = relationship("IncomeStatement", back_populates="company")
    cash_flows = relationship("CashFlow", back_populates="company")
    

class BalanceSheet(Base):
    """Bảng cân đối kế toán"""
    __tablename__ = 'balance_sheets'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=False)
    period_type = Column(String(10))  # 'annual' hoặc 'quarterly'
    period_year = Column(Integer, nullable=False)  # Năm
    period_quarter = Column(Integer)  # Quý (1-4, null nếu là annual)
    raw_data = Column(String)  # Dữ liệu JSON gốc
    
    # TÀI SẢN (Assets)
    total_assets = Column(BigInteger)  # Tổng tài sản
    current_assets = Column(BigInteger)  # Tài sản ngắn hạn
    cash_and_equivalents = Column(BigInteger)  # Tiền và tương đương tiền
    short_term_investments = Column(BigInteger)  # Đầu tư tài chính ngắn hạn
    accounts_receivable = Column(BigInteger)  # Phải thu khách hàng
    inventories = Column(BigInteger)  # Hàng tồn kho
    
    non_current_assets = Column(BigInteger)  # Tài sản dài hạn
    fixed_assets = Column(BigInteger)  # Tài sản cố định
    
    # NGUỒN VỐN (Liabilities & Equity)
    total_liabilities = Column(BigInteger)  # Tổng nợ phải trả
    current_liabilities = Column(BigInteger)  # Nợ ngắn hạn
    short_term_debt = Column(BigInteger)  # Vay ngắn hạn
    
    non_current_liabilities = Column(BigInteger)  # Nợ dài hạn
    long_term_debt = Column(BigInteger)  # Vay dài hạn
    
    total_equity = Column(BigInteger)  # Vốn chủ sở hữu
    retained_earnings = Column(BigInteger)  # Lợi nhuận chưa phân phối
    
    company = relationship("Company", back_populates="balance_sheets")


class IncomeStatement(Base):
    """Báo cáo kết quả kinh doanh"""
    __tablename__ = 'income_statements'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=False)
    period_type = Column(String(10))  # 'annual' hoặc 'quarterly'
    period_year = Column(Integer, nullable=False)
    period_quarter = Column(Integer)
    raw_data = Column(String)  # Dữ liệu JSON gốc
    
    # Doanh thu
    revenue = Column(BigInteger)  # Doanh thu thuần
    cost_of_goods_sold = Column(BigInteger)  # Giá vốn hàng bán
    gross_profit = Column(BigInteger)  # Lợi nhuận gộp
    
    # Chi phí hoạt động
    selling_expenses = Column(BigInteger)  # Chi phí bán hàng
    admin_expenses = Column(BigInteger)  # Chi phí quản lý
    operating_income = Column(BigInteger)  # Lợi nhuận từ HĐKD
    
    # Chi phí tài chính
    financial_expenses = Column(BigInteger)  # Chi phí tài chính
    interest_expenses = Column(BigInteger)  # Chi phí lãi vay
    
    # Lợi nhuận
    profit_before_tax = Column(BigInteger)  # Lợi nhuận trước thuế
    net_profit = Column(BigInteger)  # Lợi nhuận sau thuế
    net_profit_to_shareholders = Column(BigInteger)  # LNST của cổ đông công ty mẹ
    
    company = relationship("Company", back_populates="income_statements")


class CashFlow(Base):
    """Báo cáo lưu chuyển tiền tệ"""
    __tablename__ = 'cash_flows'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey('companies.id'), nullable=False)
    period_type = Column(String(10))
    period_year = Column(Integer, nullable=False)
    period_quarter = Column(Integer)
    raw_data = Column(String)  # Dữ liệu JSON gốc
    
    # Dòng tiền từ hoạt động kinh doanh
    operating_cash_flow = Column(BigInteger)  # CFO
    
    # Dòng tiền từ hoạt động đầu tư
    investing_cash_flow = Column(BigInteger)  # CFI
    capex = Column(BigInteger)  # Chi đầu tư TSCĐ (CAPEX)
    
    # Dòng tiền từ hoạt động tài chính
    financing_cash_flow = Column(BigInteger)  # CFF
    dividends_paid = Column(BigInteger)  # Chi trả cổ tức
    
    # Tổng hợp
    ending_cash = Column(BigInteger)  # Tiền cuối kỳ
    
    company = relationship("Company", back_populates="cash_flows")


def init_db(database_url: str):
    """Khởi tạo database"""
    engine = create_engine(database_url, echo=False)
    Base.metadata.create_all(engine)
    return engine


def get_session(engine):
    """Tạo database session"""
    Session = sessionmaker(bind=engine)
    return Session()
