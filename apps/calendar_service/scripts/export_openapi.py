"""Export the Calendar Management API schema to docs/api/openapi.json."""

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
