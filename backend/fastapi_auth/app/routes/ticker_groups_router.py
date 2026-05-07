from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/ticker-groups", tags=["ticker-groups"])

TICKER_GROUPS = [
    {
        'name': 'VN30',
        'description': '30 cổ phiếu lớn nhất sàn HNX',
        'tickers': ['FPT', 'VIC', 'HPG', 'VHM', 'VCB', 'MWG', 'GVR', 'REE']
    },
    {
        'name': 'Technology',
        'description': 'Công ty công nghệ',
        'tickers': ['FPT', 'MWG', 'CMG']
    },
    {
        'name': 'Banking',
        'description': 'Các ngân hàng',
        'tickers': ['VCB', 'MBB', 'BID']
    },
    {
        'name': 'Real Estate',
        'description': 'Bất động sản',
        'tickers': ['VIC', 'VHM', 'DIG']
    }
]

@router.get('')
def list_ticker_groups(limit: int = Query(4)):
    """Danh sách nhóm cổ phiếu"""
    return TICKER_GROUPS[:limit]
