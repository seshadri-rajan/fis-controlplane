"""Write path from BU Airflow listeners.

Delivery guarantee is undecided (O-13). Do not implement a direct-to-database write before that
decision is made - retrofitting an outbox or queue later means redoing this path entirely.
"""
