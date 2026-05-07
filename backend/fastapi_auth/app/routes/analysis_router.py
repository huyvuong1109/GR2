from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/analysis", tags=["analysis"])

# Mock health scores
HEALTH_SCORES = {
    'FPT': {'score': 7.8, 'rating': 'Good', 'trend': 'up', 'components': {'profitability': 8, 'liquidity': 7.5, 'efficiency': 8}},
    'VIC': {'score': 6.5, 'rating': 'Fair', 'trend': 'down', 'components': {'profitability': 7, 'liquidity': 6, 'efficiency': 6.5}},
    'HPG': {'score': 8.2, 'rating': 'Very Good', 'trend': 'up', 'components': {'profitability': 8.5, 'liquidity': 8, 'efficiency': 8}},
    'VHM': {'score': 7.5, 'rating': 'Good', 'trend': 'stable', 'components': {'profitability': 7.8, 'liquidity': 7, 'efficiency': 7.5}},
    'VCB': {'score': 8.0, 'rating': 'Very Good', 'trend': 'up', 'components': {'profitability': 8.2, 'liquidity': 8, 'efficiency': 7.8}},
    'MWG': {'score': 7.2, 'rating': 'Good', 'trend': 'up', 'components': {'profitability': 7.5, 'liquidity': 7, 'efficiency': 7}},
}

@router.get('/{ticker}/health-score')
def get_health_score(ticker: str):
    """Lấy health score của công ty"""
    ticker_upper = ticker.upper()
    if ticker_upper in HEALTH_SCORES:
        return HEALTH_SCORES[ticker_upper]
    return {
        'score': 5.0,
        'rating': 'Neutral',
        'trend': 'stable',
        'components': {'profitability': 5, 'liquidity': 5, 'efficiency': 5}
    }
