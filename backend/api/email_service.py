import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Any, Dict
import logging

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self, smtp_server: str = "smtp.gmail.com", smtp_port: int = 587):
        self.smtp_server = smtp_server
        self.smtp_port = smtp_port
        # In a real production environment, these should be in settings.py / environment variables
        self.sender_email = "wwwlanuscomputacion@gmail.com"
        self.sender_password = None # Should be loaded from env: os.getenv("EMAIL_PASSWORD")

    def send_email(self, recipient_email: str, subject: str, html_content: str):
        """
        Sends an HTML email.
        """
        if not self.sender_password:
            logger.error("Email sender password not configured. Email not sent.")
            # For development purposes, we log instead of crashing,
            # but in production this should raise an exception or be handled by config.
            return False

        try:
            msg = MIMEMultipart()
            msg['From'] = self.sender_email
            msg['To'] = recipient_email
            msg['Subject'] = subject

            msg.attach(MIMEText(html_content, 'html'))

            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.sender_email, self.sender_password)
                server.send_message(msg)

            logger.info(f"Email sent successfully to {recipient_email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email to {recipient_email}: {str(e)}")
            return False

    def send_post_purchase_email(self, customer_email: str, order_details: Dict[str, Any]):
        """
        Triggered by postventa_emails logic.
        """
        subject = "¡Gracias por tu compra en Lanus Computación!"

        # Basic template replacement
        try:
            with open("backend/api/templates/post_purchase.html", "r", encoding="utf-8") as f:
                html_content = f.read()

            html_content = html_content.replace("{{ customer_name }}", order_details.get('customer_name', 'Cliente'))
            html_content = html_content.replace("{{ order_id }}", str(order_details.get('order_id', 'N/A')))
        except Exception as e:
            logger.error(f"Error loading post-purchase template: {e}")
            html_content = f"<h1>Hola {order_details.get('customer_name', 'Cliente')}</h1><p>Tu pedido {order_details.get('order_id', 'N/A')} está siendo procesado.</p>"

        return self.send_email(customer_email, subject, html_content)

    def send_abandoned_cart_email(self, customer_email: str, cart_details: Dict[str, Any]):
        """
        Triggered by abandoned_carts logic.
        """
        subject = "Olvidaste algo en tu carrito 🛒"

        # Basic template replacement
        try:
            with open("backend/api/templates/abandoned_cart.html", "r", encoding="utf-8") as f:
                html_content = f.read()

            html_content = html_content.replace("{{ customer_name }}", cart_details.get('customer_name', 'Cliente'))
            html_content = html_content.replace("{{ cart_url }}", cart_details.get('cart_url', 'https://lanuscomputacion.com/carrito'))
        except Exception as e:
            logger.error(f"Error loading abandoned cart template: {e}")
            html_content = f"<h1>Hola {cart_details.get('customer_name', 'Cliente')}</h1><p>Vimos que dejaste productos en tu carrito.</p>"

        return self.send_email(customer_email, subject, html_content)

email_service = EmailService()
