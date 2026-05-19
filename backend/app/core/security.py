import base64
import hashlib
import os
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from itsdangerous import BadSignature, URLSafeTimedSerializer

from app.core.config import get_settings

settings = get_settings()

_ph = PasswordHasher()
_serializer = URLSafeTimedSerializer(settings.session_secret, salt="session")
# 32-byte AES key derived from APP_SECRET_KEY.
_aes_key = hashlib.sha256(settings.app_secret_key.encode()).digest()

SESSION_MAX_AGE = 60 * 60 * 12  # 12 hours


# --- passwords ---
def hash_password(raw: str) -> str:
    return _ph.hash(raw)


def verify_password(raw: str, hashed: str) -> bool:
    try:
        return _ph.verify(hashed, raw)
    except VerifyMismatchError:
        return False


# --- sessions (signed cookie) ---
def make_session(user_id: str) -> tuple[str, str]:
    """Return (cookie_value, csrf_token). CSRF token is embedded + signed."""
    csrf = secrets.token_urlsafe(32)
    return _serializer.dumps({"uid": user_id, "csrf": csrf}), csrf


def read_session(cookie: str | None) -> dict | None:
    if not cookie:
        return None
    try:
        return _serializer.loads(cookie, max_age=SESSION_MAX_AGE)
    except BadSignature:
        return None


# --- secret encryption at rest (AES-GCM) ---
def encrypt_secret(plaintext: str) -> str:
    nonce = os.urandom(12)
    ct = AESGCM(_aes_key).encrypt(nonce, plaintext.encode(), None)
    return base64.b64encode(nonce + ct).decode()


def decrypt_secret(token: str) -> str:
    raw = base64.b64decode(token)
    return AESGCM(_aes_key).decrypt(raw[:12], raw[12:], None).decode()
