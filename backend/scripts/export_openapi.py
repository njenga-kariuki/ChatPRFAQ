"""Write the OpenAPI document so the frontend can generate types from it.

    python scripts/export_openapi.py ../web/openapi.json
"""

from __future__ import annotations

import os as _os
import sys as _sys

_sys.path.insert(0, _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))))

import json
import sys

from app.main import create_app
from app.settings import Settings

out = sys.argv[1] if len(sys.argv) > 1 else "openapi.json"
app = create_app(Settings(llm_provider="fake", _env_file=None))
with open(out, "w", encoding="utf-8") as f:
    json.dump(app.openapi(), f, indent=2)
print(f"wrote {out}")
