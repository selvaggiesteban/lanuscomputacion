"""
Publisher: pushes normalized product data to D1 via wrangler.
"""
import json
import logging
import subprocess
import tempfile
import os
from typing import Optional

logger = logging.getLogger(__name__)

# Columns to publish (order matters for SQL)
PUBLISH_COLUMNS = [
    'id', 'external_id', 'title', 'slug', 'description', 'category_id',
    'category_name', 'subcategory_name', 'status', 'price', 'cost_price',
    'original_price', 'currency', 'dollar_rate', 'iva_pct', 'markup_pct',
    'brand', 'sku', 'ean', 'provider', 'provider_store', 'condition',
    'available_qty', 'sold_qty', 'rating', 'reviews_count', 'permalink',
    'thumbnail', 'images', 'free_shipping', 'listing_type',
]


def publish_via_wrangler(product: dict, db_binding: str = "lanus-catalog") -> bool:
    """
    Publish a single product to D1 via wrangler.
    Returns True on success.
    """
    # Filter to only columns that exist and have values
    values = []
    binds = []
    for col in PUBLISH_COLUMNS:
        val = product.get(col)
        if val is not None:
            values.append(col)
            binds.append('?')

    if not values:
        logger.warning("No values to publish")
        return False

    sql = f"""
        INSERT INTO products ({', '.join(values)})
        VALUES ({', '.join(binds)})
        ON CONFLICT(id) DO UPDATE SET
        {', '.join(f'{col} = excluded.{col}' for col in values if col != 'id')}
    """

    # Create temp SQL file
    with tempfile.NamedTemporaryFile(mode='w', suffix='.sql', delete=False) as f:
        # Write values as parameters
        param_values = []
        for col in values:
            val = product.get(col)
            if val is None:
                param_values.append('NULL')
            elif isinstance(val, str):
                # Escape single quotes for SQL
                escaped = val.replace("'", "''")
                param_values.append(f"'{escaped}'")
            elif isinstance(val, (int, float)):
                param_values.append(str(val))
            elif isinstance(val, bool):
                param_values.append('1' if val else '0')
            else:
                param_values.append(f"'{str(val)}'")

        # Build actual SQL with values (not parameterized, since wrangler --file expects it)
        actual_sql = f"""
            INSERT INTO products ({', '.join(values)})
            VALUES ({', '.join(param_values)})
            ON CONFLICT(id) DO UPDATE SET
            {', '.join(f'{col} = excluded.{col}' for col in values if col != 'id')};
        """
        f.write(actual_sql)
        sql_file = f.name

    try:
        # Use npx.cmd on Windows
        npx_cmd = 'npx.cmd' if os.name == 'nt' else 'npx'
        result = subprocess.run(
            [npx_cmd, 'wrangler', 'd1', 'execute', db_binding,
             '--remote', '--file', sql_file],
            capture_output=True, text=True, encoding='utf-8',
            cwd=os.path.join(os.path.dirname(__file__), '..', '..', '..')
        )
        if result.returncode == 0:
            return True
        else:
            logger.error(f"Wrangler failed: {result.stderr[:300]}")
            return False
    except Exception as e:
        logger.error(f"Wrangler error: {e}")
        return False
    finally:
        os.unlink(sql_file)


def batch_publish(products: list[dict], db_binding: str = "lanus-catalog") -> dict:
    """
    Batch publish multiple products via wrangler.
    Returns success/failure counts.
    """
    if not products:
        return {"success": 0, "failed": 0, "errors": []}

    success = 0
    failed = 0
    errors = []

    # Build batch SQL
    sqls = []
    for product in products:
        values = []
        param_values = []
        for col in PUBLISH_COLUMNS:
            val = product.get(col)
            if val is not None:
                values.append(col)
                if val is None:
                    param_values.append('NULL')
                elif isinstance(val, str):
                    escaped = val.replace("'", "''")
                    param_values.append(f"'{escaped}'")
                elif isinstance(val, (int, float)):
                    param_values.append(str(val))
                elif isinstance(val, bool):
                    param_values.append('1' if val else '0')
                else:
                    param_values.append(f"'{str(val)}'")

        if not values:
            failed += 1
            errors.append(f"Empty product: {product.get('title', 'unknown')}")
            continue

        sql = f"""
            INSERT INTO products ({', '.join(values)})
            VALUES ({', '.join(param_values)})
            ON CONFLICT(id) DO UPDATE SET
            {', '.join(f'{col} = excluded.{col}' for col in values if col != 'id')};
        """
        sqls.append(sql)

    if not sqls:
        return {"success": 0, "failed": failed, "errors": errors}

    # Write all SQL to a temp file
    batch_sql = '\n'.join(sqls)
    with tempfile.NamedTemporaryFile(mode='w', suffix='.sql', delete=False) as f:
        f.write(batch_sql)
        sql_file = f.name

    try:
        npx_cmd = 'npx.cmd' if os.name == 'nt' else 'npx'
        result = subprocess.run(
            [npx_cmd, 'wrangler', 'd1', 'execute', db_binding,
             '--remote', '--file', sql_file],
            capture_output=True, text=True, encoding='utf-8',
            cwd=os.path.join(os.path.dirname(__file__), '..', '..', '..')
        )
        if result.returncode == 0:
            success = len(sqls)
            logger.info(f"Batch published {success} products")
        else:
            failed = len(sqls)
            errors.append(result.stderr[:500])
            logger.error(f"Batch publish failed: {result.stderr[:300]}")
    except Exception as e:
        failed = len(sqls)
        errors.append(str(e))
        logger.error(f"Batch publish error: {e}")
    finally:
        os.unlink(sql_file)

    return {"success": success, "failed": failed, "errors": errors}
