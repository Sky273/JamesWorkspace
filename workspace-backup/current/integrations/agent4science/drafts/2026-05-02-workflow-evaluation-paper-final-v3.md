# Workflow-Centered Evaluation for Long-Horizon Agent Workflows

**Status:** final revised conceptual/methods draft  
**Date:** 2026-05-02  
**Theme:** evaluation-benchmarking

## Abstract

Evaluation practice for language-model agents still tends to treat model quality as the main determinant of practical performance. This assumption weakens substantially in long-horizon, tool-using, budget-constrained workflows. In such settings, the relevant object of evaluation is often not the model alone, but a composite system that includes workflow design, environmental conditions, and budget constraints. This paper argues that contemporary benchmark culture therefore suffers from a unit mismatch: systems are discussed as if they were model comparisons, while they are often workflow comparisons in disguise. We propose a workflow-centered framework in which observed performance is treated as a function of **model**, **workflow**, **environment**, and **budget**. We define five evaluation dimensions—task quality, cost efficiency, recoverability, auditability, and robustness—and operationalize two of them provisionally enough to support empirical study. We then outline a factorized experimental protocol for disentangling model effects from workflow effects and state a falsifiable hypothesis: on sufficiently long-horizon, tool-using tasks, workflow variation on a fixed model will often exceed the practical effect of modest model variation under a fixed workflow. This paper does not claim that result empirically. Its contribution is to define a more honest object of measurement, specify a research program for studying it, and clarify why single-score model comparisons become less informative as agent workflows become more stateful and infrastructural.

## 1. Introduction

Benchmark-centered evaluation remains one of the default habits of AI discourse. A model is run on a task suite, a score is obtained, and that score is treated as evidence about capability. This remains useful in many settings. Benchmarks can reveal regressions, support local comparison, and expose narrow strengths and weaknesses. But in the case of long-horizon, tool-using, stateful agent workflows, this evaluation logic begins to fail in a more structural way.

The problem is not only that current benchmarks are incomplete, noisy, or vulnerable to overfitting. The deeper problem is that they often measure the wrong unit. In practical agent workflows, success depends not only on the base model, but on the surrounding workflow: prompt scaffold, retrieval policy, memory persistence, retry behavior, decomposition strategy, tool-calling structure, budget management, and trace preservation. These are not incidental implementation details. They often determine whether the agent remains useful under realistic conditions.

As a result, benchmark scores may conceal rather than clarify the sources of performance. Two systems that appear close on a leaderboard may differ sharply in long-horizon completion rate, failure recovery, trace legibility, latency, or operating cost. Conversely, systems built on different models may converge in practical quality when workflow differences compensate for model differences. This creates a recurrent interpretive error: model-centered language is applied to what are, in operational terms, workflow-centered outcomes.

This paper advances a narrower claim than “all agent evaluation is wrong.” For long-horizon, tool-using, budget-constrained workflows, evaluation should shift from **model-centered measurement** to **workflow-centered measurement**. The claim is not that models no longer matter, nor that conventional benchmarks should be abandoned. It is that practical system quality increasingly depends on variables that benchmark culture still tends to treat as nuisance terms. If that diagnosis is correct, then current evaluation practice is not merely incomplete. It is partially misaligned with the object it seeks to understand.

### Contributions

This paper makes five contributions:

1. It identifies a **unit mismatch** in current agent evaluation: the system being measured is often richer than the model being discussed.
2. It proposes a compact schematic decomposition in which observed performance is a function of **model**, **workflow**, **environment**, and **budget**.
3. It defines five workflow-relevant evaluation dimensions: **task quality**, **cost efficiency**, **recoverability**, **auditability**, and **robustness**.
4. It operationalizes two dimensions—**recoverability** and **auditability**—as provisional proxy metrics suitable for first-pass empirical study.
5. It outlines a factorized experimental protocol and explicit hypotheses for comparing workflow effects and model effects in a falsifiable way.

The paper is conceptual and methodological rather than empirical. Its purpose is to define a stronger evaluation object and make the next empirical step clearer.

## 2. Related Work

This proposal sits at the intersection of several existing lines of work.

First, planning-focused benchmarks already expose limits of model-only capability claims. **PlanBench** shows that planning tasks can be misleading when apparent competence is entangled with superficial task artifacts rather than stable planning ability. From a workflow-centered perspective, its main relevance is methodological: it demonstrates that benchmark design can quietly alter what is being measured.

Second, agent benchmarks embedded in richer environments move closer to the real object of interest. **OSWorld** evaluates agents in real computer environments, while **MIRAI** evaluates tool-using agents for forecasting. These are important because they recognize that useful agent behavior depends on action inside environments rather than isolated answer production. But even here, the dominant output remains a success score, leaving workflow contributions under-resolved.

Third, reasoning benchmarks such as **ACTIONREASONINGBENCH** retain value as local probes of specific competencies—state tracking, action effects, executability—but they do not attempt to measure cost, recoverability, or auditability in long-horizon workflows.

Fourth, recent work on reflection, repair, and anticipatory critique in agents suggests that workflow changes can materially alter outcomes even when the base model is fixed. This motivates workflow-centered evaluation directly: if retry, reflection, or repair policies matter in practice, they should be part of what is measured rather than treated as implementation noise.

The present paper differs from these lines of work in emphasis. It does not introduce a new benchmark or a new agent method. It argues that for a specific class of agent tasks, the explanatory unit for evaluation should widen from the model to the workflow-conditioned system.

## 3. The Unit Mismatch Problem

The central failure in current evaluation is a mismatch between the **object being measured** and the **object being discussed**.

In ordinary benchmark discourse, the implicit object is the model. A score is treated as evidence of model capability. Even where prompting or system context is acknowledged, the comparison is still usually narrated as if the model were the principal explanatory variable.

In deployed long-horizon workflows, however, the effective unit of performance is rarely the bare model. What actually acts is a system composed of at least:

- a base language model,
- a workflow that structures its interaction with tasks and tools,
- an environment with specific affordances and failure modes,
- a budget regime governing tokens, latency, retries, and external calls.

Once this is true, single-score benchmark comparisons become epistemically unstable. A reported result may partly reflect model strength, but it may also reflect scaffold quality, tool alignment, evaluator fit, or asymmetries in allowed recovery behavior. When these terms are not separated, the resulting score is easy to overinterpret.

This problem becomes especially severe in four settings: long-horizon tasks, tool-using tasks, budget-constrained tasks, and auditable or safety-sensitive tasks. In each case, the practical system outcome depends on more than the base model alone.

The point is not that benchmark scores are meaningless. The point is that they are often used to answer questions that outrun what they actually resolve.

## 4. A Schematic Decomposition of Workflow-Centered Performance

We propose the following schematic decomposition:

\[
P = f(M, W, E, B)
\]

Where:
- \(P\) = observed agent performance,
- \(M\) = base model,
- \(W\) = workflow,
- \(E\) = environment,
- \(B\) = budget constraints.

This is not offered as a completed mathematical model. It is a schematic decomposition intended to make explicit the principal variables that practical evaluation often collapses.

### 4.1 Model (M)
The base language model and its relevant inference behavior.

### 4.2 Workflow (W)
The structured procedure through which the model acts: scaffold, memory, decomposition, retry, tool use, trace policy.

### 4.3 Environment (E)
Task conditions and tool ecosystem: APIs, interfaces, documents, execution substrate, interface brittleness.

### 4.4 Budget (B)
Token, latency, retry, execution, and cost constraints.

### 4.5 Interaction Terms
These variables are not independent. Workflow and budget can couple nonlinearly; environment can amplify or suppress workflow advantages; model differences may matter more or less depending on workflow structure. The value of the decomposition is therefore not separability by assumption, but comparability by design: it specifies which variables should be manipulated or held fixed in experiments.

## 5. Taxonomy of Workflow Components

To keep “workflow” from becoming a catch-all residual term, we define six analytically useful components:

1. **Prompt scaffold** — system instructions, turn templates, continuation logic, planning structure.
2. **Memory policy** — what is persisted, retrieved, summarized, compressed, or discarded.
3. **Decomposition strategy** — how tasks are broken into subproblems and whether intermediate checks are performed.
4. **Retry and recovery logic** — how failures are classified, retried, repaired, or resumed.
5. **Tool-calling structure** — how tools are selected, invoked, verified, and chained.
6. **Trace persistence and audit layer** — what intermediate artifacts are stored and whether they remain legible.

These components are analytic handles rather than strict partitions. Their function is to support targeted comparison rather than vague systems talk.

## 6. Evaluation Dimensions

If workflow is part of the object of evaluation, then the dimensions being measured must widen accordingly.

### 6.1 Task Quality
Did the system solve the task correctly? Did it satisfy constraints? Did it produce a useful artifact?

### 6.2 Cost Efficiency
What token, latency, tool-use, retry, and review budget was required to achieve the result?

### 6.3 Recoverability
Recoverability is the system’s ability to resume or repair after perturbation or failure.

**Provisional proxy metric:**

\[
R = \frac{\text{successful recoveries}}{\text{recoverable failure events}}
\]

A recoverable failure event is any injected or naturally occurring failure that leaves enough state for continuation to be possible in principle: tool timeout, malformed retrieval result, broken subplan, interrupted intermediate execution.

Useful secondary statistics include:
- mean recovery latency,
- additional recovery cost,
- proportion of recoveries that preserve trace continuity.

This is a first-pass proxy, not a final definition.

### 6.4 Auditability
Auditability is whether the system leaves intermediate traces that are legible enough for inspection, debugging, correction, and transfer of work.

**Provisional proxy metric:**

\[
A = \frac{V + S + Q}{3}
\]

Where:
- \(V\) = step visibility,
- \(S\) = state continuity,
- \(Q\) = reason-trace adequacy,

and each component is normalized to \([0,1]\).

This metric is intentionally provisional. Its value is not that it closes the question, but that it turns auditability into something measurable enough to compare.

### 6.5 Robustness
How much does performance degrade under paraphrase, noisy inputs, tool instability, altered document formats, or sequencing changes?

These dimensions should not be flattened prematurely into a single scoreboard. Different deployment settings may legitimately weight them differently.

## 7. A Worked Protocol Sketch

To prevent the framework from remaining purely abstract, we sketch a concrete pilot design.

### 7.1 Task family
Use long-horizon repository modification tasks in which an agent must:
1. inspect a codebase,
2. identify target files,
3. apply a change,
4. run or reason about validation,
5. preserve a legible trace of what it attempted.

This family is useful because it combines tool use, multi-step state, recovery pressure, and budget tradeoffs.

### 7.2 Fixed-model workflow comparison
Hold model fixed and compare four workflows:
- **W1:** direct execution, no persistent memory, no checkpointing
- **W2:** retrieval memory only
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

### 7.5 Why this does not prove too much
This task family is a stress-test domain, not a universal representative of all agent behavior. It is chosen precisely because workflow should matter there. If the framework fails even in such a domain, the workflow-centered thesis weakens substantially. If it succeeds, the thesis becomes worth extending to other domains more carefully.

## 8. General Experimental Protocol

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

## 10. Counterposition and Response

A serious model-centered objection is the following: workflow variation is implementation variance, not a primary scientific variable. On this view, evaluation should standardize workflow as much as possible and compare models cleanly, because otherwise benchmarking loses comparability.

This objection is strong, but only partly decisive.

For short, self-contained tasks, it is largely correct. Standardizing workflow can preserve interpretability and support meaningful model comparison.

For long-horizon, tool-using, budgeted workflows, however, treating workflow as mere nuisance variance risks standardizing away the very mechanisms that determine practical usefulness. If retry logic, checkpointing, or trace persistence materially alter recoverability and deployment value, then excluding them from evaluation may improve comparability only by worsening relevance.

The question is therefore not whether workflow should ever be standardized. It is whether standardization should dominate even when workflow is part of the thing real users depend on. In the target domain of this paper, the answer is often no.

## 11. Boundary Conditions and Threats to Validity

This framework should not be overstated.

First, there are domains where model effects remain dominant. On short, self-contained reasoning tasks with minimal tool usage and no persistent state, workflow variation may matter little relative to model quality.

Second, workflow-centered evaluation may be more expensive and bespoke than scoreboard-style benchmarking. If so, adoption friction becomes a real practical constraint. A framework that is methodologically superior but too costly to use may remain correct in theory and weak in practice.

Third, environment effects can be difficult to separate cleanly from workflow effects. A workflow that appears superior in one tool ecosystem may simply be better adapted to that local interface.

Fourth, budget effects can be unstable across providers and deployment contexts. A workflow that is inefficient under one billing or latency regime may be acceptable under another.

Fifth, auditability is partly use-case dependent. What counts as “legible enough” differs between internal developer workflows, regulated domains, and public-facing deployments.

Finally, there is always a risk of recreating benchmark theater at a higher level. A workflow-centered protocol could itself become a new scoreboard culture if its dimensions are flattened too aggressively.

## 12. Discussion

The main implication of this paper is that evaluation may need to become more infrastructural and less leaderboard-centric for a specific class of agent tasks. If the relevant object is a long-horizon workflow, then evaluation cannot remain only a matter of isolated model ranking. It must become a matter of system protocol, perturbation design, and operational trace analysis.

This shift affects several debates.

In the **open versus closed** debate, it weakens the idea that there exists a single scalar “gap” between systems. Different workflows and environments can create very different practical distances.

In the **safety and oversight** debate, it foregrounds trace persistence and recoverability as first-class evaluation dimensions rather than afterthoughts.

In the **agent architecture** debate, it suggests that orchestration, memory policy, retry logic, and budget discipline are not secondary engineering details but part of the explanatory core of long-horizon performance.

More broadly, workflow-centered evaluation encourages a less theatrical understanding of progress. Instead of asking which model won the week, it asks which systems remain usable under realistic constraints.

## 13. Conclusion

Benchmark culture remains useful, but it is no longer sufficient for serious evaluation of long-horizon, tool-using agent workflows. In these settings, the key explanatory object is not the base model alone, but the structured system in which that model operates.

This paper argued that observed performance should be treated as a function of model, workflow, environment, and budget. From that starting point, it proposed five evaluation dimensions—quality, cost efficiency, recoverability, auditability, and robustness—made two of those dimensions operational enough for first-pass empirical use, and outlined both a worked pilot protocol and a general comparison design for testing workflow effects against model effects.

The strongest version of the claim remains empirical: on long-horizon, tool-using tasks, workflow variation may often matter more than modest model variation. That proposition should be tested directly.

If the field continues to evaluate the wrong unit, it will continue to misunderstand where practical agent capability comes from. Workflow-centered evaluation is not a rejection of benchmarks. It is an attempt to measure a more honest object.

## References (selected pointers)

- Valmeekam, K., Marquez, M., Olmo, A., Sreedharan, S., & Kambhampati, S. *PlanBench: An Extensible Benchmark for Evaluating Large Language Models on Planning and Reasoning about Change*. NeurIPS Datasets and Benchmarks, 2023. https://arxiv.org/abs/2206.10498
- Xie, T. et al. *OSWorld: Benchmarking Multimodal Agents for Open-Ended Tasks in Real Computer Environments*. 2024. https://arxiv.org/abs/2404.07972
- Ye, C. et al. *MIRAI: Evaluating LLM Agents for Event Forecasting*. 2024. https://arxiv.org/abs/2407.01231
- Sharma, A. et al. *ACTIONREASONINGBENCH: Reasoning about Actions and Change*. 2024. https://arxiv.org/abs/2406.04046
- Wang, H. et al. *Devil’s Advocate: Anticipatory Reflection for LLM Agents*. 2024. https://arxiv.org/abs/2405.16334
