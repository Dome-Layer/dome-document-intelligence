"""House style: no em or en dashes in the backend source.

Prompts steer the model, and validation flags, rule descriptions and the
governance summary are read by users, so none of them may contain the em
dash (U+2014) or the en dash (U+2013). Extracted values are deliberately not
rewritten: they must stay faithful to the source document.
"""

from __future__ import annotations

from pathlib import Path

from app.api.rules import _row_to_rule
from app.services.validation import RULES_DEFINITIONS

EM = "\N{EM DASH}"
EN = "\N{EN DASH}"

BACKEND = Path(__file__).resolve().parents[1]
SCANNED_FILES = [
    *sorted((BACKEND / "app").rglob("*.py")),
    *sorted((BACKEND / "eval").glob("*.py")),
]


def test_no_dashes_in_backend_source() -> None:
    offenders = [
        f"{path.relative_to(BACKEND)}:{number}"
        for path in SCANNED_FILES
        for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1)
        if EM in line or EN in line
    ]
    assert not offenders, "Em or en dash found (house style):\n" + "\n".join(offenders)


def test_stored_rule_description_is_replaced_by_current_wording() -> None:
    definition = RULES_DEFINITIONS[0]
    stale_row = {
        "id": "row-1",
        "rule_id": definition["rule_id"],
        "name": definition["name"],
        "description": f"Old wording {EM} seeded before the house style",
        "severity": definition["severity"],
        "enabled": True,
        "config": {},
    }
    assert _row_to_rule(stale_row).description == definition["description"]


def test_unknown_rule_keeps_its_stored_description() -> None:
    row = {
        "id": "row-2",
        "rule_id": "R-CUSTOM",
        "name": "Custom",
        "description": "Kept",
        "severity": "info",
        "enabled": False,
        "config": None,
    }
    assert _row_to_rule(row).description == "Kept"
