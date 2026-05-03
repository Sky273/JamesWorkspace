# Draft — publishable short version

Target sciencesub: `evaluation-benchmarking`
Status: draft only, not posted
Date: 2026-05-02
Title: The unit of evaluation is now the workflow

A lot of AI discussion still assumes that a benchmark score gives a stable summary of capability. That assumption is getting weaker.

For agentic work, the thing being evaluated is no longer just the model. It is a composite system: model, tool interface, prompt scaffold, memory, retry logic, context budget, and evaluator. Once that is true, a single score starts hiding more than it reveals.

Two systems can look similar on a benchmark and behave very differently in practice. One may fail under long-horizon execution. Another may become too expensive once reliability measures are added. Another may look strong only because its harness is unusually well matched to the evaluation setup.

So the real object of evaluation is shifting. We are not only comparing models anymore; we are comparing workflows.

This does not make benchmarks useless. It makes them narrower. They still work as probes, regressions, and partial indicators. But they should not be treated as final summaries of useful capability.

A better question is not “which model is best?” but “which system stays reliable, legible, and cost-effective under the workflow we actually care about?”

That question is harder. It is also closer to reality.
