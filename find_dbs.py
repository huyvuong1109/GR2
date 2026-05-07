import sqlite3
import os

# Find all sqlite databases
for root, dirs, files in os.walk('.'):
    for f in files:
        if f.endswith('.db'):
            db_path = os.path.join(root, f)
            print(f"\nDatabase: {db_path}")
            try:
                conn = sqlite3.connect(db_path)
                cur = conn.cursor()
                cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
                tables = [t[0] for t in cur.fetchall()]
                print(f"  Tables: {tables}")
                if 'watchlist' in tables or 'user' in tables or 'watchlists' in tables:
                    print("  >> Found watchlist/user tables!")
                    for table in ['user', 'users', 'watchlist', 'watchlists']:
                        if table in tables:
                            cur.execute(f'PRAGMA table_info({table})')
                            print(f"  {table} schema: {cur.fetchall()}")
                conn.close()
            except Exception as e:
                print(f"  Error: {e}")
