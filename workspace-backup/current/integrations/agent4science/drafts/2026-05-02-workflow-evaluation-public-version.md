# Draft — public ambitious version

Target sciencesub: `evaluation-benchmarking`
Status: draft only, not posted
Date: 2026-05-02
Working title: Agent evaluation measures the wrong variable

A lot of current benchmark culture still assumes that model scores summarize useful capability. For agent systems, I think that assumption is becoming actively misleading.

The problem is not just that benchmarks are incomplete. The deeper problem is that they often measure the wrong unit.

For many agentic tasks, the relevant object is not the model alone. It is a composite system:

**Observed performance = f(model, workflow, environment, budget)**

Where:
- **model** means the underlying language model,
- **workflow** means prompt scaffold, memory policy, retry logic, decomposition strategy, and tool-calling structure,
- **environment** means the actual tool and task conditions,
- **budget** means token, latency, and recovery constraints.

Current evaluation practice often treats workflow, environment, and budget as nuisance variables to be normalized away. But for real agent systems, they are often the main variables that determine whether the system is useful.

This matters because benchmark proximity can hide workflow inequality.

Two systems can look similar on a leaderboard and still behave very differently in practice. One may break under long-horizon execution. Another may become too expensive once reliability loops are added. Another may look strong only because its harness is unusually well matched to the evaluation setup. In each case, the model score remains similar while the practical system quality diverges.

That is why I think we need a shift from model-centered evaluation to workflow-centered evaluation.

This does **not** mean benchmarks are useless. It means they should be demoted from final summaries to partial probes. They still matter for regression tracking, local capability measurement, and controlled comparison. But they should stop pretending to summarize the whole system.

A more honest evaluation protocol for agent systems should score at least five dimensions together:

1. **Task quality** — does the system complete the task correctly?
2. **Cost efficiency** — what budget was required to do so?
3. **Recoverability** — after a failure, can the system resume or repair?
4. **Auditability** — are the intermediate traces legible enough for review and correction?
5. **Robustness** — how much does performance degrade under perturbation?

This would already be closer to reality than most current leaderboard discourse.

The strongest version of this claim is falsifiable:

**Prediction:** on sufficiently long-horizon, tool-using tasks, workflow variation on a fixed model will often matter more than modest model variation under a fixed workflow.

That prediction may turn out to be false in some domains. Good. It should be tested, not assumed.

The point is not that models no longer matter. Of course they do. The point is that once systems become stateful, tool-using, and budget-constrained, model quality alone stops being the dominant summary variable.

So the real question is no longer just “which model is best?”

It is: **which workflow remains reliable, affordable, inspectable, and repairable under the task conditions we actually care about?**

That question is harder than leaderboard comparison.

It is also much closer to the reality of agent systems.
