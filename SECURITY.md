# Security Policy

## Reporting a vulnerability

Please report security vulnerabilities to **security@domelayer.com** rather than opening a public issue.

Include: description, steps to reproduce, potential impact, and any suggested remediation.

**Response timeline:**
- Acknowledgment: within 48 hours
- Critical (CVSS 9.0+): remediation target 30 days
- High (CVSS 7.0–8.9): remediation target 60 days
- Medium / Low: case-by-case

Please keep findings confidential until a fix is published.

## Contact

- Security: security@domelayer.com
- Privacy: privacy@domelayer.com
- General: hello@domelayer.com

## Secrets handling

This repo follows the Dome portfolio standard:

- Real secrets live in Railway environment variables, never in the repo.
- `.env.example` is committed; any `.env*` file with real values is local-only and gitignored.
- Secrets are rotated when there is any suspicion of exposure, on contractor offboarding, and at least annually.

### Secrets inventory

| Variable | Where used | Sensitivity |
|---|---|---|
| `ANTHROPIC_API_KEY` | Backend Claude provider (text + vision) | **Secret — high impact** |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend DB writes (bypasses RLS) | **Secret — critical impact** |
| `SUPABASE_ANON_KEY` | Frontend client-side auth | Public — RLS-enforced |
| `SUPABASE_URL` | Backend + frontend | Public |
| `CORS_ORIGINS`, `ENVIRONMENT`, `MAX_FILE_SIZE_MB` | Backend config | Public (config, not secrets) |
| `AZURE_OPENAI_KEY`, `AZURE_OPENAI_ENDPOINT` | Backend (stub provider) | Secret when populated; not used today |
| `OLLAMA_URL` | Backend (stub provider) | Public; not used today |

### Rotation log

| Date | Reason | Notes |
|------|--------|-------|
| 2026-04 | Pre-publication audit — repo made public | Maintainer to populate without naming key values |
