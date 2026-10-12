"""Authentication middleware.

api_key_auth.py and session_auth.py stay separate. Do not merge them into one middleware with a
flag - the separation is what keeps the future mTLS migration small (D-04).
"""
