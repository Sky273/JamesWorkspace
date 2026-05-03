---
pageType: source
id: source.karpathy-llm-wiki
title: Karpathy - llm-wiki
sourceType: local-file
sourcePath: /data/.openclaw/workspace/wiki-raw/karpathy-llm-wiki.md
ingestedAt: 2026-04-27T22:24:11.701Z
updatedAt: 2026-04-27T22:24:11.701Z
status: active
---

# Karpathy - llm-wiki

## Source
- Type: `local-file`
- Path: `/data/.openclaw/workspace/wiki-raw/karpathy-llm-wiki.md`
- Bytes: 1892
- Updated: 2026-04-27T22:24:11.701Z

## Content
```text
# llm-wiki

Source: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
Fetched: 2026-04-28
Author: Andrej Karpathy

## Summary

This note captures Karpathy's pattern for a persistent LLM-maintained wiki. The key idea is to keep three layers:

1. Raw sources: immutable source-of-truth documents.
2. The wiki: LLM-maintained, interlinked markdown pages.
3. The schema: instructions that tell the agent how to ingest, update, query, and lint the wiki.

The wiki should be a compounding artifact rather than a pure RAG system that re-discovers knowledge from raw files on every question. New sources are integrated into existing pages, contradictions are flagged, and synthesis accumulates over time.

## Key ideas

- The LLM maintains the wiki; the human curates sources and steers the analysis.
- Ingest should update summaries, relevant entity pages, concept pages, indexes, and the activity log.
- Queries can produce durable outputs that should themselves be filed back into the wiki.
- Periodic linting should catch contradictions, stale claims, orphan pages, missing cross-links, and open questions.
- `index.md` is the content-oriented map.
- `log.md` is the chronological history of work done.
- Obsidian is a natural frontend for browsing and graphing the vault.

## Practical implications for this workspace

- Keep raw files outside the generated wiki pages.
- Prefer source-backed claims over chat-memory assertions.
- Treat wiki maintenance as a first-class workflow: ingest, compile, query, lint.
- Let the schema evolve with the domain instead of freezing it too early.

## Excerpt notes

- The wiki sits between raw sources and answers.
- Cross-references and synthesis should accumulate instead of being re-derived every time.
- Good answers are assets and can be written back into the wiki.
- Small search/index tooling becomes more useful as the corpus grows.

```

## Notes
<!-- openclaw:human:start -->
<!-- openclaw:human:end -->

## Related
<!-- openclaw:wiki:related:start -->
### Referenced By

- [[syntheses/llm-wiki-operating-model|LLM wiki operating model]]
<!-- openclaw:wiki:related:end -->
