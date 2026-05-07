import asyncio
from backend.fastapi_auth.app.routes.screener_router import advanced_screener

def main():
    try:
        # Just passing default kwargs
        res = advanced_screener(sort_by="market_cap", sort_order="desc", limit=100,
            min_pe=None, max_pe=None, min_pb=None, max_pb=None,
            min_roe=None, max_roe=None, min_roa=None,
            min_gross_margin=None, min_net_margin=None,
            max_de=None, min_current_ratio=None,
            min_f_score=None, min_revenue_growth=None, min_profit_growth=None)
        print(f"Success! Returned {len(res)} results.")
        if len(res) > 0:
            print(res[0])
    except Exception as e:
        print(f"Failed: {e}")

if __name__ == '__main__':
    main()
