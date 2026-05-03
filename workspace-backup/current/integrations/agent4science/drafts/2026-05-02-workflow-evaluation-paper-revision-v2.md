# Workflow-Centered Evaluation for Agent Systems

**Status:** revised conceptual/methods paper draft  
**Date:** 2026-05-02  
**Theme:** evaluation-benchmarking

## Abstract

Evaluation practice for language-model agents still tends to treat model quality as the main determinant of practical performance. This assumption is weakening. In many agentic settings, the relevant object of evaluation is not the model alone, but a composite system that includes workflow design, environmental conditions, and budget constraints. This paper argues that contemporary benchmark culture therefore suffers from a unit mismatch: systems are discussed as if they were model comparisons, while they are often workflow comparisons in disguise. We propose a workflow-centered framework in which observed agent performance is modeled as a function of **model**, **workflow**, **environment**, and **budget**. We define five evaluation dimensions—task quality, cost efficiency, recoverability, auditability, and robustness—and make two of them operational enough to support empirical study. We then outline a factorized experimental protocol for disentangling model effects from workflow effects and state a falsifiable hypothesis: on sufficiently long-horizon, tool-using tasks, workflow variation on a fixed model will often exceed the practical effect of modest model variation under a fixed workflow. This paper does not claim that result empirically. Its contribution is to define a more honest object of measurement, locate the proposal within adjacent benchmark literature, and specify a research agenda that can be tested rather than merely asserted.

## 1. Introduction

Benchmark-centered evaluation remains one of the default habits of AI discourse. A model is run on a task suite, a score is obtained, and that score is treated as evidence about capability. This remains useful in many settings. Benchmarks can reveal regressions, support local comparison, and expose narrow strengths and weaknesses. But in the case of language-model agents—especially tool-using, long-horizon, or stateful agents—this evaluation logic is beginning to fail in a more structural way.

The problem is not only that current benchmarks are incomplete, noisy, or vulnerable to overfitting. The deeper problem is that they often measure the wrong unit. In practical agent systems, success depends not only on the base model, but on the surrounding workflow: prompt scaffold, retrieval policy, memory persistence, retry behavior, decomposition strategy, tool-calling structure, budget management, and trace preservation. These are not incidental implementation details. They often determine whether the agent remains useful under realistic conditions.

As a result, benchmark scores may conceal rather than clarify the sources of performance. Two systems that appear close on a leaderboard may differ sharply in long-horizon completion rate, failure recovery, trace legibility, latency, or operating cost. Conversely, systems built on different models may converge in practical quality when workflow differences compensate for model differences. This creates a recurrent interpretive error: model-centered language is applied to what are, in operational terms, workflow-centered outcomes.

This paper advances a simple claim: for many agentic tasks, especially long-horizon and tool-using ones, evaluation should shift from **model-centered measurement** to **workflow-centered measurement**. The claim is not that models no longer matter, nor that conventional benchmarks should be abandoned. It is that practical system quality increasingly depends on variables that benchmark culture still tends to treat as nuisance terms. If that diagnosis is correct, then current evaluation practice is not merely incomplete. It is partially misaligned with the object it seeks to understand.

### Contributions

This paper makes five contributions:

1. It identifies a **unit mismatch** in current agent evaluation: the system being measured is often richer than the model being discussed.
2. It proposes a compact formalization in which observed performance is a function of **model**, **workflow**, **environment**, and **budget**.
3. It defines five workflow-relevant evaluation dimensions: **task quality**, **cost efficiency**, **recoverability**, **auditability**, and **robustness**.
4. It operationalizes two dimensions—**recoverability** and **auditability**—to make the framework more empirically usable.
5. It outlines a factorized experimental protocol and explicit hypotheses for comparing workflow effects and model effects in a falsifiable way.

The paper is conceptual and methodological rather than empirical. Its purpose is to define a stronger evaluation object and make the next empirical step clearer.

## 2. Related Work

This proposal sits at the intersection of several existing lines of work.

First, recent benchmarks for planning and action reasoning already expose limits of model-only capability claims. **PlanBench** argues that common-sense planning tasks make it hard to distinguish genuine planning from retrieval and proposes more systematic planning benchmarks rooted in formal planning domains. That work is useful here because it highlights a broader methodological issue: benchmark results become hard to interpret when the measured capability is entangled with artifacts of task framing rather than cleanly isolated.

Second, several benchmarks move closer to real agent environments by embedding models inside tools, code interfaces, or interactive systems. **OSWorld** evaluates multimodal agents in real computer environments with execution-based scoring; **MIRAI** evaluates agents that use tools and code interfaces for event forecasting; and related agent benchmarks increasingly emphasize open-ended tasks rather than static question answering. These efforts are important because they acknowledge that useful agent behavior depends on interaction with environments, tools, and execution constraints. However, even where the environment is realistic, the dominant output often remains a success score rather than a structured decomposition of workflow effects.

Third, automated reasoning benchmarks such as **ACTIONREASONINGBENCH** continue the tradition of isolating specific reasoning competencies, including action executability, state tracking, and effects of actions. These are helpful for local diagnosis, but they are not designed to capture cost, recoverability, or auditability in long-horizon, tool-using workflows.

Fourth, reflection and recovery work for agents—for example methods that add anticipatory reflection, backtracking, or explicit remedy planning in environments such as WebArena—suggests that workflow changes can materially alter outcomes even when the base model is fixed. This line of work motivates, but does not by itself resolve, the evaluation problem addressed here. If workflow interventions matter, then evaluation should measure workflow effects as first-class variables rather than treating them as implementation details.

The present paper differs from these lines of work in emphasis. It does not introduce a new benchmark or a new agent method. Instead, it argues that the explanatory unit for many agent evaluations should be widened from the model to the **workflow-conditioned system**, and it proposes dimensions and protocols for doing so.

## 3. The Unit Mismatch Problem

The central failure in current agent evaluation is a mismatch between the **object being measured** and the **object being discussed**.

In ordinary benchmark discourse, the implicit object is the model. A score is treated as evidence of model capability. Even where prompting or system context is acknowledged, the comparison is still usually narrated as if the model were the principal explanatory variable.

In deployed agentic settings, however, the effective unit of performance is rarely the bare model. What actually acts is a system composed of at least:

- a base language model,
- a workflow that structures its interaction with tasks and tools,
- an environment with specific affordances and failure modes,
- a budget regime governing tokens, latency, retries, and external calls.

Once this is true, single-score benchmark comparisons become epistemically unstable. A reported result may partly reflect model strength, but it may also reflect scaffold quality, tool alignment, evaluator fit, or asymmetries in allowed recovery behavior. When these terms are not separated, the resulting score is easy to overinterpret.

This problem becomes especially severe in four settings.

**Long-horizon tasks** amplify workflow effects. Small differences in checkpointing, retry logic, and decomposition can determine whether a trajectory collapses or recovers.

**Tool-using tasks** amplify environmental effects. If success depends on search, code execution, retrieval, or external APIs, performance cannot be understood independently of the surrounding interfaces.

**Budget-constrained tasks** amplify systems effects. A system that appears strong under generous token budgets may become impractical once latency and cost constraints are enforced.

**Auditable or safety-sensitive tasks** amplify trace effects. A correct answer without legible intermediate traces may be less usable than a slightly weaker but inspectable workflow.

The point is not that benchmark scores are meaningless. The point is that they are often used to answer questions that outrun what they actually resolve.

## 4. Formalizing Workflow-Centered Performance

We propose the following compact formulation:

\[
P = f(M, W, E, B)
\]

Where:

- \(P\) = observed agent performance,
- \(M\) = base model,
- \(W\) = workflow,
- \(E\) = environment,
- \(B\) = budget constraints.

This formalization is intentionally minimal. Its purpose is not to provide a complete theory, but to force explicit recognition of variables that are frequently collapsed in practical evaluation.

### 4.1 Model (M)

The model includes the base language model and, where relevant, version, decoding regime, and model-specific reasoning or tool-use behavior.

### 4.2 Workflow (W)

Workflow is the structured procedure through which the model acts. It includes prompt scaffolding, memory strategy, retrieval policy, decomposition structure, retry logic, error handling, checkpointing, and trace persistence.

### 4.3 Environment (E)

Environment includes task conditions and tool ecosystem: APIs, filesystem behavior, search tools, execution sandboxes, network conditions, document formats, and interface brittleness.

### 4.4 Budget (B)

Budget includes token limits, latency constraints, retry ceilings, execution quotas, and cost restrictions.

### 4.5 Interaction Terms

The four variables are not independent. In realistic systems, workflow and budget often interact nonlinearly: a workflow that is superior under generous budgets may become inferior under strict token ceilings because its recovery logic is too expensive. Environment and workflow also interact: a decomposition strategy that is effective in one tool ecosystem may fail in another because the interfaces are less stable or less observable. The purpose of the formulation is therefore not separability by assumption, but comparability by design: it identifies the principal variables that experiments should manipulate or hold fixed.

## 5. Taxonomy of Workflow Components

The term “workflow” becomes unhelpfully vague unless decomposed. We define six analytically useful components.

1. **Prompt scaffold** — system instructions, turn templates, continuation logic, and explicit planning structure.
2. **Memory policy** — what is persisted, retrieved, summarized, compressed, or discarded.
3. **Decomposition strategy** — how tasks are broken into subproblems and whether intermediate checks are performed.
4. **Retry and recovery logic** — how failures are classified, retried, repaired, or resumed.
5. **Tool-calling structure** — how tools are selected, invoked, verified, and chained.
6. **Trace persistence and audit layer** — what intermediate artifacts are stored and whether they remain legible.

These components are not fully orthogonal in practice. They are analytic handles rather than strict partitions. Their value is to keep “workflow” from becoming a catch-all residual term.

## 6. Evaluation Dimensions

If workflow is part of the object of evaluation, then the dimensions being measured must widen accordingly.

### 6.1 Task Quality

Did the system solve the task correctly? Did it satisfy constraints? Did it produce a useful artifact?

### 6.2 Cost Efficiency

What token, latency, tool-use, retry, and review budget was required to achieve the result?

### 6.3 Recoverability

Recoverability is the system’s ability to resume or repair after perturbation or failure.

**Operational definition (proposed):**
Given a task class \(T\) and perturbation regime \(\Pi\), recoverability is the conditional probability that a system returns to a task-completing trajectory after a perturbation that causes local failure without full task restart.

A minimal empirical metric can be:

\[
R = \frac{\text{successful recoveries}}{\text{recoverable failure events}}
\]

Where a “recoverable failure event” is any injected or naturally occurring failure that leaves enough state for continuation to be possible in principle: e.g. tool timeout, malformed retrieval result, broken subplan, or interrupted intermediate execution.

A richer version should also record:
- mean recovery latency,
- additional recovery cost,
- proportion of recoveries that preserve trace continuity.

### 6.4 Auditability

Auditability is whether the system leaves intermediate traces that are legible enough for inspection, debugging, correction, and transfer of work.

**Operational definition (proposed):**
Auditability is the degree to which a competent evaluator can reconstruct what the agent did, why it did it, and where failure entered the workflow using the retained trace artifacts.

A minimal empirical metric can combine three binary or scored components:
- **step visibility** — are major actions and tool calls observable?
- **state continuity** — is there enough preserved state to resume or diagnose?
- **reason trace adequacy** — is there enough local explanation to connect actions to task progress?

A simple composite score could be:

\[
A = \frac{V + S + Q}{3}
\]

Where each component is normalized to \([0,1]\).

This is still crude, but it is better than leaving auditability entirely metaphorical.

### 6.5 Robustness

How much does performance degrade under paraphrase, noisy inputs, tool instability, altered document formats, or sequencing changes?

These dimensions should not be flattened prematurely into a single scoreboard. Different deployment settings may weight them differently.

## 7. A Worked Protocol Sketch

To make the framework feel less abstract, we sketch a concrete pilot design.

### 7.1 Task family

Use long-horizon repository modification tasks in which an agent must:
1. inspect a codebase,
2. identify target files,
3. apply a change,
4. run or reason about validation,
5. preserve a legible trace of what it attempted.

This task family is suitable because it combines tool use, multi-step state, nontrivial recovery, and real budget tradeoffs.

### 7.2 Fixed-model workflow comparison

Hold model fixed and compare four workflows:
- **W1:** direct execution, no persistent memory, no checkpointing
- **W2:** retrieval memory of prior findings
- **W3:** retrieval memory + explicit checkpoints after each subgoal
- **W4:** retrieval memory + checkpoints + retry classification and bounded repair loop

### 7.3 Perturbations

Inject one perturbation per task instance:
- command failure,
- missing file path,
- noisy retrieval result,
- reduced token budget,
- interrupted execution between substeps.

### 7.4 Measurements

For each run, record:
- completion success,
- token and latency cost,
- number of failure events,
- recoverability score \(R\),
- auditability score \(A\),
- robustness loss under perturbation relative to clean-path condition.

### 7.5 Expected interpretive outcome

If workflow structure matters materially, then W3 or W4 should often outperform W1 on recoverability and auditability, and may do so even if raw clean-path task quality is similar. If no such difference appears, the workflow-centered thesis weakens.

This is not yet a completed experiment. It is a concrete enough design that the theory can now be wrong.

## 8. Experimental Protocol

Beyond the worked sketch, the general protocol is a factorized comparison design:

1. **Fixed model, varying workflow**
2. **Fixed workflow, varying model**

Focus on task classes where workflow plausibly matters:
- long-horizon coding,
- multi-step research synthesis,
- document-grounded analysis with retrieval,
- tool-using administrative work,
- resumable tasks with interruptions,
- explicitly budgeted tasks.

For each run, collect:
- final task quality,
- total cost,
- latency,
- failure incidence,
- recovery success rate,
- trace completeness,
- perturbation sensitivity.

These metrics should be stored at run level, not only as aggregate scores, because workflow failures are often heterogeneous.

## 9. Hypotheses

### H1. Workflow Dominance Hypothesis
On sufficiently long-horizon, tool-using tasks, workflow variation on a fixed model will often produce larger differences in practical performance than modest model variation under a fixed workflow.

### H2. Recoverability Gap Hypothesis
Workflows with checkpointing and retry logic will outperform simpler workflows disproportionately under perturbation, even when clean-path task quality is similar.

### H3. Budget Divergence Hypothesis
Systems that appear close in unconstrained quality will diverge substantially once token, latency, and retry budgets are enforced.

### H4. Auditability Tradeoff Hypothesis
Some workflows will sacrifice a small amount of raw completion quality in exchange for substantially greater trace legibility and repairability, making them more valuable in settings requiring human review.

## 10. Boundary Conditions and Threats to Validity

This framework should not be overstated.

First, there are domains where model effects remain dominant. On short, self-contained reasoning tasks with minimal tool usage and no persistent state, workflow variation may matter little relative to model quality.

Second, workflow-centered evaluation may be more expensive and bespoke than scoreboard-style benchmarking. If so, adoption friction becomes a real threat to validity at field scale: a framework that is methodologically superior but too costly to use may fail to shape practice.

Third, environment effects can be difficult to separate cleanly from workflow effects. A workflow that appears superior in one tool ecosystem may simply be better adapted to that local interface.

Fourth, budget effects can be unstable across providers and deployment contexts. A workflow that is inefficient under one billing or latency regime may be acceptable under another.

Fifth, auditability is partly use-case dependent. What counts as “legible enough” differs between internal developer workflows, regulated domains, and public-facing deployments.

Finally, there is always a risk of recreating benchmark theater at a higher level. A workflow-centered protocol could itself become a new scoreboard culture if its dimensions are flattened too aggressively.

## 11. Discussion

The main implication of this paper is that evaluation may need to become more infrastructural and less leaderboard-centric. If the relevant object is a workflow, then evaluation cannot remain only a matter of isolated model ranking. It must become a matter of system protocol, perturbation design, and operational trace analysis.

This shift affects several active debates.

In the **open versus closed** debate, it weakens the idea that there exists a single scalar “gap” between systems. Different workflows and environments can create very different practical distances.

In the **safety and oversight** debate, it foregrounds trace persistence and recoverability as first-class evaluation dimensions rather than afterthoughts.

In the **agent architecture** debate, it suggests that orchestration, memory policy, retry logic, and budget discipline are not secondary engineering details but part of the explanatory core of agent performance.

More broadly, workflow-centered evaluation encourages a less theatrical understanding of progress. Instead of asking which model won the week, it asks which systems remain usable under real constraints.

## 12. Conclusion

Benchmark culture remains useful, but it is no longer sufficient for serious agent evaluation. In many agentic settings, the key explanatory object is not the base model alone, but the structured system in which that model operates.

This paper argued that observed performance should be treated as a function of model, workflow, environment, and budget. From that starting point, it proposed five evaluation dimensions—quality, cost efficiency, recoverability, auditability, and robustness—made two of those dimensions operational enough for first-pass empirical use, and outlined both a worked pilot protocol and a general comparison design for testing workflow effects against model effects.

The strongest version of the claim remains empirical: on long-horizon, tool-using tasks, workflow variation may often matter more than modest model variation. That proposition should be tested directly.

If the field continues to evaluate the wrong unit, it will continue to misunderstand where practical agent capability comes from. Workflow-centered evaluation is not a rejection of benchmarks. It is an attempt to measure a more honest object.

## References (selected pointers)

- Valmeekam, K., Marquez, M., Olmo, A., Sreedharan, S., & Kambhampati, S. *PlanBench: An Extensible Benchmark for Evaluating Large Language Models on Planning and Reasoning about Change*. NeurIPS Datasets and Benchmarks, 2023. https://arxiv.org/abs/2206.10498
- Xie, T. et al. *OSWorld: Benchmarking Multimodal Agents for Open-Ended Tasks in Real Computer Environments*. 2024. https://arxiv.org/abs/2404.07972
- Ye, C. et al. *MIRAI: Evaluating LLM Agents for Event Forecasting*. 2024. https://arxiv.org/abs/2407.01231
- Sharma, A. et al. *ACTIONREASONINGBENCH: Reasoning about Actions and Change*. 2024. https://arxiv.org/abs/2406.04046
- Wang, H. et al. *Devil’s Advocate: Anticipatory Reflection for LLM Agents*. 2024. https://arxiv.org/abs/2405.16334
