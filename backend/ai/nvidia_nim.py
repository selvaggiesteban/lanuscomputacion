import os
import requests
import json
from typing import List, Dict

class NvidiaNimClient:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.environ.get("NVIDIA_API_KEY")
        self.base_url = "https://integrate.api.nvidia.com/v1/chat/completions"
        self.model = "deepseek-ai/deepseek-v4.1-flash" # Adjusted to the requested model

    def generate_social_content(self, product_title: str, product_description: str) -> List[Dict]:
        """
        Generates social media content ideas for a product.
        """
        prompt = (
            f"You are a social media expert for an electronics store called 'Lanús Computación'. "
            f"Create 3 engaging social media content ideas (Instagram post, Story, and X/Twitter) "
            f"for the following product:\n\n"
            f"Product: {product_title}\n"
            f"Description: {product_description}\n\n"
            f"For each idea, provide:\n"
            f"- Format (Post, Story, Tweet)\n"
            f"- Hook/Headline\n"
            f"- Main body text\n"
            f"- Suggested hashtags\n"
            f"- Visual suggestion\n\n"
            f"Return the response as a JSON list of objects."
        )

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.7,
            "max_tokens": 1024,
            "response_format": {"type": "json_object"}
        }

        try:
            response = requests.post(self.base_url, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
            content = data['choices'][0]['message']['content']
            return json.loads(content)
        except Exception as e:
            print(f"Error calling NVIDIA NIM: {e}")
            return []

if __name__ == "__main__":
    # Simple test
    client = NvidiaNimClient()
    res = client.generate_social_content("Gaming Mouse", "High precision 16000 DPI mouse")
    print(res)
