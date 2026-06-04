"""CLI entry point: ``python -m eval`` (see ``make eval`` / ``make eval-score``)."""

from __future__ import annotations

import argparse
import asyncio
from pathlib import Path

from . import loader
from .run import DEFAULT_JUDGE_SAMPLE, run_eval
from .types import EvalReport


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(prog="python -m eval", description="DocI evaluation harness")
    p.add_argument(
        "--refresh",
        action="store_true",
        help="re-run the generator over the golden set and rewrite recordings (live)",
    )
    p.add_argument(
        "--no-judge",
        action="store_true",
        help="skip the LLM judge (fully offline when combined with no --refresh)",
    )
    p.add_argument(
        "--report-dir",
        type=Path,
        default=loader.REPORTS_DIR,
        help=f"output directory for eval_report.{{json,md}} (default: {loader.REPORTS_DIR})",
    )
    p.add_argument(
        "--judge-sample",
        type=int,
        default=DEFAULT_JUDGE_SAMPLE,
        help="max objective fields used to validate the judge (default: %(default)s)",
    )
    return p.parse_args(argv)


def _print_summary(report: EvalReport) -> None:
    agg = report.aggregate
    print("\n=== DocI evaluation summary ===")
    print(f"docs={report.n_docs}  generator={report.generator_model}  judge={report.judge_model}")
    print(
        f"field F1 (micro)={agg.micro_f1:.3f}  value-match={agg.value_match_rate:.3f}  "
        f"doc-type acc={agg.doc_type_accuracy:.3f}  HITL agreement={agg.hitl_agreement:.3f}"
    )
    print(f"calibration ECE={report.calibration.ece:.3f} over {report.calibration.n} fields")
    if report.judge_validation is not None:
        jv = report.judge_validation
        print(
            f"judge↔truth agreement={jv.agreement_rate:.3f} on {jv.n_objective} fields "
            f"({'trustworthy' if jv.trustworthy else 'below threshold'}); "
            f"fuzzy resolved={jv.n_fuzzy_judged}"
        )


def main(argv: list[str] | None = None) -> None:
    args = _parse_args(argv)
    report = asyncio.run(
        run_eval(
            use_judge=not args.no_judge,
            refresh=args.refresh,
            report_dir=args.report_dir,
            judge_sample=args.judge_sample,
        )
    )
    _print_summary(report)
    print(
        f"\nwrote {args.report_dir / 'eval_report.json'} and {args.report_dir / 'eval_report.md'}"
    )


if __name__ == "__main__":
    main()
