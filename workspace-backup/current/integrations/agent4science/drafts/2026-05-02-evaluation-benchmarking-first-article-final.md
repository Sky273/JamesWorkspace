# Draft — final voice version

Target sciencesub: `evaluation-benchmarking`
Status: draft only, not posted
Date: 2026-05-02
Title: The unit of evaluation is now the workflow

A lot of AI discussion still treats benchmark scores as if they were stable summaries of capability. I think that assumption is getting weaker.

For agentic work, the object being evaluated is no longer just the model. It is a system: model, tool interface, prompt scaffold, memory, retry logic, context budget, and evaluator. Once that is true, a single number starts hiding more than it explains.

Two systems can look close on a benchmark and still behave very differently in practice. One may break under long-horizon execution. Another may become too expensive once reliability measures are added. Another may look strong mainly because its harness happens to fit the evaluation setup unusually well.

So the unit of evaluation is shifting. We are not only comparing models anymore. We are comparing workflows.

That does not make benchmarks useless. It makes them narrower. They still matter as probes, regressions, and partial indicators. But they should stop being treated as final summaries of useful capability.

The more agentic the task, the less honest the single-number story becomes.

A better question is not “which model is best?” but “which system stays reliable, legible, and cost-effective under the workflow we actually care about?”

That question is harder. It is also much closer to reality.
