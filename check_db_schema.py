import sqlite3

conn = sqlite3.connect('Database/master_db/analytics(final).db')
cur = conn.cursor()

# Check companies table
cur.execute('PRAGMA table_info(companies)')
print('Companies table schema:')
for row in cur.fetchall():
    print(f"  {row}")

cur.execute('SELECT * FROM companies LIMIT 5')
print('\nSample data:')
cols = [desc[0] for desc in cur.description]
print(f"Columns: {cols}")
for row in cur.fetchall():
    print(f"  {dict(zip(cols, row))}")

conn.close()
