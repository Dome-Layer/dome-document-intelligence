# P3 Local Air-Gapped Deployment Notes

Executing `dome-docs/architecture/DOME_CONTEXT.md`'s "Deployment Maturity → first target:
local air-gapped deployment of P3 Document Intelligence" sequence (steps 2–6). Internal,
not for the public repo (gitignored, same as `TOOL_CONTEXT.md`).

## 1. Setup summary

- **Hardware:** MacBook Pro, Apple M5 Pro, 48GB unified memory.
- **Runtime:** Ollama 0.32.3, installed natively via Homebrew (`arm64_tahoe` bottle),
  running with Apple's MLX backend (100% GPU, confirmed via `ollama ps`).
- **Model:** `qwen3-vl:8b` (8.8B params, Q4_K_M quantization, Apache 2.0), ~6.1GB on disk,
  ~8GB resident when loaded — comfortable on 48GB, no memory pressure at any point.
- **Harness:** the existing DA-006 eval harness (`backend/eval/`), unmodified scoring
  pipeline, run against the same 16-document golden set used for the Claude baseline.
- **Date:** 2026-07-23/24.

## 2. Quality — full 16-doc comparison vs. the Claude baseline

| Metric | Claude (`claude-sonnet-4-6`) | Local (`qwen3-vl:8b`) | Δ |
| --- | ---: | ---: | ---: |
| Field F1 (micro) | 84.5% | 71.7% | **−12.8pp** |
| Field precision (micro) | 91.6% | 90.4% | −1.2pp |
| Field recall (micro) | 78.4% | 59.5% | **−18.9pp** |
| Value-match rate | 91.6% | 90.4% | −1.2pp |
| Reference-key accuracy | 75.0% | **0.0%** | **−75pp** |
| Doc-type accuracy | 75.0% | 75.0% | even |
| HITL agreement (end-to-end) | 87.5% | 50.0% | **−37.5pp** |
| Calibration ECE | 0.072 (95 fields) | 0.085 (73 fields) | slightly worse |
| Judge↔truth agreement | 100% / 40 fields | 100% / 40 fields | even (judge unaffected) |
| Over-extracted fields | 214 | 112 | fewer, but see §4 |

Both runs used the identical judge (`claude-haiku-4-5`, independent of the generator), so
the judge stayed a fixed, trustworthy reference point across both comparisons.

**The headline number that matters most for go/no-go: 4 of 16 documents (25%) returned
zero extracted fields** — `cv_resume_001`, `lab_report_001`, `receipt_image_001`,
`trade_confirmation_001` all scored 0/0 P/R/F1. This isn't "extracted some fields
incorrectly" — the model produced either an empty `fields` array or a malformed one that
failed to parse at all. Claude had zero such total failures on the same set (its worst doc,
`prescription_001`, still got 44.4% F1). Value-match rate looks deceptively close (90.4%
vs 91.6%) only because it's computed over fields that *did* get extracted — it says
nothing about the 25% that produced nothing.

**Reference-key accuracy at 0.0%** is the second most important gap. On every single
document, the model failed to correctly populate `reference_keys` (invoice numbers, PO
numbers, IBANs, etc.) — see §4 for the specific confusion pattern behind this.

## 3. Latency

All 16 documents make **2 model round-trips each** (type-detection pass + field-extraction
pass) — 32 total Ollama calls for the full run.

| | seconds |
| --- | ---: |
| Mean per document (both passes) | 337.5s (~5.6 min) |
| Min | 155.2s (`invoice_image_001`) |
| Max | 549.0s (`invoice_001`, ~9.1 min) |
| Total model time, 16 docs | ~90 min |

For comparison, Claude's round-trips are ~1–3s each — this is roughly **100–200x slower**
per document, even with full GPU/MLX acceleration on capable hardware. The image documents
were not slower than text on average (`invoice_image_001` was in fact the fastest run of
the entire set), so vision overhead specifically isn't the bottleneck — see §4.

## 4. Prompt-engineering observations

- **`qwen3-vl:8b` is a "thinking" model** — every response includes a private reasoning
  trace before the final answer. This is almost certainly the dominant latency driver, not
  vision processing or raw decode speed. Ollama's `think: false` request flag did **not**
  suppress it for this model build (tested directly against the API — thinking output was
  present either way).
- **The Claude-authored JSON-schema-hint prompting pattern mostly works, but breaks down
  on the `reference_keys` sub-schema specifically.** The extraction prompt includes an
  example-shaped hint:
  ```json
  "reference_keys": {
    "description": "structured identifiers e.g. invoice_number, po_number, ...",
    "example": {"invoice_number": "INV-2024-001", "patient_id": "PT-98765"}
  }
  ```
  On `receipt_image_001`'s first attempt, the model echoed this `description`/`example`
  shape almost verbatim as if it *were* the whole answer — dropping the required top-level
  `fields`/`overall_confidence` keys entirely and truncating mid-object, which crashed the
  parser (`Expecting ',' delimiter`). This is very likely the same underlying confusion
  responsible for the 0.0% reference-key accuracy across all 16 docs: the model seems to
  treat the schema's illustrative example as something to imitate structurally rather than
  as formatting guidance. **This is a real, addressable prompt-engineering finding** —
  Claude never had this problem with the identical prompt, so the fix is local-model-specific
  prompting (e.g., stripping or reformatting the `example` sub-object, or moving reference-key
  extraction to its own simpler pass) rather than a change needed to the shared prompts.
- **The failures were stochastic, not deterministic.** Re-running the exact same
  `receipt_image_001` request a second time (temperature=1, per `ollama show`) produced
  valid — if empty — JSON instead of crashing. A production integration would need
  retry-with-reprompt logic for this model, which the current `OllamaProvider` deliberately
  doesn't have (see the code comment on why retries were skipped for this experiment).
- **`trade_confirmation_001` hit a different failure shape**: the model returned a `fields`
  array containing a raw integer instead of an object (`'int' object has no attribute
  'get'`), also resulting in 0 usable fields.
- **Confidence calibration skews high but isn't as pathological as it first looked.** An
  early single-doc smoke test showed literally every field at confidence 1.00; across the
  full 16-doc set the picture is more nuanced (ECE 0.085 vs Claude's 0.072 — worse, but not
  wildly so) — all 73 successfully-scored fields still landed in the 0.90–1.00 confidence
  band with no representation in lower bands at all, unlike a well-calibrated model that
  would naturally have some low-confidence fields when it's genuinely unsure. In other
  words: the model doesn't use its confidence score to signal *uncertainty* the way Claude
  does — it just isn't well calibrated for this task, and its "confidence" isn't yet a
  fully reliable HITL-routing signal (which is likely a major contributor to the 50% HITL
  agreement gap in §2 alongside the 4 total failures).

## 5. Failure modes encountered (infrastructure, not model quality)

Worth documenting since a real client air-gapped deployment would hit the same class of
issues on unfamiliar hardware:

- **This Mac's Homebrew was the Intel/Rosetta build** (`/usr/local`, no `/opt/homebrew`),
  so the first Ollama install ran entirely on CPU with zero GPU access (~1.7 tok/s).
  Fixed by installing native Ollama directly, then later properly via a fresh native
  arm64 Homebrew at `/opt/homebrew` (which pulled in Apple's `mlx-c` as a dependency —
  the Homebrew-native bottle uses MLX, not just plain Metal).
- **macOS TCC revoked Files-and-Folders access to `~/Documents` mid-session** (a known,
  recurring issue on this machine per earlier session notes), independently of the
  Homebrew work, requiring an app restart to clear.
- **The old Homebrew removal wiped the entire `/usr/local` tree**, including this repo's
  Python venv (`.venv.nosync` symlinked to a since-deleted `/usr/local/opt/python@3.12`)
  and the manually-installed native Ollama binary. The venv had to be rebuilt from
  `requirements.txt` against the new native `python@3.12` — as a side effect, this repo's
  dev tooling is now also off Rosetta for the first time.
- **The `ollama serve` process kept running orphaned for ~4.5 hours** through all of the
  above (Unix keeps a running process's files open even after they're deleted from disk),
  which is why the experiment could resume mid-stream without re-pulling the 6.1GB model —
  but its long uptime through heavy system disruption (Homebrew reinstall, TCC resets) is
  the most likely explanation for the one Ollama-side `500 Internal Server Error` hit on a
  vision call; a fresh daemon restart made it disappear immediately.

None of this reflects on `qwen3-vl:8b` itself — it's a snapshot of what a real from-scratch
setup on unfamiliar hardware looks like, which is exactly the kind of thing worth knowing
before promising a client a smooth air-gapped install.

## 6. Go/no-go recommendation

**Not yet viable for a prospect-facing air-gapped demo of P3 as-is.** The 25% total-failure
rate and 0% reference-key accuracy are disqualifying on their own — a demo that silently
returns nothing for 1 in 4 documents undermines the "governance and reliability" pitch DOME
is built on, independent of the F1 gap. Latency (5–9 minutes per document) is also too slow
for a live demo, though tolerable for an async/batch use case.

What would need to change before revisiting:
1. **Prompt fix first** — address the `reference_keys` schema-imitation bug (§4); this
   alone might materially move both the reference-key and the total-failure numbers, since
   at least 2 of the 4 zero-field docs failed via JSON-shape confusion, not genuine
   extraction inability.
2. **Add retry-with-reprompt** to `OllamaProvider` for this model specifically, since
   failures were shown to be stochastic, not deterministic.
3. **Re-run this same harness** after each change — it's the direct, apples-to-apples way
   to know if a fix actually worked.
4. Only after quality is closer to parity does latency become the next thing to solve
   (larger context caching, disabling thinking if a future Ollama/model update supports it
   reliably, or accepting async/batch as the target UX for air-gapped rather than live demo).

## 7. Next steps

- ~~Try the prompt fix in §4 and re-run just the 4 failing docs to see if it moves the
  needle before committing to a full re-run.~~ **Done — see §8.**
- Per `DOME_CONTEXT.md`'s stated sequence ("Azure deployment follows local, not the
  reverse"), Azure OpenAI deployment should wait until local quality is closer to parity —
  no reason to move to the next deployment mode while the local baseline itself needs work.
- Given the 48GB headroom, worth trying a stronger local model (`qwen3-vl:30b`/`32b`, ~20GB)
  as a follow-on comparison — the 8B ceiling may be part of the quality gap, separate from
  the prompting issue.
- New from §8: investigate the **valid-but-empty-JSON** failure mode (3 docs, distinct from
  the schema-imitation crash) — retry-on-parse-failure doesn't catch it since the JSON
  parses fine, it's just `{"fields": [], ...}`. Worth a stronger system-prompt instruction
  against returning an empty extraction, or a "did you actually look at the document"
  self-check, before the next re-run.

## 8. Fix applied and re-eval (2026-07-24)

Implemented both remediations proposed in §6 on `feat/p3-local-ollama-provider`:

1. **`reference_keys` schema-imitation fix** (`backend/app/services/extraction.py`) — the
   `_EXTRACTION_SCHEMA["reference_keys"]` hint was the only schema leaf holding a
   fully-formed nested JSON example (`{"description": ..., "example": {...}}`); every other
   leaf in the schema is a plain description string. Replaced it with a plain string that
   folds the same example values into prose, removing the one answer-shaped fragment a
   confused model could echo back verbatim as if it were the whole response. Also hardened
   `_build_extraction_result` with an `isinstance(dict)` guard on the raw `reference_keys`
   value before iterating it.
2. **Retry-with-reprompt** (`backend/app/providers/ollama.py`) — `OllamaProvider._chat()`
   now retries the same request up to 2 extra times when `json_mode=True` and the response
   fails to parse as JSON, before giving up and returning the last attempt (the caller's own
   parse then raises as before). Kept local to `OllamaProvider`, not generalized into
   `dome_core` (DA-004 stays deferred). `generate()` (non-JSON mode) is unaffected.

**Claude regression check:** offline `eval --no-judge` against the committed recordings
(no network call, exercises the same `_build_extraction_result` code path) — reference-key
accuracy held at **75.0%**, unchanged. Confirmed no regression before running the live
Ollama eval.

**Live Ollama re-eval** (`qwen3-vl:8b`, full 16-doc set, `--refresh`):

| Metric | Before (07-23) | After (07-24) | Claude baseline |
| --- | ---: | ---: | ---: |
| Field F1 (micro) | 71.7% | 71.0% | 84.5% |
| Field precision (micro) | 90.4% | 90.3% | 91.6% |
| Field recall (micro) | 59.5% | 58.6% | 78.4% |
| Value-match rate | 90.4% | 90.3% | 91.6% |
| **Reference-key accuracy** | **0.0%** | **60.0%** | 75.0% |
| Doc-type accuracy | 75.0% | 62.5% | 75.0% |
| HITL agreement (end-to-end) | 50.0% | 62.5% | 87.5% |
| Calibration ECE | 0.085 (73 fields) | 0.095 (72 fields) | 0.072 (95 fields) |
| **Zero-extraction docs** | **4/16 (25%)** | **3/16 (18.75%)** | 0/16 |

**Reference-key accuracy is fixed**: 0.0% → 60.0%, the headline target of this session.
More importantly, **all 4 of the original zero-extraction docs now extract successfully** —
`cv_resume_001` (50% F1), `lab_report_001` (71.4% F1), `receipt_image_001` (75% F1),
`trade_confirmation_001` (100% F1) — confirming the schema-imitation crash really was the
dominant driver behind those failures, exactly as hypothesized in §4/§6.

However, **3 different documents failed in this run**: `delivery_note_001`, `invoice_002`,
`purchase_order_001`, all returning `{"fields": [], "overall_confidence": 0.5,
"reference_keys": {}}` — syntactically **valid** JSON with an empty extraction, not a parse
crash. This is a distinct failure mode the retry logic doesn't catch (it only retries on
parse failure) and confirms the earlier finding that failures are stochastic per-document,
not deterministic — the total zero-extraction rate improved (25% → 18.75%) but didn't
disappear, it just moved to different documents on this run. Doc-type accuracy and HITL
agreement moved in different directions (−12.5pp and +12.5pp respectively) but neither is
mechanically related to this fix — most likely run-to-run model variance given `qwen3-vl:8b`
is being sampled at temperature=1, not a consequence of the prompt or retry change.

Latency was materially higher this run (mean 321s/doc vs. 337.5s before, comparable; max
509s on `invoice_002` — one of the empty-response docs, so no retry overhead was actually
paid there). One judge-side transient DNS error (`eval_judgment_failed`) was logged during
the run but didn't affect the generator-side numbers — judge↔truth agreement stayed
100%/40, unaffected.

**Revised go/no-go:** still **not yet viable for a prospect-facing demo**, but meaningfully
closer. The specific bug this session targeted is confirmed fixed — reference-key accuracy
and the original 4 crash-driven failures are resolved. The remaining blocker is the new
empty-but-valid-JSON failure mode (§7) at ~19% of documents, which is a different root
cause and needs its own investigation before the total-failure rate is credible for a demo.
Recordings/reports were reverted to the committed Claude baseline after capturing these
numbers — this repo's `eval/recordings/` and `eval/reports/` still reflect Claude only.

## 9. Second fix and final re-eval (2026-07-24, recorded 2026-09-10)

§8 stops at the intermediate run. A second fix landed in the same session and changed the
outcome materially, but the session was interrupted before this was written up.

**The remaining failure mode from §8** was empty-but-valid JSON (`{"fields": [], ...}`), which
the JSON-parse retry could not catch because nothing failed to parse. Two changes addressed it:

1. **`_NO_EMPTY_GUIDANCE`** (`backend/app/services/extraction.py`) tells the model that an empty
   fields array is almost never correct, and that a low-confidence best guess beats an omission.
   Added to both the text and vision prompts.
2. **Empty-response retry** (`backend/app/providers/ollama.py`) reprompts up to twice when every
   schema-declared list key comes back empty. Distinct from the existing parse retry.

**Result (`qwen3-vl:8b`, full 16-doc set):**

| Metric | 07-23 | 07-24 §8 | **07-24 final** | Claude baseline |
| --- | ---: | ---: | ---: | ---: |
| Field F1 (micro) | 71.7% | 71.0% | **80.0%** | 84.5% |
| Field precision (micro) | 90.4% | 90.3% | **92.9%** | 91.6% |
| Field recall (micro) | 59.5% | 58.6% | **70.3%** | 78.4% |
| Value-match rate | 90.4% | 90.3% | **92.9%** | 91.6% |
| Reference-key accuracy | 0.0% | 60.0% | **80.0%** | 75.0% |
| Doc-type accuracy | 75.0% | 62.5% | **75.0%** | 75.0% |
| HITL agreement | 50.0% | 62.5% | **75.0%** | 87.5% |
| Calibration ECE | 0.085 | 0.095 | **0.052** | 0.072 |
| **Zero-extraction docs** | 4/16 | 3/16 | **0/16** | 0/16 |

**The zero-extraction failure mode is closed.** All 16 documents extract.

**Notable:** the retry code never fired during this run. The entire improvement came from the
`_NO_EMPTY_GUIDANCE` prompt addition. The retry stays as a defensive net given the documented
stochasticity, but it is currently dormant, so it is untested in anger.

**Where the local model now stands vs Claude:** better on precision, value-match, reference-key
accuracy and calibration; worse on recall (70.3% vs 78.4%) and HITL agreement. The single
remaining gap is recall. The model is more conservative: it extracts fewer fields but is more
accurate and better calibrated on the ones it does extract, which is a defensible trade for an
air-gapped deployment and worth stating plainly to a client rather than hiding.

**Open questions before this is demo-credible:**
- Recall is the whole remaining gap. Worth one focused pass, the way `reference_keys` was.
- Doc-type accuracy sits at 75% for both local and cloud, so that is a harness or taxonomy
  issue, not a model issue. Separate investigation.
- Temperature is 1 and results move run to run. Any headline number should be a median of
  several runs, not a single sample.

### Correction to the end of §8

§8 closes by saying recordings and reports "still reflect Claude only". **That is no longer
true.** On 2026-09-10 the interrupted revert was never completed, and the regenerated
qwen3-vl recordings plus `eval_report.{json,md}` were committed to
`feat/p3-local-ollama-provider` as `eval(p3-local): record qwen3-vl:8b run ...`.

Consequences to remember:
- On that branch, `eval/recordings/` and `eval/reports/` are **local-model** artifacts.
- `main` and `staging` are untouched and still hold the Claude baseline.
- **Do not merge that branch without re-baselining or splitting local and cloud fixtures**,
  or CI will begin gating against local-model recordings.
- The `extraction.py` prompt addition is shared with the cloud provider, so merging also
  changes Claude's behaviour and invalidates the current cloud baseline.
