from datetime import datetime
import urllib.parse

async def handle_reports(request, env):
    from backend.db.database import CatalogDB
    db = CatalogDB(env.DB)

    # Parse query params
    params = urllib.parse.parse_qs(url_params(request.url))
    start_date = params.get("start_date", [None])[0]
    end_date = params.get("end_date", [None])[0]

    # Date range filtering
    where_clause = "WHERE 1=1"
    query_params = []

    if start_date:
        where_clause += " AND created_at >= ?"
        query_params.append(start_date)
    if end_date:
        where_clause += " AND created_at <= ?"
        query_params.append(end_date)

    # 1. Total Sales & Number of Orders
    sales_query = f"SELECT SUM(total_price) as total_sales, COUNT(id) as order_count FROM orders {where_clause}"
    sales_row = db.conn.execute(sales_query, query_params).fetchone()

    # 2. Top Products (by quantity sold)
    top_products_query = f"""
        SELECT p.title, SUM(o.quantity) as total_qty, SUM(o.total_price) as total_revenue
        FROM orders o
        JOIN products p ON o.product_id = p.id
        {where_clause}
        GROUP BY o.product_id
        ORDER BY total_qty DESC
        LIMIT 5
    """
    top_products_rows = db.conn.execute(top_products_query, query_params).fetchall()

    # 3. Revenue by Payment Method
    payment_query = f"""
        SELECT payment_method, SUM(total_price) as total_revenue, COUNT(id) as order_count
        FROM orders
        {where_clause}
        GROUP BY payment_method
    """
    payment_rows = db.conn.execute(payment_query, query_params).fetchall()

    # Format results
    report = {
        "metrics": {
            "total_sales": float(sales_row["total_sales"] or 0),
            "order_count": sales_row["order_count"] or 0,
        },
        "top_products": [dict(r) for r in top_products_rows],
        "payment_methods": [dict(r) for r in payment_rows],
    }

    from backend.api.server import json_response
    return json_response(report)

def url_params(url):
    import urllib.parse
    parsed = urllib.parse.urlparse(url)
    return parsed.query
