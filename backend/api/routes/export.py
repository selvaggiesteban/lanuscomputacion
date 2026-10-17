import csv
import io
from datetime import datetime
import urllib.parse

async def handle_export_orders(request, env):
    from backend.db.database import CatalogDB
    db = CatalogDB(env.DB)

    params = urllib.parse.parse_qs(url_params(request.url))
    start_date = params.get("start_date", [None])[0]
    end_date = params.get("end_date", [None])[0]

    where_clause = "WHERE 1=1"
    query_params = []

    if start_date:
        where_clause += " AND created_at >= ?"
        query_params.append(start_date)
    if end_date:
        where_clause += " AND created_at <= ?"
        query_params.append(end_date)

    query = f"SELECT * FROM orders {where_clause} ORDER BY created_at DESC"
    rows = db.conn.execute(query, query_params).fetchall()

    if not rows:
        from backend.api.server import json_response
        return json_response({"error": "No orders found for selected range"}, 404)

    # Use io.StringIO to build CSV in memory
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=rows[0].keys())
    writer.writeheader()
    writer.writerows([dict(r) for r in rows])

    csv_content = output.getvalue()
    output.close()

    from js import Response
    return Response.new(
        csv_content,
        headers={
            "Content-Type": "text/csv",
            "Content-Disposition": f'attachment; filename="orders_{datetime.utcnow().strftime("%Y%m%d")}.csv"',
            "Access-Control-Allow-Origin": "*"
        }
    )

def url_params(url):
    import urllib.parse
    parsed = urllib.parse.urlparse(url)
    return parsed.query
