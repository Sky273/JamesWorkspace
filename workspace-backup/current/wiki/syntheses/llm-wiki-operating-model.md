---
pageType: synthesis
id: synthesis.llm-wiki-operating-model
title: LLM wiki operating model
sourceIds:
  - source.karpathy-llm-wiki
questions:
  - Which repo files should become the first durable source corpus?
confidence: 0.89
status: active
updatedAt: 2026-04-27T22:26:17.989Z
---

# LLM wiki operating model

## Notes
<!-- openclaw:human:start -->
<!-- openclaw:human:end -->

## Summary
<!-- openclaw:wiki:generated:start -->
This workspace now uses an LLM-wiki pattern rather than ad-hoc chat memory.

Key decisions:
- Raw external sources are snapshotted into `wiki-raw/` before ingest when useful.
- The maintained wiki lives in `wiki/` and is rendered in Obsidian-friendly markdown.
- `wiki/AGENTS.md` is the schema layer that defines ingest, compile, query, and lint workflow.
- Durable answers should be filed back into `wiki/syntheses/` instead of disappearing in chat history.

Operating loop:
1. Add or snapshot a source into `wiki-raw/`.
2. Ingest it with `openclaw wiki ingest`.
3. Rebuild indexes with `openclaw wiki compile`.
4. Run `openclaw wiki lint` after meaningful updates.

Initial anchor source:
- `source.karpathy-llm-wiki` captures the Karpathy gist that describes the pattern and rationale.

Current limitation:
- The vault is initialized and healthy, but still lightly populated. It needs more repo-specific source material before it becomes genuinely useful.
<!-- openclaw:wiki:generated:end -->

## Related
<!-- openclaw:wiki:related:start -->
### Sources

- [[sources/karpathy-llm-wiki|Karpathy - llm-wiki]]
<!-- openclaw:wiki:related:end -->
