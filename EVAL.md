<!-- markdownlint-disable -->
# Evaluating Document Intelligence

Dome Document Intelligence (DocI) is built as **"the LLM informs, a rules engine decides."**
That architecture is what makes it *auditable* — but a claim of auditability is only worth
something if the quality of both halves is **measured**. This harness does that, in four layers,
and is honest about the boundary between what is *proven deterministically in CI* and what is
*measured live against a model*.

> TL;DR — `backend/eval/` holds the harness; `make eval` produces `eval_report.{json,md}`; CI runs
> the deterministic parts (16-rule tests + scorer/calibration math) against **recorded** model
> outputs and **never calls a live LLM**. A sample report is embedded at the bottom of this file.

---

## Why this exists

The predictable interview / client question is *"how do you know the model is any good — and how do
you trust an LLM to grade an LLM?"* The answer here is a layered eval where each layer earns trust
before the next relies on it:

1. The deterministic half (the **rules engine**) is tested exhaustively and for free.
2. The model's field extraction is scored against a **golden set** with type-aware comparison.
3. The model's **stated confidence** is checked against its **actual accuracy** (calibration).
4. An LLM judge is **validated against ground truth** before it is allowed to rule on fuzzy fields —
   and every judge run is itself written to the governance audit log.

---

## Layer 1a — Rules-engine tests (deterministic, CI-gated, free)

`backend/tests/test_validation_rules.py` drives crafted `ExtractionResult` fixtures through the real
`ValidationService` and asserts the exact flags (rule id + severity + field), `rules_triggered`, and
resulting `human_in_loop` for **all 16 governance rules** — plus boundary cases (confidence at the
0.40 / 0.60 / 0.70 thresholds, the `>= 100000` large-amount edge, future/past-date deltas), the
**historical-date** exemption (e.g. `date_of_birth`), the **non-commercial doc-type** exemption for
missing identifiers, severity→HITL mapping, and a clean document that trips nothing.

The 16-rule engine previously had **zero tests**; this is the highest-value, lowest-cost coverage in
the project and it gates every PR.

## Layer 1b — Extraction scorer vs a golden set

`backend/eval/scorer.py` aligns predicted fields to the ground-truth label by name (+ an alias map),
then compares values with **type-aware normalization** (`backend/eval/normalize.py`):

| data_type | normalization |
| --- | --- |
| `currency` | strip symbols/grouping, parse decimal (US `1,234.56` **and** EU `1.234,56`), compare numerically at cent precision |
| `date` | parse to ISO `YYYY-MM-DD` (incl. `15/01/2024`, `Jan 15, 2024`) and compare |
| `percentage` | strip `%`, compare numerically |
| `identifier` | upper-case, drop whitespace, keep separators |
| `text` | case/space-normalized equality |

Each label field carries a `match` mode: `exact` / `normalized` are decided here; `fuzzy` is **deferred
to the judge** (Layer 3). Reported per-doc and aggregate: field **precision / recall / F1**,
value-match rate, **reference-key accuracy**, **doc-type accuracy**, and **end-to-end human-in-loop
agreement** — predicted HITL is produced by running the *real* `ValidationService` over the
prediction, so this measures the whole pipeline, not just extraction.

The golden set labels a curated set of **key** fields per document (not every field), so a predicted
field with no labeled counterpart is reported as an **over-extraction** count rather than penalized as
a false positive (it can't be verified without exhaustive labels) and is excluded from scoring. P/R/F1
therefore cover the labeled key fields: TP = correct value, FP = wrong value, FN = missing or wrong.

## Layer 2 — Confidence calibration (the differentiator)

The extraction prompt ships an explicit confidence rubric (0.90–1.00 "explicit", … 0.00–0.29
"guess"). `backend/eval/calibration.py` **verifies that stated claim**: it buckets every predicted
field by the prompt's own bands, computes the *actual* accuracy per band, and reports a reliability
table plus **Expected Calibration Error (ECE)** = Σ (nₖ/N)·|confidenceₖ − accuracyₖ|. Only **labeled**
fields with known correctness are bucketed; over-extracted (unlabeled) fields and fields still
awaiting the judge are excluded. Miscalibration is **reported, not hidden** — a large gap is itself a
finding.

## Layer 3 — A *validated* LLM judge

`backend/eval/judge.py` uses a judge model **distinct from the generator** (`EVAL_JUDGE_MODEL`,
default Haiku-tier; the generator is Sonnet-tier). The honest protocol:

1. **Earn trust first.** Run the judge on *objective* fields where deterministic ground truth exists
   and report **judge↔truth agreement**. If it doesn't agree with the truth it can be checked
   against, it isn't trusted for the truth it can't.
2. **Then spend it.** Only after that, the judge resolves the *fuzzy* fields (semantic
   value-equivalence, e.g. `"$1,000"` ≡ `"1,000.00 USD"`; free-text completeness). It is
   **reference-anchored** (sees the expected value) and rubric-bound.
3. **Audit it.** Each live run logs exactly one `eval_judgment` governance event
   (`backend/eval/governance_log.py`, mirroring `app/services/governance.py`) — so model-quality
   checks join the same audit trail as production extractions and can later feed the P6 dashboard.

## The honesty boundary: CI vs live

- **CI gates the harness, not the model.** `pytest` runs Layer 1a + the scorer/calibration math
  against **committed recordings** (`backend/eval/recordings/*.json`, captured once) and crafted
  inputs. Deterministic, offline, free. Importing any `eval.*` module has no side effects. **CI never
  calls a live LLM.**
- **`make eval` measures the model.** It re-runs the generator on the golden set, refreshes the
  recordings, runs the validated judge, writes `eval_report.{json,md}`, and emits the one audit row.

## Golden set

`backend/eval/fixtures/` — ~16 **synthetic, sanitized** documents (no real PII) spanning the doc-type
taxonomy: invoice (USD + EU-format EUR), purchase order, utility bill, trade confirmation, letter of
credit, contract, lab report, prescription, bank statement, CV/résumé, insurance policy, delivery
note, payslip, plus **two images** (invoice + receipt) exercising the vision path. Each has a
ground-truth label (`fixtures/labels/<doc_id>.json`).

## Running it

```bash
cd backend
make eval         # live: re-run model + validated judge → eval_report.{json,md} + 1 audit row
make eval-score   # offline: score committed recordings, no judge, no network
make test         # the full deterministic suite (what CI runs)
```

`make eval` reads model + Supabase settings from the backend environment; point `SUPABASE_*` at the
environment whose audit log should receive the `eval_judgment` row. Override the judge with
`EVAL_JUDGE_MODEL`.

## Limitations (stated plainly)

- ~16 documents is enough to surface calibration and systematic extraction errors, not to produce
  tight confidence intervals. The harness scales to more docs by adding label+doc pairs.
- The judge is **scoped** to fuzzy value-equivalence and is only trusted to the extent its measured
  agreement with ground truth says it should be — it is not a general "LLM grades everything" oracle.
- HITL "agreement" compares the rules engine's verdict on the *actual* extraction to a human-set
  expectation; disagreements are reported, not suppressed.

---

## Sample report

_Below is the committed `backend/eval/reports/eval_report.md`, produced by a live `make eval` run over the synthetic golden set. Regenerate it with `make eval` (live) or recompute the deterministic parts with `make eval-score` (offline). The live judge run also writes one `eval_judgment` row to the configured governance log._

- **Generated:** 2026-06-04T05:00:47+00:00
- **Generator model:** `claude-sonnet-4-6`
- **Judge model:** `claude-haiku-4-5-20251001`
- **Documents scored:** 16  ·  expected fields: 111

### Extraction quality (Layer 1b)

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

### Confidence calibration (Layer 2)

Expected Calibration Error (**ECE**): **0.072** over 95 fields (lower is better; 0 = perfectly calibrated).

| Confidence band | n | Mean confidence | Actual accuracy | Gap |
| --- | ---: | ---: | ---: | ---: |
| 0.90-1.00 | 95 | 98.8% | 91.6% | 0.072 |
| 0.70-0.89 | 0 | — | — | — |
| 0.50-0.69 | 0 | — | — | — |
| 0.30-0.49 | 0 | — | — | — |
| 0.00-0.29 | 0 | — | — | — |

> Calibration is reported honestly: a large gap in any band means the model's stated confidence does not match its real accuracy there — itself a finding worth surfacing.

### Validated LLM judge (Layer 3)

Before trusting the judge for fuzzy fields, it was checked against ground truth on **40** objective fields: **40** agreed (**100.0%** agreement, threshold 90.0%) → **trustworthy**.

It then resolved **22** fuzzy semantic-equivalence fields. Judge model `claude-haiku-4-5-20251001` is distinct from the generator `claude-sonnet-4-6`. Each run logs one `eval_judgment` governance event.

### Per-document detail

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

