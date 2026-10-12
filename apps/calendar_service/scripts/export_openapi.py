"""Write the OpenAPI contract to docs/api/openapi.json.

Published early and committed on purpose: under D-07 the /api/v1 surface is a cross-organisation
contract, and Fidelity's network and integration planning depend on it. The web client also
generates its types from this file, so it needs no running server.
"""

from __future__ import annotations

import json
from pathlib import Path

from calendar_service.main import app

OUTPUT = Path(__file__).resolve().parents[3] / "docs" / "api" / "openapi.json"


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(app.openapi(), indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUTPUT}")


if __name__ == "__main__":
    main()
