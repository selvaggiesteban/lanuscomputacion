import requests
import logging
from backend.config.settings import NVIDIA_NIM_API_KEY, NVIDIA_NIM_MODEL, NVIDIA_NIM_BASE_URL

logger = logging.getLogger(__name__)

class AIClient:
    def __init__(self):
        self.api_key = NVIDIA_NIM_API_KEY
        self.model = NVIDIA_NIM_MODEL
        self.base_url = NVIDIA_NIM_BASE_URL
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

    def generate_social_posts(self, pending_orders_summary: str) -> str:
        """
        Generates social media post ideas based on pending orders.
        Returns content in Argentine Spanish.
        """
        prompt = (
            "Sos un experto en marketing digital para una tienda de computación en Argentina. "
            "Basado en la siguiente lista de pedidos pendientes, generá ideas de posts creativos "
            "y atractivos para Facebook, Instagram, LinkedIn y WhatsApp. "
            "Usá un tono cercano, profesional y adaptado al español rioplatense (usá el 'vos'). "
            "Enfocate en generar deseo, urgencia o resaltar la calidad de los productos. "
            "Cada post debe incluir sugerencias de hashtags y emojis.\n\n"
            f"Pedidos pendientes:\n{pending_orders_summary}\n\n"
            "Formato de respuesta:\n"
            "FB: [idea]\n"
            "IG: [idea]\n"
            "LinkedIn: [idea]\n"
            "WhatsApp: [idea]"
        )

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": "Sos un asistente de marketing experto en el mercado tecnológico argentino."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.7,
            "max_tokens": 1024
        }

        try:
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers=self.headers,
                json=payload,
                timeout=30
            )
            response.raise_for_status()
            result = response.json()
            return result["choices"][0]["message"]["content"]
        except Exception as e:
            logger.error(f"Error calling NVIDIA NIM API: {e}")
            return "No se pudieron generar ideas de posts en este momento."
