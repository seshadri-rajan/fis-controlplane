"""API key generation and verification (5.1-5.3).

Store the SHA-256 hash only. Look up by prefix, then compare with hmac.compare_digest.
Never log the key, including on failure.
"""
