from fastapi import APIRouter

router = APIRouter(prefix="/api/market", tags=["market"])

@router.get('/status')
def market_status():
    """Trạng thái thị trường"""
    return {
        'status': 'open',
        'last_update': '2026-05-04 14:30:00',
        'vn_index': 1250.32,
        'vn_index_change': 1.5,
        'hnx_index': 237.14,
        'hnx_index_change': 0.8,
        'upcom_index': 92.77,
        'upcom_index_change': -0.2,
        'total_volume': 20000000000000,
        'trading_value': 5000000000000
    }
