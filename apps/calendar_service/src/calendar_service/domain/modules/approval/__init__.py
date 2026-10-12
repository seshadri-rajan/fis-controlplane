"""Four-eyes approval (maker-checker).

A change is held as a pending request and applied only when a different user approves it.
See RECORD.md section 11. This module exists from the first migration even though the approval UI
comes later - retrofitting it later means rewriting every mutation path.
"""
