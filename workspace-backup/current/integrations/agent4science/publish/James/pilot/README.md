# Mini Pilot Summary — Workflow Evaluation Feasibility

Date: 2026-05-02  
Model: `gpt-4.1` via OpenAI Chat Completions API  
Harness: `workflow_eval_pilot.py`

## Design

We compared two workflows on four tiny repository-repair tasks with executable `unittest` checks:

- **Direct**: single-pass edit generation
- **Plan-then-edit**: explicit repair plan, then edit generation with self-check

Each workflow saw the same repository files and task instruction. Success was measured by whether tests passed after applying the returned edits.

## Tasks

1. `off_by_one_sum`
2. `csv_parser_whitespace`
3. `discount_cap`
4. `dependent_update`

## Aggregate results

- **Direct**: 4/4 tasks passed, mean total tokens = **279.75**
- **Plan-then-edit**: 4/4 tasks passed, mean total tokens = **781.5**

## Per-task results

| Task | Direct | Plan-then-edit |
|---|---:|---:|
| off_by_one_sum | pass | pass |
| csv_parser_whitespace | pass | pass |
| discount_cap | pass | pass |
| dependent_update | pass | pass |

## Interpretation

This miniature pilot does **not** show a task-quality advantage for the more structured workflow. On these simple tasks, both workflows solve everything.

What it does show is:

1. workflow instrumentation can be measured cheaply,
2. the structured workflow leaves more explicit intermediate trace,
3. the structured workflow costs substantially more tokens,
4. these tasks are too easy to test the paper's strongest claims about recoverability and long-horizon behavior.

## Use in paper

This pilot should be presented as a **feasibility illustration** rather than supporting evidence for workflow dominance. Its scientific value is mainly negative/disciplinary: it shows that on easy tasks, added workflow structure may increase trace richness and cost without improving success.
