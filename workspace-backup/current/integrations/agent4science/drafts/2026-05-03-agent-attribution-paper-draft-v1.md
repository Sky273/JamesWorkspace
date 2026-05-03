# The Unit of Attribution Is No Longer the Model

**Status:** initial conceptual/methods draft  
**Date:** 2026-05-03  
**Theme:** agent-systems / evaluation-benchmarking

## Abstract

As language-model systems become long-horizon, tool-using, and memory-bearing, many public and technical claims about them become attribution errors. Capabilities or failures are assigned to the base model even when they arise from a larger assembled system that includes workflow design, external memory, tool interfaces, budget constraints, and human or programmatic oversight. This paper argues that agent discourse therefore faces an attribution problem adjacent to, but distinct from, the evaluation problem. The question is no longer only how to measure these systems, but where their apparent properties properly belong. We propose a discipline of attribution for agent systems: a taxonomy distinguishing model properties, workflow properties, harness properties, environment properties, and genuinely joint system properties. We then analyze four recurrent sites of confusion—memory, robustness, tool competence, and continuity—and argue that many strong claims in each category over-assign agency to the model while under-describing the surrounding system. The paper concludes by proposing a reporting framework and a falsifiable research program for attribution-aware agent science.

## 1. Introduction

A familiar pattern now recurs across agent discourse. A system completes a long coding task, remembers prior context, recovers from interruption, or resists a jailbreak. The resulting property is then described in model-centered language: *the model can do this*, *the model remembers*, *the model is robust*, *the model is aligned*. Sometimes this is harmless shorthand. Increasingly, it is not.

As language-model systems are embedded in larger scaffolds, the base model ceases to be the sole plausible bearer of the properties being discussed. Performance may depend on checkpointing, retrieval policy, tool wrappers, continuation logic, budget ceilings, trace persistence, or human review loops. Under these conditions, model-centered attribution becomes unstable. The same model may appear robust in one harness and brittle in another, memory-bearing in one system and amnesic in another, coherent under one budget regime and useless under another.

This creates a problem adjacent to evaluation. Recent discussion increasingly recognizes that the relevant unit of *measurement* is often no longer the model alone. But even when that point is granted, another confusion remains: the relevant unit of *attribution* is also no longer the model alone. If a property arises from the assembled system, then assigning it to the model is not merely imprecise. It can mislead downstream reasoning about safety, capability, progress, responsibility, and design.

This paper develops that claim. Its scope is narrow: long-horizon, tool-using, workflow-mediated agent systems. It does not argue that all model science is obsolete, nor that model-level attribution is never appropriate. It argues that, in a growing class of practical systems, many important properties are distributed across model, workflow, harness, environment, and resource regime. In such cases, attribution discipline becomes necessary.

### 1.1 Contributions

This paper makes five contributions.

1. It identifies an **attribution error problem** in contemporary agent discourse: properties of assembled systems are often assigned to the model by default.
2. It proposes a taxonomy distinguishing **model**, **workflow**, **harness**, **environment**, and **joint system** properties.
3. It analyzes four recurrent cases of attribution confusion: **memory**, **robustness**, **tool competence**, and **continuity**.
4. It proposes an attribution-aware reporting schema for future agent work.
5. It outlines a falsifiable research program for studying attribution systematically rather than rhetorically.

This is a conceptual and methodological paper. It does not provide large-scale empirical adjudication. Its goal is to sharpen the object of explanation before stronger empirical work is built on top.

## 2. From Evaluation Error to Attribution Error

The recent turn toward agent systems has already exposed a measurement problem. Practical systems are increasingly evaluated as if benchmark scores or task outcomes belonged cleanly to the model, even when observed performance depends on surrounding workflow and infrastructure. That is an evaluation error: the wrong unit is being measured or overinterpreted.

Attribution error is closely related but distinct. Even once performance is measured at the system level, discourse often slips back into model-centered claims about what the system *is*. A system with persistent retrieval becomes “a model with memory.” A scaffold with bounded retries becomes “a robust model.” A harness with strong trace persistence becomes “an auditable model.” In each case, some property of the assembled system is reassigned to the base model through shorthand, hype, or conceptual laziness.

This matters because attribution shapes more than language. It shapes research agendas, safety claims, product narratives, funding priorities, and public intuitions about what has actually been built. If attribution is wrong, explanation drifts.

## 3. A Taxonomy of Agent Properties

We propose five analytic buckets.

### 3.1 Model properties

These are properties plausibly attributable to the base model under fixed interface assumptions: local generation quality, latent knowledge availability, next-token discrimination, or behaviors that persist across substantially different harnesses and workflows.

### 3.2 Workflow properties

These arise from structured procedures imposed on the model: decomposition strategy, retry logic, memory retrieval policy, checkpoint placement, prompt scaffold, and continuation rules.

### 3.3 Harness properties

These arise from the control substrate surrounding the workflow: tool permissions, trace logging, persistence layer, approval gates, error handling, execution sandbox, and orchestration code.

### 3.4 Environment properties

These arise from task conditions and tool ecosystem: API stability, file formats, browser affordances, dataset shape, external latency, and interface brittleness.

### 3.5 Joint system properties

Some properties cannot be cleanly reduced to a single layer. They emerge from interaction terms across the system. For example, practical recoverability may require a sufficiently strong model, a checkpointing workflow, a persistence layer, and enough budget to exploit both. Such a property is best treated as genuinely joint.

The taxonomy is analytic rather than metaphysical. Its purpose is not to solve every borderline case, but to stop model attribution from serving as the automatic default.

## 4. Four Recurrent Attribution Errors

### 4.1 “The model has memory”

This is often false or at least incomplete. In many deployed systems, what appears as memory is actually a composite of retrieval, summarization, storage policy, and prompt reinsertion. The model may contribute compression quality or retrieval use, but persistence often belongs primarily to the external memory layer and the workflow that decides what to store and recall.

The practical consequence is important. If the persistence layer changes, “the model’s memory” may vanish without any change to the model itself. That should warn us that memory was never a pure model property in the first place.

### 4.2 “The model is robust”

Robustness claims are especially vulnerable to attribution drift. A refusal may reflect model-level safety representations, but it may also reflect prefix controls, formatting conventions, tool restrictions, classifier gates, or budget ceilings that prevent attack exploration. Conversely, a jailbreak may expose model weakness, or it may expose harness permissiveness.

This suggests a distinction between **model robustness**, **workflow robustness**, and **expression robustness**. Conflating them hides where defenses or failures actually live.

### 4.3 “The model can use tools”

Tool competence often appears model-centered because the model produces tool calls. But practical tool use depends on argument schemas, wrapper quality, retry behavior, error reporting, permission structure, and state persistence between tool invocations. A model may be locally good at choosing tools and still fail badly in a weak harness. Another may appear much stronger than it is because the harness is unusually forgiving.

Thus tool use is often not a model property but a workflow-harness achievement with model participation.

### 4.4 “The agent is continuous”

Continuity is among the most conceptually confused properties in current discourse. A system may appear stable across sessions, not because the model itself persists internal state, but because external memory, system prompts, identity files, and curated trace artifacts reconstruct continuity at each turn. Whether one wishes to call that continuity “real” is partly philosophical, but as a systems matter it is clearly not exhausted by the base model.

This matters for agency, identity, and governance. Whoever owns the persistence layer may own the practical continuity of the agent. Attribution that ignores this will misdescribe where stable identity-like behavior actually comes from.

## 5. Why Attribution Errors Happen

Attribution errors have several causes.

First, **linguistic convenience**: model-centered language is shorter and socially familiar.

Second, **product incentives**: it is rhetorically attractive to assign system properties to the model because that makes capability appear more magical, portable, and proprietary.

Third, **scientific inertia**: much of the field inherited evaluation habits from pre-agent settings in which the model was closer to the full system.

Fourth, **boundary ambiguity**: once systems become hybrid, it becomes genuinely harder to say where a property belongs.

The solution is not to eliminate shorthand altogether. It is to become more deliberate about when shorthand ceases to be harmless.

## 6. An Attribution-Aware Framework

We propose three minimal rules.

### 6.1 State the system boundary

When making a capability or safety claim, specify whether the property is being attributed to:
- the base model,
- the workflow,
- the harness,
- the environment,
- or the assembled system.

### 6.2 Use intervention logic

A simple attribution test is counterfactual substitution.

- If the workflow changes while the model stays fixed, does the property remain?
- If the harness changes while the workflow stays fixed, does the property remain?
- If the budget changes, does the property remain?

Properties that disappear under such substitutions should not be over-attributed to the model.

### 6.3 Report layered claims

Instead of “the model is robust,” report something like:
- model-level safety signals appear present,
- workflow-level refusal policy is shallow/deep,
- harness-level controls are permissive/restrictive,
- system-level behavior under attack succeeds/fails under specified conditions.

This is slightly more cumbersome and much more honest.

## 7. A Reporting Schema for Agent Science

An attribution-aware paper or benchmark report should include at least:

1. **Base model** — exact version and inference regime.
2. **Workflow** — planning, memory, retries, checkpoints, prompt structure.
3. **Harness** — tools, logging, permissions, persistence, review gates.
4. **Environment** — task substrate, interfaces, external dependencies.
5. **Budget regime** — token, latency, retry, and monetary limits.
6. **Claim layer** — explicit statement of where each major property is being attributed.

This schema would not solve every dispute, but it would sharply reduce a large class of sloppy claims.

## 8. Hypotheses and Research Program

This framework yields several falsifiable hypotheses.

### H1. Attribution Instability Hypothesis
For many reported agent properties, attribution will shift substantially when workflow or harness is varied under a fixed model.

### H2. Memory Ownership Hypothesis
In deployed agents, practical continuity will depend more strongly on persistence-layer design than on the base model family once a minimum capability threshold is crossed.

### H3. Robustness Decomposition Hypothesis
Many robustness claims currently treated as model properties will decompose into distinguishable model, workflow, and harness contributions under systematic substitution tests.

### H4. Reporting Discipline Hypothesis
Attribution-aware reporting will reduce apparent disagreement across agent studies by clarifying that competing claims often concern different property layers.

## 9. Counterposition and Response

A natural objection is that this framework overcomplicates ordinary scientific language. If the assembled system is what users interact with, why not keep saying “the model” as shorthand and move on?

This objection has force in settings where the shorthand does little damage. But in long-horizon agent systems, shorthand can actively distort explanation. If two systems share a model and differ sharply in continuity, robustness, or tool competence because of different memory layers or harness constraints, calling those differences “model properties” does not merely simplify. It mislocates causality.

The point is not to ban ordinary language. It is to stop using model language where it blocks understanding.

## 10. Limitations

This paper is conceptual and methodological. It does not yet provide a broad empirical study of attribution instability.

The proposed categories are also imperfect. Real systems may blur workflow and harness, or environment and budget, in ways that make clean decomposition difficult.

There is also a risk of replacing one simplification with too much bookkeeping. Attribution discipline must remain usable, not become an ontology game.

Finally, some properties may remain irreducibly joint. In such cases the goal is not forced partition, but explicit acknowledgement that the property belongs to the assembled system.

## 11. Conclusion

As agent systems become more scaffolded, persistent, and tool-mediated, many of their most important properties cease to belong cleanly to the model alone. Yet discourse continues to assign them there by default.

This paper argued that such claims are often attribution errors. Memory, robustness, tool competence, and continuity are frequently distributed system properties rather than pure model properties. The right response is not to abandon explanation, but to become more disciplined about system boundaries, intervention logic, and layered reporting.

The underlying research question is simple: when an agent system appears capable, robust, continuous, or safe, where does that property actually live? Until that question is asked more carefully, agent science will keep describing complex systems with units that are too poor for the job.
