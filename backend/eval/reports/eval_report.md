# Document Intelligence — Evaluation Report

- **Generated:** 2026-07-24T14:26:02+00:00
- **Generator model:** `qwen3-vl:8b`
- **Judge model:** `claude-haiku-4-5`
- **Documents scored:** 16  ·  expected fields: 111

## Extraction quality (Layer 1b)

| Metric | Value |
| --- | --- |
| Field precision (micro) | 92.9% |
| Field recall (micro) | 70.3% |
| Field F1 (micro) | 80.0% |
| Field F1 (macro) | 78.3% |
| Value-match rate | 92.9% |
| Reference-key accuracy | 80.0% |
| Doc-type accuracy | 75.0% |
| Human-in-loop agreement (end-to-end) | 75.0% |
| Over-extracted fields (reported, not penalized) | 150 |

> Scored against a **curated key-field set**: P/R/F1 and value-match cover the labeled key fields (TP = correct value, FP = wrong value, FN = missing/wrong). Predicted fields beyond that set are counted as **over-extraction** — not penalized as false positives (unverifiable without exhaustive labels) and excluded from calibration.

## Confidence calibration (Layer 2)

Expected Calibration Error (**ECE**): **0.052** over 84 fields (lower is better; 0 = perfectly calibrated).

| Confidence band | n | Mean confidence | Actual accuracy | Gap |
| --- | ---: | ---: | ---: | ---: |
| 0.90-1.00 | 84 | 98.1% | 92.9% | 0.052 |
| 0.70-0.89 | 0 | — | — | — |
| 0.50-0.69 | 0 | — | — | — |
| 0.30-0.49 | 0 | — | — | — |
| 0.00-0.29 | 0 | — | — | — |

> Calibration is reported honestly: a large gap in any band means the model's stated confidence does not match its real accuracy there — itself a finding worth surfacing.

## Validated LLM judge (Layer 3)

Before trusting the judge for fuzzy fields, it was checked against ground truth on **40** objective fields: **40** agreed (**100.0%** agreement, threshold 90.0%) → **trustworthy**.

It then resolved **18** fuzzy semantic-equivalence fields. Judge model `claude-haiku-4-5` is distinct from the generator `qwen3-vl:8b`. Each run logs one `eval_judgment` governance event.

## Per-document detail

| Doc | Modality | Doc-type ✓ | P | R | F1 | Value-match | HITL exp→pred ✓ |
| --- | --- | :---: | ---: | ---: | ---: | ---: | --- |
| bank_statement_001 | text | ✓ | 100.0% | 100.0% | 100.0% | 6/6 | not_required→recommended ✗ |
| contract_001 | text | ✓ | 75.0% | 42.9% | 54.5% | 3/4 | recommended→recommended ✓ |
| cv_resume_001 | text | ✓ | 50.0% | 28.6% | 36.4% | 2/4 | recommended→recommended ✓ |
| delivery_note_001 | text | ✗ | 100.0% | 71.4% | 83.3% | 5/5 | not_required→required ✗ |
| insurance_policy_001 | text | ✗ | 100.0% | 100.0% | 100.0% | 7/7 | recommended→recommended ✓ |
| invoice_001 | text | ✓ | 100.0% | 62.5% | 76.9% | 5/5 | recommended→recommended ✓ |
| invoice_002 | text | ✓ | 100.0% | 42.9% | 60.0% | 3/3 | recommended→recommended ✓ |
| invoice_image_001 | image | ✓ | 100.0% | 100.0% | 100.0% | 6/6 | recommended→not_required ✗ |
| lab_report_001 | text | ✓ | 100.0% | 55.6% | 71.4% | 5/5 | not_required→not_required ✓ |
| letter_of_credit_001 | text | ✓ | 100.0% | 100.0% | 100.0% | 7/7 | recommended→recommended ✓ |
| payslip_001 | text | ✗ | 85.7% | 85.7% | 85.7% | 6/7 | not_required→not_required ✓ |
| prescription_001 | text | ✓ | 50.0% | 28.6% | 36.4% | 2/4 | not_required→not_required ✓ |
| purchase_order_001 | text | ✓ | 100.0% | 57.1% | 72.7% | 4/4 | not_required→not_required ✓ |
| receipt_image_001 | image | ✗ | 100.0% | 60.0% | 75.0% | 3/3 | recommended→recommended ✓ |
| trade_confirmation_001 | text | ✓ | 100.0% | 100.0% | 100.0% | 8/8 | recommended→recommended ✓ |
| utility_bill_001 | text | ✓ | 100.0% | 100.0% | 100.0% | 6/6 | recommended→not_required ✗ |

_Methodology: see `EVAL.md`. Regenerate with `make eval` (live model); `make eval-score` recomputes from committed recordings without a network call._
