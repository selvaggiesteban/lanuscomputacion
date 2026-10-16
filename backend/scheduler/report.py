import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime

from backend.db.database import CatalogDB
from backend.api.ai_client import AIClient
from backend.config.settings import REPORT_RECIPIENT

logger = logging.getLogger(__name__)

def get_pending_orders_data():
    """
    Retrieves pending orders and joins with products to get details.
    """
    db = CatalogDB()
    # Status 'pending' as per schema.sql for orders
    query = """
        SELECT
            p.title as product,
            o.unit_price as price,
            o.customer_name as customer,
            o.customer_email as email,
            o.customer_phone as phone,
            o.status as status,
            o.created_at as date,
            o.address as shipping_address
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE o.status = 'pending'
        ORDER BY o.created_at ASC
    """
    try:
        rows = db.conn.execute(query).fetchall()
        return [dict(row) for row in rows]
    except Exception as e:
        logger.error(f"Error fetching pending orders: {e}")
        return []
    finally:
        db.close()

def generate_report_content(orders):
    """
    Formats the order list and gets AI-generated social media ideas.
    """
    if not orders:
        return "No hay pedidos pendientes en este momento.", ""

    # Order list for the email
    lines = ["Producto | Precio | Cliente | Contacto | Estado | Fecha | Dirección"]
    lines.append("-" * 100)
    for o in orders:
        contact = f"{o['email']}/{o['phone']}"
        line = f"{o['product']} | {o['price']} | {o['customer']} | {contact} | {o['status']} | {o['date']} | {o['shipping_address']}"
        lines.append(line)

    orders_text = "\n".join(lines)

    # AI generated content
    ai_client = AIClient()
    # Summary for AI
    summary = "\n".join([f"{o['product']} ({o['price']})" for o in orders])
    social_posts = ai_client.generate_social_posts(summary)

    return orders_text, social_posts

def send_report_email(orders_text, social_posts):
    """
    Sends the formatted report via email.
    """
    # In a real environment, these would be in settings.py/env vars
    # Using placeholders here since not provided in the prompt
    SMTP_SERVER = "smtp.gmail.com"
    SMTP_PORT = 587
    SMTP_USER = "reports@lanuscomputacion.com" # Placeholder
    SMTP_PASS = "app-password-here" # Placeholder

    msg = MIMEMultipart()
    msg["From"] = SMTP_USER
    msg["To"] = REPORT_RECIPIENT
    msg["Subject"] = f"Reporte de Pedidos Pendientes - {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}"

    body = f"Hola,\n\nAquí tenés el reporte de pedidos pendientes:\n\n{orders_text}\n\n"
    body += "--- Ideas de Redes Sociales (AI) ---\n\n"
    body += f"{social_posts}\n\n"
    body += "Saludos."

    msg.attach(MIMEText(body, "plain"))

    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
        logger.info("Report email sent successfully.")
    except Exception as e:
        logger.error(f"Failed to send report email: {e}")

def run_automated_report():
    """
    Main entry point for the scheduler to trigger the report.
    """
    logger.info("Triggering automated report...")
    orders = get_pending_orders_data()
    orders_text, social_posts = generate_report_content(orders)
    send_report_email(orders_text, social_posts)
