"""
financial_analysis.py - Core functions for financial analysis
Các hàm tính toán chỉ số tài chính, F-Score, Health Score
"""
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_
import sys
sys.path.insert(0, './Database')
from Database.models import Company, BalanceSheet, IncomeStatement, CashFlow


def calculate_financial_ratios(
    company: Company,
    balance_sheet: Optional[BalanceSheet],
    income_statement: Optional[IncomeStatement],
    prev_income: Optional[IncomeStatement] = None,
    prev_balance: Optional[BalanceSheet] = None
) -> Dict[str, Any]:
    """
    Tính toán các chỉ số tài chính quan trọng
    
    Returns:
        Dict chứa tất cả ratios: ROE, ROA, P/E, P/B, D/E, margins, growth rates...
    """
    ratios = {
        # Định giá
        'pe_ratio': None,
        'pb_ratio': None,
        'ps_ratio': None,
        'market_cap': None,
        'price': None,
        
        # Sinh lợi
        'roe': None,  # Return on Equity
        'roa': None,  # Return on Assets
        'ros': None,  # Return on Sales (Net Margin)
        
        # Biên lợi nhuận
        'gross_margin': None,
        'operating_margin': None,
        'net_margin': None,
        
        # Đòn bẩy tài chính
        'debt_to_equity': None,
        'debt_to_assets': None,
        'current_ratio': None,
        'quick_ratio': None,
        
        # Tăng trưởng
        'revenue_growth': None,
        'profit_growth': None,
        'equity_growth': None,
        
        # Cổ tức
        'dividend_yield': None,
        
        # Per share
        'eps': None,
        'bvps': None,
        
        # Raw values
        'revenue': None,
        'net_profit': None,
        'total_assets': None,
        'total_equity': None,
        'total_debt': None,
        'shares_outstanding': None,
    }
    
    # Basic info
    price = company.current_price
    shares = company.shares_outstanding
    
    ratios['price'] = price
    ratios['shares_outstanding'] = shares
    
    if price and shares:
        ratios['market_cap'] = price * shares
    elif company.market_cap:
        ratios['market_cap'] = company.market_cap
    
    # Balance Sheet ratios
    if balance_sheet:
        total_assets = balance_sheet.total_assets or 0
        total_equity = balance_sheet.total_equity or 0
        total_liabilities = balance_sheet.total_liabilities or 0
        current_assets = balance_sheet.current_assets or 0
        current_liabilities = balance_sheet.current_liabilities or 0
        inventories = balance_sheet.inventories or 0
        cash = balance_sheet.cash_and_equivalents or 0
        
        ratios['total_assets'] = total_assets
        ratios['total_equity'] = total_equity
        ratios['total_debt'] = total_liabilities
        
        # BVPS (Book Value Per Share)
        if shares and shares > 0 and total_equity:
            ratios['bvps'] = total_equity / shares
        
        # P/B
        if price and ratios['bvps'] and ratios['bvps'] > 0:
            ratios['pb_ratio'] = price / ratios['bvps']
        
        # D/E (Debt to Equity)
        if total_equity and total_equity > 0:
            ratios['debt_to_equity'] = total_liabilities / total_equity
        
        # Debt to Assets
        if total_assets and total_assets > 0:
            ratios['debt_to_assets'] = total_liabilities / total_assets
        
        # Current Ratio
        if current_liabilities and current_liabilities > 0:
            ratios['current_ratio'] = current_assets / current_liabilities
        
        # Quick Ratio
        if current_liabilities and current_liabilities > 0:
            ratios['quick_ratio'] = (current_assets - inventories) / current_liabilities
        
        # Equity Growth
        if prev_balance and prev_balance.total_equity and prev_balance.total_equity > 0:
            ratios['equity_growth'] = (total_equity - prev_balance.total_equity) / prev_balance.total_equity * 100
    
    # Income Statement ratios
    if income_statement:
        revenue = income_statement.revenue or 0
        gross_profit = income_statement.gross_profit or 0
        operating_income = income_statement.operating_income or 0
        net_profit = income_statement.net_profit or 0
        
        ratios['revenue'] = revenue
        ratios['net_profit'] = net_profit
        
        # EPS
        if shares and shares > 0 and net_profit:
            ratios['eps'] = net_profit / shares
        
        # P/E
        if price and ratios['eps'] and ratios['eps'] > 0:
            ratios['pe_ratio'] = price / ratios['eps']
        
        # P/S
        if price and shares and shares > 0 and revenue > 0:
            revenue_per_share = revenue / shares
            ratios['ps_ratio'] = price / revenue_per_share
        
        # Margins
        if revenue and revenue > 0:
            ratios['gross_margin'] = (gross_profit / revenue) * 100
            ratios['operating_margin'] = (operating_income / revenue) * 100
            ratios['net_margin'] = (net_profit / revenue) * 100
            ratios['ros'] = ratios['net_margin']
        
        # ROE
        if balance_sheet and balance_sheet.total_equity and balance_sheet.total_equity > 0:
            ratios['roe'] = (net_profit / balance_sheet.total_equity) * 100
        
        # ROA
        if balance_sheet and balance_sheet.total_assets and balance_sheet.total_assets > 0:
            ratios['roa'] = (net_profit / balance_sheet.total_assets) * 100
        
        # Growth rates
        if prev_income:
            prev_revenue = prev_income.revenue or 0
            prev_profit = prev_income.net_profit or 0
            
            if prev_revenue > 0:
                ratios['revenue_growth'] = ((revenue - prev_revenue) / prev_revenue) * 100
            
            if prev_profit > 0:
                ratios['profit_growth'] = ((net_profit - prev_profit) / prev_profit) * 100
        
        # Dividend Yield - Not available in current database schema
        # Set to 0 or None as default
        ratios['dividend_yield'] = 0
    
    return ratios


def calculate_piotroski_f_score(
    balance_sheet: Optional[BalanceSheet],
    prev_balance: Optional[BalanceSheet],
    income_statement: Optional[IncomeStatement],
    prev_income: Optional[IncomeStatement],
    cash_flow: Optional[CashFlow],
    shares_outstanding: int = 0
) -> Dict[str, Any]:
    """
    Tính Piotroski F-Score (0-9)
    
    9 tiêu chí:
    PROFITABILITY (4 điểm):
    1. ROA > 0
    2. CFO > 0
    3. ROA tăng so với năm trước
    4. CFO > Net Income (Accruals)
    
    LEVERAGE/LIQUIDITY (3 điểm):
    5. Long-term debt giảm
    6. Current ratio tăng
    7. Không phát hành cổ phiếu mới
    
    OPERATING EFFICIENCY (2 điểm):
    8. Gross margin tăng
    9. Asset turnover tăng
    """
    score = 0
    details = {
        'total_score': 0,
        'criteria': {}
    }
    
    # Chuẩn bị data
    if not income_statement or not balance_sheet:
        return {'total_score': 0, 'criteria': {}, 'error': 'Missing data'}
    
    net_profit = income_statement.net_profit or 0
    revenue = income_statement.revenue or 0
    gross_profit = income_statement.gross_profit or 0
    total_assets = balance_sheet.total_assets or 1  # Avoid div by 0
    total_equity = balance_sheet.total_equity or 0
    current_assets = balance_sheet.current_assets or 0
    current_liabilities = balance_sheet.current_liabilities or 1
    long_term_debt = balance_sheet.long_term_debt or 0
    
    cfo = (cash_flow.operating_cash_flow if cash_flow and cash_flow.operating_cash_flow is not None else 0)
    
    # Previous year data
    prev_net_profit = (prev_income.net_profit if prev_income and prev_income.net_profit is not None else 0)
    prev_revenue = (prev_income.revenue if prev_income and prev_income.revenue is not None else 0)
    prev_gross_profit = (prev_income.gross_profit if prev_income and prev_income.gross_profit is not None else 0)
    prev_total_assets = (prev_balance.total_assets if prev_balance and prev_balance.total_assets is not None else 1)
    prev_current_assets = (prev_balance.current_assets if prev_balance and prev_balance.current_assets is not None else 0)
    prev_current_liabilities = (prev_balance.current_liabilities if prev_balance and prev_balance.current_liabilities is not None else 1)
    prev_long_term_debt = (prev_balance.long_term_debt if prev_balance and prev_balance.long_term_debt is not None else 0)
    prev_shares = shares_outstanding  # Simplified
    
    # === PROFITABILITY ===
    
    # 1. ROA > 0
    roa = net_profit / total_assets
    criteria_1 = roa > 0
    details['criteria']['roa_positive'] = {
        'passed': criteria_1,
        'value': round(roa * 100, 2),
        'description': 'ROA > 0%'
    }
    if criteria_1:
        score += 1
    
    # 2. CFO > 0
    criteria_2 = cfo > 0
    details['criteria']['cfo_positive'] = {
        'passed': criteria_2,
        'value': cfo,
        'description': 'Operating Cash Flow > 0'
    }
    if criteria_2:
        score += 1
    
    # 3. ROA tăng
    prev_roa = prev_net_profit / prev_total_assets if prev_total_assets > 0 else 0
    criteria_3 = roa > prev_roa
    details['criteria']['roa_improving'] = {
        'passed': criteria_3,
        'value': f"{round(prev_roa*100, 2)}% → {round(roa*100, 2)}%",
        'description': 'ROA improving YoY'
    }
    if criteria_3:
        score += 1
    
    # 4. CFO > Net Income (Earnings Quality)
    criteria_4 = cfo > net_profit
    details['criteria']['earnings_quality'] = {
        'passed': criteria_4,
        'value': f"CFO: {cfo:,.0f}, NI: {net_profit:,.0f}",
        'description': 'CFO > Net Income (quality earnings)'
    }
    if criteria_4:
        score += 1
    
    # === LEVERAGE/LIQUIDITY ===
    
    # 5. Long-term debt giảm
    criteria_5 = long_term_debt <= prev_long_term_debt
    details['criteria']['debt_decreasing'] = {
        'passed': criteria_5,
        'value': f"{prev_long_term_debt:,.0f} → {long_term_debt:,.0f}",
        'description': 'Long-term debt decreasing'
    }
    if criteria_5:
        score += 1
    
    # 6. Current ratio tăng
    current_ratio = current_assets / current_liabilities
    prev_current_ratio = prev_current_assets / prev_current_liabilities if prev_current_liabilities > 0 else 0
    criteria_6 = current_ratio > prev_current_ratio
    details['criteria']['liquidity_improving'] = {
        'passed': criteria_6,
        'value': f"{prev_current_ratio:.2f} → {current_ratio:.2f}",
        'description': 'Current ratio improving'
    }
    if criteria_6:
        score += 1
    
    # 7. Không phát hành cổ phiếu (simplified - assuming shares same)
    criteria_7 = True  # Simplified
    details['criteria']['no_dilution'] = {
        'passed': criteria_7,
        'value': 'No new shares issued',
        'description': 'No share dilution'
    }
    if criteria_7:
        score += 1
    
    # === OPERATING EFFICIENCY ===
    
    # 8. Gross margin tăng
    gross_margin = gross_profit / revenue if revenue > 0 else 0
    prev_gross_margin = prev_gross_profit / prev_revenue if prev_revenue > 0 else 0
    criteria_8 = gross_margin > prev_gross_margin
    details['criteria']['margin_improving'] = {
        'passed': criteria_8,
        'value': f"{prev_gross_margin*100:.1f}% → {gross_margin*100:.1f}%",
        'description': 'Gross margin improving'
    }
    if criteria_8:
        score += 1
    
    # 9. Asset turnover tăng
    asset_turnover = revenue / total_assets
    prev_asset_turnover = prev_revenue / prev_total_assets if prev_total_assets > 0 else 0
    criteria_9 = asset_turnover > prev_asset_turnover
    details['criteria']['efficiency_improving'] = {
        'passed': criteria_9,
        'value': f"{prev_asset_turnover:.2f} → {asset_turnover:.2f}",
        'description': 'Asset turnover improving'
    }
    if criteria_9:
        score += 1
    
    details['total_score'] = score
    details['interpretation'] = get_f_score_interpretation(score)
    
    return details


def get_f_score_interpretation(score: int) -> Dict[str, str]:
    """Phân tích ý nghĩa F-Score"""
    if score >= 8:
        return {
            'level': 'excellent',
            'label': 'Xuất sắc',
            'color': 'green',
            'description': 'Công ty có sức khỏe tài chính tuyệt vời, là ứng viên đầu tư tiềm năng'
        }
    elif score >= 6:
        return {
            'level': 'good',
            'label': 'Tốt',
            'color': 'blue',
            'description': 'Công ty có nền tảng tài chính vững chắc'
        }
    elif score >= 4:
        return {
            'level': 'average',
            'label': 'Trung bình',
            'color': 'yellow',
            'description': 'Công ty ở mức trung bình, cần phân tích thêm'
        }
    elif score >= 2:
        return {
            'level': 'weak',
            'label': 'Yếu',
            'color': 'orange',
            'description': 'Công ty có nhiều vấn đề tài chính, cần cẩn thận'
        }
    else:
        return {
            'level': 'poor',
            'label': 'Kém',
            'color': 'red',
            'description': 'Sức khỏe tài chính rất yếu, không nên đầu tư'
        }


def detect_risk_warnings(
    income_statements: List[IncomeStatement],
    cash_flows: List[CashFlow],
    balance_sheet: Optional[BalanceSheet],
    ratios: Dict[str, Any]
) -> List[Dict[str, str]]:
    """
    Phát hiện các cảnh báo rủi ro
    
    Returns:
        List các warnings với level (critical, warning, info)
    """
    warnings = []
    
    # 1. Lợi nhuận âm liên tiếp
    if len(income_statements) >= 2:
        recent_profits = [is_.net_profit or 0 for is_ in income_statements[:4]]
        negative_count = sum(1 for p in recent_profits if p < 0)
        
        if negative_count >= 2:
            warnings.append({
                'level': 'critical',
                'type': 'consecutive_losses',
                'title': '🔴 Lỗ liên tiếp',
                'message': f'Lợi nhuận âm {negative_count} kỳ gần nhất',
                'recommendation': 'Cần xem xét kỹ nguyên nhân lỗ và khả năng phục hồi'
            })
    
    # 2. CFO âm liên tiếp
    if len(cash_flows) >= 2:
        recent_cfo = [cf.operating_cash_flow or 0 for cf in cash_flows[:4]]
        negative_cfo = sum(1 for c in recent_cfo if c < 0)
        
        if negative_cfo >= 2:
            warnings.append({
                'level': 'critical',
                'type': 'negative_cfo',
                'title': '🔴 Dòng tiền kinh doanh âm',
                'message': f'CFO âm {negative_cfo} kỳ liên tiếp',
                'recommendation': 'Công ty không tạo ra tiền từ hoạt động kinh doanh'
            })
    
    # 3. D/E quá cao
    de_ratio = ratios.get('debt_to_equity')
    if de_ratio and de_ratio > 2:
        warnings.append({
            'level': 'critical' if de_ratio > 3 else 'warning',
            'type': 'high_leverage',
            'title': '🟠 Đòn bẩy tài chính cao',
            'message': f'Nợ/Vốn chủ = {de_ratio:.2f}x (>2x)',
            'recommendation': 'Rủi ro tài chính cao nếu lãi suất tăng hoặc kinh tế suy thoái'
        })
    
    # 4. ROE âm
    roe = ratios.get('roe')
    if roe and roe < 0:
        warnings.append({
            'level': 'critical',
            'type': 'negative_roe',
            'title': '🔴 ROE âm',
            'message': f'ROE = {roe:.1f}%',
            'recommendation': 'Công ty đang làm mất vốn chủ sở hữu'
        })
    
    # 5. Current ratio thấp
    current_ratio = ratios.get('current_ratio')
    if current_ratio and current_ratio < 1:
        warnings.append({
            'level': 'warning',
            'type': 'low_liquidity',
            'title': '🟡 Thanh khoản thấp',
            'message': f'Current ratio = {current_ratio:.2f} (<1)',
            'recommendation': 'Khả năng thanh toán nợ ngắn hạn kém'
        })
    
    # 6. Gross margin thấp hoặc giảm
    gross_margin = ratios.get('gross_margin')
    if gross_margin and gross_margin < 10:
        warnings.append({
            'level': 'warning',
            'type': 'low_margin',
            'title': '🟡 Biên lợi nhuận thấp',
            'message': f'Gross margin = {gross_margin:.1f}% (<10%)',
            'recommendation': 'Công ty có lợi thế cạnh tranh yếu'
        })
    
    # 7. P/E quá cao
    pe_ratio = ratios.get('pe_ratio')
    if pe_ratio and pe_ratio > 25:
        warnings.append({
            'level': 'info',
            'type': 'high_pe',
            'title': '🔵 P/E cao',
            'message': f'P/E = {pe_ratio:.1f}x (>25x)',
            'recommendation': 'Định giá cao, có thể rủi ro nếu tăng trưởng không như kỳ vọng'
        })
    
    # 8. Doanh thu giảm
    revenue_growth = ratios.get('revenue_growth')
    if revenue_growth and revenue_growth < -10:
        warnings.append({
            'level': 'warning',
            'type': 'declining_revenue',
            'title': '🟠 Doanh thu sụt giảm',
            'message': f'Tăng trưởng doanh thu = {revenue_growth:.1f}%',
            'recommendation': 'Cần tìm hiểu nguyên nhân giảm doanh thu'
        })
    
    return warnings


def calculate_health_score(
    f_score: int,
    ratios: Dict[str, Any],
    warnings: List[Dict]
) -> Dict[str, Any]:
    """
    Tính Health Score tổng hợp (0-100)
    
    Dựa trên:
    - F-Score (40%)
    - Định giá (20%)
    - Tăng trưởng (20%)
    - Warnings (20%)
    """
    score = 0
    breakdown = {}
    
    # 1. F-Score (40 điểm)
    f_score_points = (f_score / 9) * 40
    breakdown['f_score'] = {
        'points': round(f_score_points, 1),
        'max': 40,
        'value': f_score
    }
    score += f_score_points
    
    # 2. Định giá (20 điểm)
    valuation_points = 0
    pe = ratios.get('pe_ratio')
    pb = ratios.get('pb_ratio')
    
    if pe and pe > 0:
        if pe < 10:
            valuation_points += 10
        elif pe < 15:
            valuation_points += 7
        elif pe < 20:
            valuation_points += 4
        elif pe < 25:
            valuation_points += 2
    
    if pb and pb > 0:
        if pb < 1:
            valuation_points += 10
        elif pb < 1.5:
            valuation_points += 7
        elif pb < 2:
            valuation_points += 4
        elif pb < 3:
            valuation_points += 2
    
    breakdown['valuation'] = {
        'points': valuation_points,
        'max': 20,
        'pe': pe,
        'pb': pb
    }
    score += valuation_points
    
    # 3. Tăng trưởng (20 điểm)
    growth_points = 0
    revenue_growth = ratios.get('revenue_growth')
    profit_growth = ratios.get('profit_growth')
    
    if revenue_growth:
        if revenue_growth > 20:
            growth_points += 10
        elif revenue_growth > 10:
            growth_points += 7
        elif revenue_growth > 0:
            growth_points += 4
        elif revenue_growth > -10:
            growth_points += 2
    
    if profit_growth:
        if profit_growth > 20:
            growth_points += 10
        elif profit_growth > 10:
            growth_points += 7
        elif profit_growth > 0:
            growth_points += 4
        elif profit_growth > -10:
            growth_points += 2
    
    breakdown['growth'] = {
        'points': growth_points,
        'max': 20,
        'revenue_growth': revenue_growth,
        'profit_growth': profit_growth
    }
    score += growth_points
    
    # 4. Risk penalties (20 điểm, trừ theo warnings)
    risk_penalty = 0
    critical_count = sum(1 for w in warnings if w['level'] == 'critical')
    warning_count = sum(1 for w in warnings if w['level'] == 'warning')
    
    risk_penalty = critical_count * 7 + warning_count * 3
    risk_points = max(0, 20 - risk_penalty)
    
    breakdown['risk'] = {
        'points': risk_points,
        'max': 20,
        'critical_warnings': critical_count,
        'warnings': warning_count
    }
    score += risk_points
    
    # Interpretation
    if score >= 80:
        interpretation = {'level': 'excellent', 'label': 'Xuất sắc', 'color': 'green'}
    elif score >= 60:
        interpretation = {'level': 'good', 'label': 'Tốt', 'color': 'blue'}
    elif score >= 40:
        interpretation = {'level': 'average', 'label': 'Trung bình', 'color': 'yellow'}
    elif score >= 20:
        interpretation = {'level': 'weak', 'label': 'Yếu', 'color': 'orange'}
    else:
        interpretation = {'level': 'poor', 'label': 'Kém', 'color': 'red'}
    
    return {
        'total_score': round(score, 1),
        'max_score': 100,
        'breakdown': breakdown,
        'interpretation': interpretation
    }
