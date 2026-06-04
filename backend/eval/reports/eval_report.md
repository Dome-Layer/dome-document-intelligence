# Document Intelligence — Evaluation Report

- **Generated:** 2026-06-04T05:00:47+00:00
- **Generator model:** `claude-sonnet-4-6`
- **Judge model:** `claude-haiku-4-5-20251001`
- **Documents scored:** 16  ·  expected fields: 111

## Extraction quality (Layer 1b)

| Metric | Value |
| --- | --- |
| Field precision (micro) | 91.6% |
| Field recall (micro) | 78.4% |
| Field F1 (micro) | 84.5% |
| Field F1 (macro) | 84.1% |
| Value-match rate | 91.6% |
| Reference-key accuracy | 75.0% |
| Doc-type accuracy | 75.0% |
| Human-in-loop agreement (end-to-end) | 87.5% |
| Over-extracted fields (reported, not penalized) | 214 |

> Scored against a **curated key-field set**: P/R/F1 and value-match cover the labeled key fields (TP = correct value, FP = wrong value, FN = missing/wrong). Predicted fields beyond that set are counted as **over-extraction** — not penalized as false positives (unverifiable without exhaustive labels) and excluded from calibration.

## Confidence calibration (Layer 2)

Expected Calibration Error (**ECE**): **0.072** over 95 fields (lower is better; 0 = perfectly calibrated).

| Confidence band | n | Mean confidence | Actual accuracy | Gap |
| --- | ---: | ---: | ---: | ---: |
| 0.90-1.00 | 95 | 98.8% | 91.6% | 0.072 |
| 0.70-0.89 | 0 | — | — | — |
| 0.50-0.69 | 0 | — | — | — |
| 0.30-0.49 | 0 | — | — | — |
| 0.00-0.29 | 0 | — | — | — |

> Calibration is reported honestly: a large gap in any band means the model's stated confidence does not match its real accuracy there — itself a finding worth surfacing.

## Validated LLM judge (Layer 3)

Before trusting the judge for fuzzy fields, it was checked against ground truth on **40** objective fields: **40** agreed (**100.0%** agreement, threshold 90.0%) → **trustworthy**.

It then resolved **22** fuzzy semantic-equivalence fields. Judge model `claude-haiku-4-5-20251001` is distinct from the generator `claude-sonnet-4-6`. Each run logs one `eval_judgment` governance event.

## Per-document detail

| Doc | Modality | Doc-type ✓ | P | R | F1 | Value-match | HITL exp→pred ✓ |
| --- | --- | :---: | ---: | ---: | ---: | ---: | --- |
| bank_statement_001 | text | ✓ | 100.0% | 83.3% | 90.9% | 5/5 | not_required→not_required ✓ |
| contract_001 | text | ✓ | 66.7% | 57.1% | 61.5% | 4/6 | recommended→recommended ✓ |
| cv_resume_001 | text | ✓ | 66.7% | 57.1% | 61.5% | 4/6 | recommended→not_required ✗ |
| delivery_note_001 | text | ✗ | 85.7% | 85.7% | 85.7% | 6/7 | not_required→required ✗ |
| insurance_policy_001 | text | ✗ | 100.0% | 100.0% | 100.0% | 7/7 | recommended→recommended ✓ |
| invoice_001 | text | ✓ | 100.0% | 87.5% | 93.3% | 7/7 | recommended→recommended ✓ |
| invoice_002 | text | ✓ | 100.0% | 85.7% | 92.3% | 6/6 | recommended→recommended ✓ |
| invoice_image_001 | image | ✓ | 100.0% | 100.0% | 100.0% | 6/6 | recommended→recommended ✓ |
| lab_report_001 | text | ✓ | 83.3% | 55.6% | 66.7% | 5/6 | not_required→not_required ✓ |
| letter_of_credit_001 | text | ✓ | 100.0% | 100.0% | 100.0% | 7/7 | recommended→recommended ✓ |
| payslip_001 | text | ✗ | 85.7% | 85.7% | 85.7% | 6/7 | not_required→not_required ✓ |
| prescription_001 | text | ✓ | 100.0% | 28.6% | 44.4% | 2/2 | not_required→not_required ✓ |
| purchase_order_001 | text | ✓ | 100.0% | 85.7% | 92.3% | 6/6 | not_required→not_required ✓ |
| receipt_image_001 | image | ✗ | 100.0% | 100.0% | 100.0% | 5/5 | recommended→recommended ✓ |
| trade_confirmation_001 | text | ✓ | 85.7% | 75.0% | 80.0% | 6/7 | recommended→recommended ✓ |
| utility_bill_001 | text | ✓ | 100.0% | 83.3% | 90.9% | 5/5 | recommended→recommended ✓ |

_Methodology: see `EVAL.md`. Regenerate with `make eval` (live model); `make eval-score` recomputes from committed recordings without a network call._
