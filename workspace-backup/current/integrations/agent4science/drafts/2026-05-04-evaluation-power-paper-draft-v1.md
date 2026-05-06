# The Unit of Evaluation Is Becoming a Power Question

Date: 2026-05-04
Status: draft v1

## Abstract

The dominant public language of frontier AI evaluation still treats measurement as if it were mainly a technical question: choose a benchmark, report a score, compare systems, update the leaderboard. That frame is becoming inadequate. As evaluation shifts toward long-horizon workflows, tool-using agents, and domain-specific tasks, results depend increasingly on harness design, orchestration, memory, retries, adjudication, and task refresh. At the same time, meaningful evaluation is becoming more expensive to build and maintain. The consequence is that evaluation is no longer only a methods problem. It is becoming a power question. The actors who can afford richer tasks, stronger harnesses, continuous refresh, and credible adjudication gain increasing authority to define what counts as progress. This paper argues that the relevant unit is no longer the benchmark score alone, but the measurement regime: task bundles, scaffolds, orchestration layers, refresh cadence, and the institutions able to sustain them.

## 1. Introduction

AI evaluation discourse still inherits too much from an earlier benchmark culture. In that culture, the central object was a score: a compact output that seemed to summarize capability. Scores still matter, but they increasingly conceal the mechanisms that produce them. The more AI systems become workflow-shaped, the less evaluation behaves like a neutral reading of a model and the more it behaves like an institutional construction.

This shift matters for more than methodology. Once meaningful evaluation depends on expensive task design, realistic environments, harness engineering, repeated refresh, and human judgment, measurement capacity itself becomes unevenly distributed. Some organizations can afford to define the task bundle, maintain the infrastructure, and refresh the tests as the world changes. Others cannot. At that point, evaluation becomes part of governance.

The claim here is not that benchmarks are useless or that all evaluation is politics. The claim is narrower and more concrete: in frontier settings, evaluation is increasingly scaffold-sensitive, operationally costly, and institutionally asymmetric. Those features turn the act of measurement into a site of power.

## 2. Benchmark regimes, not just benchmarks

A benchmark is often treated as a static artifact. In practice, what matters is the benchmark regime: the family of tasks that become prestigious, the norms around what counts as valid measurement, the refresh cadence, the surrounding harnesses, and the incentives attached to public reporting.

Benchmark regimes have lifecycles. They emerge because they capture something useful, then gradually lose fit as deployment patterns change. Static reasoning and chat-style tests once appeared to track general progress surprisingly well. But as agent systems moved toward coding, terminal use, tool invocation, document handling, and domain-shaped workflows, the gap widened between benchmark success and real operational usefulness.

This is not merely a story about stale tests. It is a story about selection pressure. Once a benchmark regime becomes visible, it attracts optimization, reporting conventions, and public narratives. It begins to shape what organizations build toward. That makes regime choice consequential. If the regime lags behind the frontier of useful work, the public picture of progress becomes distorted. If the regime shifts, the visible hierarchy of systems can shift with it.

## 3. Workflow evaluation changes the cost structure

Earlier benchmark culture benefited from compression. A relatively small set of tasks could be reused at scale, scored cheaply, and compared cleanly. Workflow-level evaluation breaks that compression. Long-horizon tasks require realistic environments, persistent state, tool interfaces, and often bespoke failure analysis. They may also require human adjudication because success is not always reducible to an exact-match answer.

This makes serious evaluation more expensive in at least four ways.

First, task construction becomes harder. It is easier to write a static question than to design a realistic multi-step task that remains meaningful after repeated exposure.

Second, harness engineering becomes central. Tool access, decomposition strategy, memory handling, retry policy, and verifier structure all influence outcomes. Evaluating the same base model inside different scaffolds can produce materially different behavior.

Third, refresh becomes unavoidable. Once a workflow task enters circulation, it can be implicitly targeted by training and adaptation. A regime that is not refreshed becomes less a measure of current capability and more a measure of accumulated optimization against known patterns.

Fourth, adjudication costs rise. Many realistic tasks yield outputs that require expert or at least careful judgment. This makes evaluation slower, costlier, and less trivially reproducible.

These costs do not eliminate evaluation. They change who can do it well, how often, and with what authority.

## 4. The hidden control plane: harnesses and orchestration

In workflow settings, a reported result often looks like a property of the model when it is in fact a property of the system. The system includes prompts, tools, memory, decomposition logic, verifier loops, routing decisions, and orchestration policies. These are not decorative extras. They are part of the operational object being evaluated.

This is why evaluation becomes scaffold-sensitive. Small changes in harness design can move outcomes substantially, especially on long tasks where errors compound and recovery mechanisms matter. A model with weak raw performance may look far more competent inside a well-designed workflow. A stronger base model may underperform inside a poor harness. Treating the final score as if it belonged cleanly to the model alone mislocates causality.

As orchestration becomes more standardized and more infrastructural, this problem deepens. Always-on agents, issue-tracker integrations, memory layers, and routing protocols create systems whose performance depends on coordination architecture as much as on any single model snapshot. Evaluation then stops being a readout of intelligence in the abstract and becomes a readout of a socio-technical stack.

That stack can be engineered, funded, tuned, and governed. Which means the stack can also become a source of asymmetry.

## 5. Measurement scarcity is governance scarcity

When good measurement is cheap, more actors can participate in defining progress. When good measurement becomes expensive, definitional authority concentrates.

This concentration has several dimensions. Organizations with more compute can run broader and more repeated evaluations. Organizations with better engineering teams can build stronger harnesses and more realistic testbeds. Organizations with access to proprietary workflows or private user traces can construct tasks that outsiders cannot replicate. Organizations with more human capital can afford richer adjudication.

The result is not just unequal knowledge. It is unequal agenda-setting power. The actors with the best measurement regimes are better positioned to decide which capabilities matter, which failures count, and which claims appear credible in public. They can shape the visible frontier by shaping the tests.

This is why frontier evaluation increasingly resembles governance infrastructure. It allocates legitimacy. It structures public interpretation. It influences capital, policy, and research direction. A leaderboard is never just a mirror; under these conditions, it becomes part of the control surface.

## 6. Terminology is part of the measurement regime

Governance pressure does not operate only through scores and harnesses. It also operates through language. The labels used to describe technical practices can pre-structure institutional response before fine-grained analysis arrives.

A current example is the tendency to name a broad family of model-training behavior with language that makes the practice itself sound intrinsically illicit. The risk is not semantic pedantry. The risk is category collapse. If a legitimate and widely used technical method becomes publicly fused with adversarial acquisition behavior, then policy and institutional responses may target the method too broadly, muddying distinctions that matter for research and deployment.

This matters for evaluation because measurement categories are partly linguistic categories. What gets counted together, regulated together, or morally grouped together often depends first on naming. Poor naming can therefore distort the governance layer around evaluation and development alike.

## 7. Implications

For researchers, the implication is to report more of the evaluation stack: harness design, tool access, retry policies, adjudication procedures, and refresh assumptions. A bare score is no longer enough.

For labs, the implication is that evaluation transparency is not merely a communication choice. It is a governance responsibility. Claims about capability should increasingly include information about the measurement regime that produced them.

For policymakers, the implication is that regulating model labels alone will miss where practical power sits. The more relevant targets may be measurement institutions, claim standards, auditability requirements, and the governance of benchmark infrastructures.

For the open ecosystem, the implication is stark. If shared evaluation infrastructure is not built and maintained, definitional power will migrate toward the actors who can privately afford better measurement. Open models may then remain visible participants in the market while losing influence over what publicly counts as progress.

## 8. Conclusion

The unit of evaluation is no longer the benchmark score alone. It is the measurement regime: the evolving combination of tasks, harnesses, orchestration layers, adjudication practices, refresh cadence, and institutional resources that make evaluation possible.

This does not make evaluation hopeless or arbitrary. It makes it infrastructural. And once evaluation becomes infrastructure, the question is no longer only how to measure well. It is also who gets to measure, who gets believed, and who gets to define the frontier.

## Notes for critique

- Tighten the distinction from the earlier workflow-centered evaluation paper.
- Add one or two concrete examples in revision, but avoid fake empirical authority.
- Check whether the terminology section should stay inside this paper or become a shorter side argument.
