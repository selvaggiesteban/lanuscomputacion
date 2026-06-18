"""
Publisher: pushes normalized product data to D1 via the admin API.
"""
import json
import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

ADMIN_API_BASE = "https://lanuscomputacion.com/api/admin"


def publish_product(product: dict, d1_token: str = None) -> dict:
    """
    Publish a single product to D1 via admin API.
    Returns the API response.
    """
    try:
        resp = httpx.post(
            f"{ADMIN_API_BASE}/products",
            json=product,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {d1_token}" if d1_token else "",
            },
            timeout=30,
        )
        return resp.json()
    except Exception as e:
        logger.error(f"Publish failed: {e}")
        return {"error": str(e)}


def publish_via_wrangler(product: dict, db_binding: str = "lanus-catalog") -> bool:
    """
    Publish product directly via wrangler d1 execute.
    Used for batch operations.
    """
    import subprocess
    import tempfile
    import os

    # Build UPSERT SQL
    columns = [
        'id', 'external_id', 'title', 'slug', 'description', 'category_id',
        'category_name', 'subcategory_name', 'status', 'price', 'cost_price',
        'original_price', 'currency', 'dollar_rate', 'iva_pct', 'markup_pct',
        'brand', 'sku', 'ean', 'provider', 'provider_store', 'condition',
        'available_qty', 'sold_qty', 'rating', 'reviews_count', 'permalink',
        'thumbnail', 'free_shipping', 'listing_type', 'condition'
    ]

    values = []
    binds = []
    for col in columns:
        val = product.get(col)
        if val is not None:
            values.append(col)
            binds.append('?')

    if not values:
        return False

    sql = f"""
        INSERT INTO products ({', '.join(values)})
        VALUES ({', '.join(binds)})
        ON CONFLICT(id) DO UPDATE SET
        {', '.join(f'{col} = excluded.{col}' for col in values if col != 'id')}
    """

    # Create temp SQL file
    with tempfile.NamedTemporaryFile(mode='w', suffix='.sql', delete=False) as f:
        f.write(sql + ';\n')
        sql_file = f.name

    try:
        result = subprocess.run(
            ['npx', 'wrangler', 'd1', 'execute', db_binding,
             '--remote', '--file', sql_file],
            capture_output=True, text=True, cwd=os.path.dirname(os.path.dirname(__file__))
        )
        return result.returncode == 0
    except Exception as e:
        logger.error(f"Wrangler publish failed: {e}")
        return False
    finally:
        os.unlink(sql_file)


def batch_publish(products: list[dict], db_binding: str = "lanus-catalog") -> dict:
    """
    Batch publish multiple products via wrangler.
    Returns success/failure counts.
    """
    import subprocess
    import tempfile
    import os

    success = 0
    failed = 0
    errors = []

    # Build batch SQL
    sqls = []
    for product in products:
        columns = [
            'id', 'external_id', 'title', 'slug', 'description', 'category_id',
            'category_name', 'subcategory_name', 'status', 'price', 'cost_price',
            'original_price', 'currency', 'dollar_rate', 'iva_pct', 'markup_pct',
            'brand', 'sku', 'ean', 'provider', 'provider_store', 'condition',
            'available_qty', 'sold_qty', 'rating', 'reviews_count', 'permalink',
            'thumbnail', 'free_shipping', 'listing_type'
        ]

        values = []
        binds = []
        for col in columns:
            val = product.get(col)
            if val is not None:
                values.append(col)
                binds.append('?')

        if not values:
            failed += 1
            errors.append(f"Empty product: {product.get('title', 'unknown')}")
            continue

        sql = f"""
            INSERT INTO products ({', '.join(values)})
            VALUES ({', '.join(binds)})
            ON CONFLICT(id) DO UPDATE SET
            {', '.join(f'{col} = excluded.{col}' for col in values if col != 'id')}
        """
        sqls.append(sql)

    if not sqls:
        return {"success": 0, "failed": failed, "errors": errors}

    # Write all SQL to a temp file
    batch_sql = ';\n'.join(sqls) + ';\n'
    with tempfile.NamedTemporaryFile(mode='w', suffix='.sql', delete=False) as f:
        f.write(batch_sql)
        sql_file = f.name

    try:
        result = subprocess.run(
            ['npx', 'wrangler', 'd1', 'execute', db_binding,
             '--remote', '--file', sql_file],
            capture_output=True, text=True, cwd=os.path.dirname(os.path.dirname(__file__))
        )
        if result.returncode == 0:
            success = len(sqls)
        else:
            failed = len(sqls)
            errors.append(result.stderr[:500])
    except Exception as e:
        failed = len(sqls)
        errors.append(str(e))
    finally:
        os.unlink(sql_file)

    return {"success": success, "failed": failed, "errors": errors}
