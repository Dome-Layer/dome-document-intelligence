"""Auditable evaluation harness for Dome Document Intelligence (DA-006).

Four layers:
- Layer 1a (`tests/test_validation_rules.py`): deterministic tests of the 16-rule
  ValidationService — the "rules engine decides" half.
- Layer 1b (`scorer`, `normalize`): score LLM extraction against a golden set with
  type-aware normalization — field P/R/F1, value-match, reference-key / doc-type
  accuracy, human-in-loop agreement.
- Layer 2 (`calibration`): bucket field confidences and measure actual accuracy per
  bucket — a reliability table + ECE that verifies the extraction prompt's own
  calibration claim.
- Layer 3 (`judge`): a *validated* LLM judge (measured against ground truth before
  it is trusted) for fuzzy semantic value-equivalence; each run logs one
  `eval_judgment` governance event.

Honesty boundary: importing any module here has **no side effects** (no provider,
no DB, no network). CI runs the deterministic math against committed recordings;
only `python -m eval` / `make eval` calls a live model.
"""

__all__ = ["__version__"]

__version__ = "0.1.0"
