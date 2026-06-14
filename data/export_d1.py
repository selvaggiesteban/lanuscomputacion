import sqlite3, os

db_path = 'data/catalog.db'
if not os.path.exists(db_path):
    print('DB not found')
    exit(1)

conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = [row['name'] for row in cursor.fetchall()]

lines = ['-- DATA EXPORT for D1']
for table in tables:
    cursor.execute(f'SELECT * FROM [{table}]')
    rows = cursor.fetchall()
    if not rows:
        continue
    columns = [desc[0] for desc in cursor.description]
    col_names = ', '.join(f'"{c}"' for c in columns)

    for row in rows:
        vals = [row[c] for c in columns]
        escaped = []
        for v in vals:
            if v is None:
                escaped.append('NULL')
            elif isinstance(v, (int, float)):
                escaped.append(str(v))
            else:
                sv = str(v).replace("'", "''")
                escaped.append(f"'{sv}'")
        vals_str = ', '.join(escaped)
        lines.append(f'INSERT OR IGNORE INTO "{table}" ({col_names}) VALUES ({vals_str});')



output = '\n'.join(lines)
with open('data/d1_export.sql', 'w', encoding='utf-8') as f:
    f.write(output)
print(f'Exported {len(lines)} lines to data/d1_export.sql')
print(f'Tables: {tables}')
conn.close()
