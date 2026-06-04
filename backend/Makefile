# DocI backend convenience targets — run from backend/.
# Override the interpreter with: make eval PY=python
PY ?= ./.venv/bin/python

.PHONY: help eval eval-score test lint format

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  %-12s %s\n", $$1, $$2}'

eval: ## Live: re-run model + validated judge, write eval_report.{json,md} + one audit row
	$(PY) -m eval --refresh

eval-score: ## Offline: score committed recordings (no judge, no network)
	$(PY) -m eval --no-judge

test: ## Run the test suite
	$(PY) -m pytest

lint: ## ruff check + ruff format --check
	$(PY) -m ruff check . && $(PY) -m ruff format --check .

format: ## Apply ruff formatting
	$(PY) -m ruff format .
