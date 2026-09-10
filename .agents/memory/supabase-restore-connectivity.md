---
name: Supabase restore connectivity
description: Connection choice for direct PostgreSQL maintenance from this Replit environment.
---

Use Supabase's Session Pooler PostgreSQL URI for database restore and maintenance commands when the direct database hostname resolves only over IPv6.

**Why:** This Replit environment could not reach the new Supabase project's IPv6-only direct database endpoint, while the IPv4 Session Pooler accepted `psql` and completed the restore.

**How to apply:** For future `psql`, `pg_dump`, or restore work, start with the Session Pooler URI from Supabase's Connect panel. Keep the URI in Replit Secrets and never write it into project files or logs.