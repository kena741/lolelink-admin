Use this folder for timestamped SQL migrations.

Conventions:
- Additive changes only by default (safe rollout).
- One concern per migration file.
- Prefer `IF EXISTS` and `IF NOT EXISTS` for defensive deploys.
