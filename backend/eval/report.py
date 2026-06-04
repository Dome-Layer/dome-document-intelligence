"""Assemble and render the evaluation report (JSON + Markdown).

The JSON is the machine artifact (and what CI-style invariant checks read back);
the Markdown is the human/pitch artifact embedded in ``EVAL.md``.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from .types import (
    AggregateScore,
    CalibrationReport,
    DocScore,
    EvalReport,
    JudgeValidation,
)


def build_report(
    *,
    generator_model: str,
    judge_model: Optional[str],
    scores: list[DocScore],
    aggregate: AggregateScore,
    calibration: CalibrationReport,
    judge_validation: Optional[JudgeValidation],
) -> EvalReport:
    return EvalReport(
        generated_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        generator_model=generator_model,
        judge_model=judge_model,
        n_docs=len(scores),
        aggregate=aggregate,
        calibration=calibration,
        judge_validation=judge_validation,
        per_doc=scores,
    )


def _pct(x: float) -> str:
    return f"{x * 100:.1f}%"


def render_markdown(report: EvalReport) -> str:
    agg = report.aggregate
    lines: list[str] = []
    lines.append("# Document Intelligence — Evaluation Report")
    lines.append("")
    lines.append(f"- **Generated:** {report.generated_at}")
    lines.append(f"- **Generator model:** `{report.generator_model}`")
    if report.judge_model:
        lines.append(f"- **Judge model:** `{report.judge_model}`")
    lines.append(
        f"- **Documents scored:** {report.n_docs}  ·  expected fields: {agg.n_expected_fields}"
    )
    lines.append("")

    lines.append("## Extraction quality (Layer 1b)")
    lines.append("")
    lines.append("| Metric | Value |")
    lines.append("| --- | --- |")
    lines.append(f"| Field precision (micro) | {_pct(agg.micro_precision)} |")
    lines.append(f"| Field recall (micro) | {_pct(agg.micro_recall)} |")
    lines.append(f"| Field F1 (micro) | {_pct(agg.micro_f1)} |")
    lines.append(f"| Field F1 (macro) | {_pct(agg.macro_f1)} |")
    lines.append(f"| Value-match rate | {_pct(agg.value_match_rate)} |")
    lines.append(f"| Reference-key accuracy | {_pct(agg.reference_keys_accuracy)} |")
    lines.append(f"| Doc-type accuracy | {_pct(agg.doc_type_accuracy)} |")
    lines.append(f"| Human-in-loop agreement (end-to-end) | {_pct(agg.hitl_agreement)} |")
    lines.append(f"| Over-extracted fields (reported, not penalized) | {agg.extra_field_count} |")
    lines.append("")
    lines.append(
        "> Scored against a **curated key-field set**: P/R/F1 and value-match cover the labeled key "
        "fields (TP = correct value, FP = wrong value, FN = missing/wrong). Predicted fields beyond "
        "that set are counted as **over-extraction** — not penalized as false positives (unverifiable "
        "without exhaustive labels) and excluded from calibration."
    )
    lines.append("")

    cal = report.calibration
    lines.append("## Confidence calibration (Layer 2)")
    lines.append("")
    lines.append(
        f"Expected Calibration Error (**ECE**): **{cal.ece:.3f}** over {cal.n} fields "
        "(lower is better; 0 = perfectly calibrated)."
    )
    lines.append("")
    lines.append("| Confidence band | n | Mean confidence | Actual accuracy | Gap |")
    lines.append("| --- | ---: | ---: | ---: | ---: |")
    for b in cal.buckets:
        if b.n == 0:
            lines.append(f"| {b.band} | 0 | — | — | — |")
        else:
            lines.append(
                f"| {b.band} | {b.n} | {_pct(b.mean_confidence)} | {_pct(b.accuracy)} | {b.gap:.3f} |"
            )
    lines.append("")
    lines.append(
        "> Calibration is reported honestly: a large gap in any band means the model's stated "
        "confidence does not match its real accuracy there — itself a finding worth surfacing."
    )
    lines.append("")

    if report.judge_validation is not None:
        jv = report.judge_validation
        verdict = "trustworthy" if jv.trustworthy else "NOT yet trustworthy"
        lines.append("## Validated LLM judge (Layer 3)")
        lines.append("")
        lines.append(
            f"Before trusting the judge for fuzzy fields, it was checked against ground truth on "
            f"**{jv.n_objective}** objective fields: **{jv.n_agree}** agreed "
            f"(**{_pct(jv.agreement_rate)}** agreement, threshold {_pct(jv.threshold)}) → "
            f"**{verdict}**."
        )
        lines.append("")
        lines.append(
            f"It then resolved **{jv.n_fuzzy_judged}** fuzzy semantic-equivalence fields. "
            f"Judge model `{jv.judge_model}` is distinct from the generator "
            f"`{report.generator_model}`. Each run logs one `eval_judgment` governance event."
        )
        lines.append("")

    lines.append("## Per-document detail")
    lines.append("")
    lines.append("| Doc | Modality | Doc-type ✓ | P | R | F1 | Value-match | HITL exp→pred ✓ |")
    lines.append("| --- | --- | :---: | ---: | ---: | ---: | ---: | --- |")
    for s in report.per_doc:
        dt = "✓" if s.doc_type_correct else "✗"
        hitl = f"{s.hitl_expected}→{s.hitl_predicted} {'✓' if s.hitl_correct else '✗'}"
        lines.append(
            f"| {s.doc_id} | {s.modality} | {dt} | {_pct(s.precision)} | {_pct(s.recall)} | "
            f"{_pct(s.f1)} | {s.value_matches}/{s.value_total} | {hitl} |"
        )
    lines.append("")
    lines.append(
        "_Methodology: see `EVAL.md`. Regenerate with `make eval` (live model); "
        "`make eval-score` recomputes from committed recordings without a network call._"
    )
    lines.append("")
    return "\n".join(lines)


def write_report(report: EvalReport, out_dir: Path) -> tuple[Path, Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    json_path = out_dir / "eval_report.json"
    md_path = out_dir / "eval_report.md"
    json_path.write_text(json.dumps(report.model_dump(), indent=2, ensure_ascii=False) + "\n")
    md_path.write_text(render_markdown(report))
    return (json_path, md_path)
