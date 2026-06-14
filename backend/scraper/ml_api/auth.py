"""
MercadoLibre OAuth token management.
Register your app at https://developers.mercadolibre.com/ to get CLIENT_ID and CLIENT_SECRET.
"""

import time
import json
import requests
from pathlib import Path
from datetime import datetime


TOKEN_FILE = Path(__file__).resolve().parent.parent.parent.parent / "data" / "ml_token.json"


class MLAuth:
    """
    Manages OAuth tokens for the MercadoLibre API.
    Supports authorization_code flow (with refresh) and
    can also work with a manually provided access_token.
    """

    def __init__(self, client_id: str = "", client_secret: str = "", redirect_uri: str = ""):
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri or "https://localhost:8000/auth/callback"
        self.token_data = self._load_token()

    def has_token(self) -> bool:
        return bool(self.token_data and self.token_data.get("access_token"))

    def is_expired(self) -> bool:
        if not self.token_data:
            return True
        expires_at = self.token_data.get("expires_at", 0)
        return time.time() >= expires_at - 60

    def get_access_token(self) -> str:
        if not self.has_token():
            raise Exception(
                "No access token available. Register an app at https://developers.mercadolibre.com/\n"
                "and set CLIENT_ID and CLIENT_SECRET in your environment, then run:\n"
                "  python main.py auth"
            )
        if self.is_expired():
            self._refresh_token()
        return self.token_data["access_token"]

    def get_authorization_url(self) -> str:
        return (
            f"https://auth.mercadolibre.com.ar/authorization"
            f"?response_type=code"
            f"&client_id={self.client_id}"
            f"&redirect_uri={self.redirect_uri}"
        )

    def exchange_code(self, authorization_code: str):
        """Exchange authorization code for tokens."""
        resp = requests.post(
            "https://api.mercadolibre.com/oauth/token",
            data={
                "grant_type": "authorization_code",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "code": authorization_code,
                "redirect_uri": self.redirect_uri,
            },
            timeout=30,
        )
        resp.raise_for_status()
        self.token_data = resp.json()
        self.token_data["expires_at"] = time.time() + self.token_data.get("expires_in", 21600)
        self._save_token()
        return self.token_data

    def set_token_direct(self, access_token: str, refresh_token: str = "", expires_in: int = 21600):
        """Set a token directly (useful for testing with a manually obtained token)."""
        self.token_data = {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_in": expires_in,
            "expires_at": time.time() + expires_in - 60,
        }
        self._save_token()

    def _refresh_token(self):
        if not self.token_data.get("refresh_token"):
            raise Exception("No refresh token available. Re-authenticate.")
        resp = requests.post(
            "https://api.mercadolibre.com/oauth/token",
            data={
                "grant_type": "refresh_token",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "refresh_token": self.token_data["refresh_token"],
            },
            timeout=30,
        )
        resp.raise_for_status()
        self.token_data = resp.json()
        self.token_data["expires_at"] = time.time() + self.token_data.get("expires_in", 21600)
        self._save_token()

    def _save_token(self):
        TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(TOKEN_FILE, "w") as f:
            json.dump(self.token_data, f, indent=2)

    def _load_token(self) -> dict:
        if TOKEN_FILE.exists():
            try:
                with open(TOKEN_FILE) as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                pass
        return {}

    @staticmethod
    def print_instructions():
        print("=" * 60)
        print("MERCADOLIBRE API - SETUP INSTRUCTIONS")
        print("=" * 60)
        print()
        print("1. Go to https://developers.mercadolibre.com/")
        print("2. Create an application or use your existing one")
        print("3. Note your CLIENT_ID and CLIENT_SECRET")
        print("4. Set environment variables:")
        print("   set ML_CLIENT_ID=your_client_id")
        print("   set ML_CLIENT_SECRET=your_client_secret")
        print()
        print("5. Run:  python main.py auth")
        print("6. Follow the URL, authorize, paste the code back")
        print()
        print("The token will be saved to:", TOKEN_FILE)
        print("=" * 60)
