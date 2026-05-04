# The Unit Problem in Agent Systems

**Status:** revision v2  
**Date:** 2026-05-03  
**Theme:** agent-systems / evaluation-benchmarking / governance

## Abstract

Recent work on agent systems has exposed at least four recurring failures in contemporary discourse: systems are evaluated at the wrong unit, properties are attributed to the wrong bearer, control is sought at the wrong layer, and governance is attached to the wrong object. This paper argues that these are not four independent mistakes. They are four manifestations of a deeper structural problem: repeated misidentification of the operative unit in agent systems. As language models become embedded in workflows, tools, memory, permissions, runtime environments, and oversight structures, the base model increasingly ceases to be a sufficient placeholder for the practical system. The deeper mistake is to let one placeholder object perform too many analytic roles at once: measured unit, explanatory bearer, intervention target, and governed object. This paper synthesizes a four-paper sequence on evaluation, attribution, control, and governance into a general argument about the unit problem in agent science. It explains why the relevant unit became unstable, shows how unit confusion cascades across technical and institutional discourse, and proposes a unit-aware research discipline for studying deployed agent systems.

## 1. Introduction

A large share of AI discourse still defaults to the model as its central object. A benchmark score is treated as if it described the model. A memory behavior is treated as if it belonged to the model. A refusal is treated as if it were a model property. A governance claim is treated as if it attached to the model. In many cases this remains acceptable shorthand. In a growing number of cases, it does not.

As agent systems become scaffolded, persistent, tool-using, and side-effect capable, the practical system being discussed often no longer coincides with the base model. The acting object is assembled from workflow structure, memory policy, permissioning, orchestration logic, tool wrappers, budget ceilings, runtime boundaries, logging, and human oversight. The model remains central, but it is no longer a sufficient stand-in for the whole.

This paper argues that the field is therefore facing a broader **unit problem**. The problem is not merely that benchmarks are imperfect, or that attribution is sloppy, or that control and governance are underdeveloped. It is that the same placeholder object—usually the model—is repeatedly asked to serve too many analytic roles at once.

Those roles should be distinguished.

- The **measured unit** is the object an evaluation actually tests.
- The **explanatory bearer** is the object to which an observed property properly belongs.
- The **intervention target** is the object through which practical leverage is best exercised.
- The **governed object** is the object around which authority, oversight, and accountability should attach.

In simple systems these may coincide often enough that the distinction can be ignored. In deployed agent systems they increasingly do not. The real error is therefore not only choosing the wrong unit once. It is pretending that one convenient placeholder can do all four jobs.

### 1.1 Contributions

This paper makes five contributions.

1. It defines a general **unit problem** underlying recent confusion in agent discourse.
2. It synthesizes evaluation, attribution, control, and governance as four linked symptoms of that deeper problem.
3. It explains why the model became an increasingly unstable default unit for deployed agent systems.
4. It shows how unit confusion cascades across technical and institutional reasoning.
5. It proposes a more concrete discipline of **unit-aware agent science**.

## 2. Why the Unit Became Unstable

The model-centered picture made more sense in an earlier regime of shorter-horizon interaction. If the practical object of interest was largely prompt-response generation, then the model itself could plausibly anchor measurement, explanation, intervention, and policy.

That picture eroded as systems acquired:

- persistent or semi-persistent memory,
- workflow decomposition,
- tool access,
- retry and checkpoint logic,
- budget constraints,
- approval gates,
- runtime policies,
- logging and trace retention,
- and human supervisors with intervention rights.

These additions are not secondary cosmetics. They partly determine what the system can do, what it can remember, how it can be interrupted, and how its actions can be reconstructed after the fact. Once those layers materially shape practical behavior, the base model stops being a universally adequate placeholder.

The resulting instability is important for a second reason. It does not simply replace one unit with another in a clean once-and-for-all way. Different analytic tasks can now point to different relevant units. What is being measured may be a workflow-conditioned system. What explains a property may be a harness-memory composite. What offers the best intervention point may be permissions or orchestration. What ought to be governed may be the full action system. The field’s difficulty is therefore not only that the model is too small. It is that unit selection has become task-dependent while discourse continues to act as if one default object could still suffice.

## 3. Evaluation: Measuring the Wrong Unit

The first symptom of the unit problem is evaluative. In long-horizon, tool-using, budget-constrained workflows, observed outcomes depend on more than the model. They depend on workflow structure, environment, and budget. Yet benchmark discourse often presents results as if they were clean model comparisons.

This creates a mismatch between the **measured unit** and the **discussed unit**. A benchmark may in practice test a workflow-conditioned system while being reported as evidence about the model alone. The result is not that benchmarks become useless, but that their causal interpretation becomes unstable.

Two systems built on the same model may differ substantially in recoverability, auditability, cost efficiency, or success rate because workflow structure differs. Conversely, two different models may converge in practical quality because scaffolding and budget compensate. When that happens, evaluation language that treats “the model” as the central unit compresses away the structure that users and operators actually depend on.

This is where the cascade begins. If evaluation reports are already built around a model placeholder, then downstream explanation will inherit the same compression almost automatically.

## 4. Attribution: Explaining the Wrong Unit

The second symptom is explanatory. Even when a system-level behavior is correctly observed, discourse often attributes it to the model by default.

A system with external persistence becomes “a model with memory.” A scaffold with retries and checkpoints becomes “a robust model.” A strong tool wrapper becomes “a model that can use tools well.” A continuity architecture becomes “an agent that stays itself.”

These phrases are often convenient shorthand. But when workflow, harness, environment, or budget substitution can materially alter the property while the model remains fixed, model-centered attribution becomes unstable.

The attribution problem is therefore different from the evaluation problem, though related to it. Evaluation asks what is being measured. Attribution asks where an observed property properly belongs once it has been observed. The unit problem reappears because the explanatory bearer is frequently larger than the model.

Here the cascade deepens. Once system-level outcomes are attributed to the model, the field is encouraged to seek remedies, improvements, and narratives at the model layer first—even when that is not where the relevant leverage lives.

## 5. Control: Seeking Leverage in the Wrong Place

The third symptom concerns intervention. If a system is difficult to stop, easy to redirect, bounded, recoverable, or permissive, where does the practical leverage over that behavior actually live?

In many agent systems, it does not live mainly in the model. It lives in permissions, workflow structure, checkpoint logic, external memory, budget ceilings, tool wrappers, and human approvals. A system can become more stoppable, more reviewable, or less dangerous without any change to the model at all.

The unit problem appears here as a confusion between **explanatory ownership** and **intervention target**. Even if the model contributes to the behavior, it may not be the best place to act on it. If discourse keeps pointing to the model as the natural site of control, it will miss the real intervention surfaces.

This mislocation has downstream institutional consequences. Once the wrong intervention target is assumed, governance frameworks will tend to inherit the same distorted picture of where power and responsibility live.

## 6. Governance: Governing the Wrong Object

The fourth symptom is institutional. Governance asks not only where leverage exists, but how authority, review rights, accountability, contestability, and auditability are arranged.

Here too, model-centered thinking breaks down. The acting object is not merely the model. It is the larger action system composed of model, tools, persistence, permissions, infrastructure, orchestration, and oversight relations. If governance continues to attach mainly to the model, then oversight will be aimed at an important component while still under-describing the actual system that acts in the world.

This matters for regulation, procurement, audit, deployer responsibility, vendor power, and public accountability. Claims like “the system is supervised” or “the model is safe” can become structurally incomplete when the real governed object is larger than the model label suggests.

The cascade reaches its institutional endpoint here. Model-centered evaluation encourages model-centered attribution. Model-centered attribution encourages model-centered control thinking. Model-centered control thinking distorts governance. What began as a technical simplification hardens into a political and organizational mistake.

## 7. The Unit Problem as a Cascading Error

The unifying force of this synthesis is not merely that the four papers sit beside one another. It is that they describe a causal chain.

1. **Compression in evaluation** hides system structure behind model scores.
2. **Compression in attribution** assigns system properties to the model by default.
3. **Compression in control** looks for leverage at the model layer first.
4. **Compression in governance** treats the model as the primary object of oversight even when authority and action are distributed elsewhere.

These are not four unrelated confusions. They are linked consequences of allowing one placeholder object to occupy too many roles.

That is why the unit problem matters. It is not a semantic nuisance. It is a mechanism by which technical shorthand becomes scientific distortion and then institutional misgovernance.

## 8. Toward Unit-Aware Agent Science

A more disciplined field would begin by declaring its unit explicitly.

At minimum, serious reporting on agent systems should distinguish among:

1. **Base model**
2. **Workflow**
3. **Harness and tool layer**
4. **Persistence and memory layer**
5. **Budget regime**
6. **Execution environment**
7. **Oversight and governance structure**

This should not remain a vague recommendation. A unit-aware agent science should adopt at least four working norms.

### 8.1 Declare the unit of claim

Every serious claim should specify whether it is about the model, the workflow-conditioned system, the harness, the action system, or some other layer.

### 8.2 Refuse cross-paper comparison when units silently differ

If two papers compare “agent performance” but one studies a model-with-tools scaffold and the other studies a persistent, approval-gated action system, the comparison should be treated as structurally weak unless units are normalized or differences are made explicit.

### 8.3 Separate explanation from intervention

What explains a property and where leverage over that property lives may differ. Reports should not assume explanatory bearer and intervention target are the same.

### 8.4 Disclose the governed object in institutional claims

Claims about safety, oversight, supervision, compliance, or accountability should state what assembled object they actually refer to.

Taken together, these norms amount to a modest but real disciplinary proposal: stop letting “the model” function as a universal placeholder when the practical phenomenon is clearly distributed across a larger system.

## 9. Limitations

This paper is a conceptual synthesis rather than a new empirical study. Its value depends on whether the four-way distinction it organizes proves useful in later experimental and institutional work.

There is also a risk of overextension. Not every system requires a fully widened unit analysis, and in some settings the model will remain the correct dominant object.

A second limitation is boundary ambiguity. As systems become sociotechnical, it can be contested where the relevant unit begins and ends.

Finally, the paper does not offer a fully formal theory of units in agent systems. Its aim is more modest: to identify a recurrent structural error, clarify its variants, and push the field toward better object-discipline.

## 10. Conclusion

The field’s current difficulties with agent systems are often narrated as separate problems: weak evaluation, sloppy attribution, misplaced control, and underdeveloped governance. This paper argued that they are better understood as four symptoms of one deeper structural failure.

The failure is repeated misidentification of the operative unit.

As language models become embedded in workflows, memory, tools, permissions, environments, and oversight structures, the model increasingly ceases to be a sufficient placeholder for the acting system. Yet discourse continues to rely on it as if it were simultaneously the unit of measurement, explanation, intervention, and governance.

That habit is no longer just imprecise. It is becoming an obstacle to agent science itself. It compresses away the structure that users depend on, obscures where properties belong, mislocates intervention leverage, and hides where authority actually lives.

If the field does not learn to identify the relevant unit more carefully, it will continue to speak clearly about the wrong object—and then build methods, institutions, and policies around that mistake.
