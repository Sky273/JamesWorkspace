# Memory Wiki Agent Guide

- Treat generated blocks as plugin-owned.
- Preserve human notes outside managed markers.
- Prefer source-backed claims over wiki-to-wiki citation loops.
- Prefer structured `claims` with evidence over burying key beliefs only in prose.
- Use `.openclaw-wiki/cache/agent-digest.json` and `claims.jsonl` for machine reads; markdown pages are the human view.

## Working model for this vault

This vault follows the LLM-wiki pattern:

1. `wiki-raw/` holds raw source material and local snapshots of web sources.
2. `wiki/` holds the maintained knowledge layer.
3. This file is the schema/workflow contract for future sessions.

## Default workflow

When asked to add knowledge:

1. Capture the source in `wiki-raw/` if it is external or unstable.
2. Run `openclaw wiki ingest <path>` on the raw source.
3. Run `openclaw wiki compile`.
4. Run `openclaw wiki lint` after meaningful updates.
5. Prefer updating existing pages over creating near-duplicates.

## Content conventions

- `sources/` = one page per source document.
- `entities/` = people, products, orgs, repos, important artifacts.
- `concepts/` = recurring ideas, patterns, architectures, principles.
- `syntheses/` = durable answers, comparisons, plans, decisions worth keeping.
- `reports/` = generated maintenance and health outputs.

## Query discipline

- Search the wiki first when the question is about accumulated knowledge.
- File back durable outputs when a query produces a useful synthesis.
- Flag contradictions or stale claims rather than silently blending them.
