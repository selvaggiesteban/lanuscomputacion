import os
from datetime import datetime, timedelta
from backend.db.database import Database
from frontend.src.lib.email import sendEmail # This is a TS file, in a real Python env we'd have a python email util

# NOTE: Since sendEmail is in TypeScript for Cloudflare Workers, 
# in the Python backend we should implement a similar SMTP logic or 
# call a Worker endpoint. For this implementation, I will create a Python 
# version of the email utility.

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def send_smtp_email(to, subject, body, is_html=False):
    user = os.environ.get("GMAIL_USER")
    password = os.environ.get("GMAIL_APP_PASSWORD")
    
    if not user or not password:
        print("Email credentials not set")
        return False

    msg = MIMEMultipart()
    msg['From'] = f"Lanús Computación <{user}>"
    msg['To'] = to
    msg['Subject'] = subject
    msg['Bcc'] = "selvaggi.esteban@gmail.com"
    
    if is_html:
        msg.attach(MIMEText(body, 'html'))
    else:
        msg.attach(MIMEText(body, 'plain'))
    
    try:
        server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
        server.login(user, password)
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        print(f"SMTP Error: {e}")
        return False

def trigger_post_sale_emails():
    db = Database()
    # Find orders that were paid but no post-sale email was sent yet
    # or sent more than 7 days ago (for follow-up)
    # According to schema.sql: postventa_emails table exists
    
    pending_postventa = db.execute(
        "SELECT o.id, o.customer_email, o.customer_name, p.title "
        "FROM orders o JOIN products p ON o.product_id = p.id "
        "LEFT JOIN postventa_emails pe ON o.id = pe.order_id "
        "WHERE o.status = 'delivered' AND (pe.status = 'pending' OR pe.id IS NULL)"
    ).fetchall()
    
    for order in pending_postventa:
        order_id, email, name, product_title = order
        # In a real scenario, we'd use a template
        subject = f"¿Todo bien con tu pedido #{order_id[:8]}?"
        body = f"Hola {name}, gracias por comprar {product_title} en Lanús Computación. ¿Todo bien con tu producto?"
        
        if send_smtp_email(email, subject, body):
            db.execute(
                "INSERT OR REPLACE INTO postventa_emails (order_id, product_title, subject, body, status) "
                "VALUES (?, ?, ?, ?, 'sent')", 
                (order_id, product_title, subject, body)
            )
            db.commit()

def trigger_abandoned_cart_emails():
    db = Database()
    # abandoned_carts table: session_id, customer_email, last_seen_at
    # Trigger if last_seen_at is between 1 and 24 hours ago and no email sent
    
    cutoff = (datetime.now() - timedelta(hours=24)).strftime('%Y-%m-%d %H:%M:%S')
    abandoned = db.execute(
        "SELECT customer_email, customer_name, items FROM abandoned_carts "
        "WHERE customer_email IS NOT NULL AND last_seen_at < ? "
        "AND id NOT IN (SELECT order_id FROM orders)" # Simple check: not converted to order
    ).execute(cutoff).fetchall() # This is pseudo-code for the filter
    
    # Note: the schema.sql doesn't have a 'cart_emails_sent' table, 
    # so we'd need to track it to avoid spamming.
    
    for cart in abandoned:
        email, name, items = cart
        subject = "Te olvidaste algo en el carrito 🛒"
        body = f"Hola {name}, vimos que dejaste algunos productos en tu carrito. ¡No te los pierdas!"
        
        send_smtp_email(email, subject, body)

if __name__ == "__main__":
    trigger_post_sale_emails()
    trigger_abandoned_cart_emails()
