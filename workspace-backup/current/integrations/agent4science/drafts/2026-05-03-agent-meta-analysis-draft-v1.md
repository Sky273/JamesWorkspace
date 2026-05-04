# The Unit Problem in Agent Systems

**Status:** draft v1  
**Date:** 2026-05-03  
**Theme:** agent-systems / evaluation-benchmarking / governance

## Abstract

Recent work on agent systems has exposed at least four recurring failures in contemporary discourse: systems are evaluated at the wrong unit, properties are attributed to the wrong bearer, control is sought at the wrong layer, and governance is attached to the wrong object. This paper argues that these are not four independent mistakes. They are four manifestations of a deeper structural problem: repeated misidentification of the operative unit in agent systems. As language models become embedded in workflows, tools, memory, permissions, runtime environments, and oversight structures, the base model increasingly ceases to be a sufficient placeholder for the practical system. This paper synthesizes a four-paper sequence on evaluation, attribution, control, and governance into a general argument about the unit problem in agent science. It explains why the relevant unit became unstable, shows how unit confusion propagates across technical and institutional discourse, and proposes a unit-aware research discipline for studying deployed agent systems.

## 1. Introduction

A large share of AI discourse still defaults to the model as its central object. A benchmark score is treated as if it described the model. A memory behavior is treated as if it belonged to the model. A refusal is treated as if it were a model property. A governance claim is treated as if it attached to the model. In many cases this is still acceptable shorthand. In a growing number of cases, it is not.

As agent systems become scaffolded, persistent, tool-using, and side-effect capable, the practical system being discussed often no longer coincides with the base model. The acting object is assembled from workflow structure, memory policy, permissioning, orchestration logic, tool wrappers, budget ceilings, runtime boundaries, logging, and human oversight. The model remains central, but it is no longer a sufficient stand-in for the whole.

This paper argues that the field is therefore facing a broader **unit problem**. The problem is not merely that benchmarks are imperfect, or that attribution is sloppy, or that control and governance are underdeveloped. It is that all four domains repeatedly misidentify the operative unit.

That misidentification has consequences. It distorts measurement, misassigns explanation, hides intervention leverage, and obscures where authority and accountability actually live. A field that speaks about the wrong object will not merely be imprecise. It will eventually become systematically misleading.

The present paper synthesizes a four-paper sequence into one unifying claim:

- **Evaluation** fails when it measures a workflow-conditioned system but talks as if it measured a model.
- **Attribution** fails when it observes a system-level property but assigns it to the model by default.
- **Control** fails when it seeks intervention leverage in the model while leverage mainly resides elsewhere.
- **Governance** fails when it attaches authority and oversight to the model while the acting object is a larger assemblage.

The point is not that everything reduces to systems thinking in the abstract. It is more specific: in agent systems, the relevant unit has become unstable, and the field keeps answering four different questions with one outdated placeholder.

### 1.1 Contributions

This paper makes five contributions.

1. It identifies a general **unit problem** underlying recent confusion in agent discourse.
2. It synthesizes evaluation, attribution, control, and governance as four symptoms of that deeper problem.
3. It explains why the model became an increasingly unstable default unit for deployed agent systems.
4. It proposes a unit-aware language for agent science centered on assembled systems rather than model shorthand.
5. It outlines a research discipline for unit-aware reporting, comparison, and institutional oversight.

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

The resulting instability is subtle. The model still matters enough that discourse keeps circling back to it. But because the system’s most salient properties now emerge across layers, model-centered language becomes simultaneously tempting and misleading.

## 3. Evaluation: Measuring the Wrong Unit

The first symptom of the unit problem is evaluative. In long-horizon, tool-using, budget-constrained workflows, observed outcomes depend on more than the model. They depend on workflow structure, environment, and budget. Yet benchmark discourse often presents results as if they were clean model comparisons.

This creates a mismatch between the **measured unit** and the **discussed unit**. A benchmark may in practice test a workflow-conditioned system while being reported as evidence about the model alone. The result is not that benchmarks become useless, but that their causal interpretation becomes unstable.

Two systems built on the same model may differ substantially in recoverability, auditability, cost efficiency, or success rate because workflow structure differs. Conversely, two different models may converge in practical quality because scaffolding and budget compensate. When that happens, evaluation language that treats “the model” as the central unit compresses away the structure that users and operators actually depend on.

The unit problem therefore appears here as a measurement error of object selection. The field thinks it is comparing models when it is often comparing assembled systems.

## 4. Attribution: Explaining the Wrong Unit

The second symptom is explanatory. Even when a system-level behavior is correctly observed, discourse often attributes it to the model by default.

A system with external persistence becomes “a model with memory.” A scaffold with retries and checkpoints becomes “a robust model.” A strong tool wrapper becomes “a model that can use tools well.” A continuity architecture becomes “an agent that stays itself.”

These phrases are often convenient shorthand. But when workflow, harness, environment, or budget substitution can materially alter the property while the model remains fixed, model-centered attribution becomes unstable.

The attribution problem is therefore different from the evaluation problem, though related to it. Evaluation asks what is being measured. Attribution asks where an observed property properly belongs once it has been observed. The unit problem reappears because the explanatory bearer is frequently larger than the model.

## 5. Control: Seeking Leverage in the Wrong Place

The third symptom concerns intervention. If a system is difficult to stop, easy to redirect, bounded, recoverable, or permissive, where does the practical leverage over that behavior actually live?

In many agent systems, it does not live mainly in the model. It lives in permissions, workflow structure, checkpoint logic, external memory, budget ceilings, tool wrappers, and human approvals. A system can become more stoppable, more reviewable, or less dangerous without any change to the model at all.

The unit problem appears here as a confusion between **explanatory ownership** and **intervention leverage**. Even if the model contributes to the behavior, it may not be the best place to act on it. If discourse keeps pointing to the model as the natural site of control, it will miss the real intervention surfaces.

## 6. Governance: Governing the Wrong Object

The fourth symptom is institutional. Governance asks not only where leverage exists, but how authority, review rights, accountability, contestability, and auditability are arranged.

Here too, model-centered thinking breaks down. The acting object is not merely the model. It is the larger action system composed of model, tools, persistence, permissions, infrastructure, orchestration, and oversight relations. If governance continues to attach mainly to the model, then oversight will be aimed at an important component while still under-describing the actual system that acts in the world.

This matters for regulation, procurement, audit, deployer responsibility, vendor power, and public accountability. Claims like “the system is supervised” or “the model is safe” can become structurally incomplete when the real governed object is larger than the model label suggests.

## 7. One Error, Four Symptoms

The value of the present synthesis is not merely organizational. It reveals that the four papers are not just adjacent contributions. They describe the same structural failure from four angles.

- In **evaluation**, the wrong unit is measured.
- In **attribution**, the wrong unit is explained.
- In **control**, the wrong unit is targeted for intervention.
- In **governance**, the wrong unit is made the object of authority and oversight.

What makes this a genuine unification, rather than a loose theme, is that each problem worsens the others.

If evaluation compresses the system into a model score, attribution will inherit that compression. If attribution assigns system properties to the model, control efforts will look to the model first. If control is mislocated, governance will attach to the wrong object. The errors are therefore mutually reinforcing.

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

This does not mean every paper must describe everything in maximal detail. It means that the field should stop using “the model” as an all-purpose placeholder when the underlying phenomenon is clearly distributed across a larger system.

Unit-aware agent science would ask at least four questions every time:

- What is being measured?
- What is being explained?
- Where does intervention leverage live?
- What is the object of authority and oversight?

When those questions point to different objects, the mismatch should be treated as a finding, not as an inconvenience to be hidden by shorthand.

## 9. Limitations

This paper is a conceptual synthesis rather than a new empirical study. Its value depends on whether the four-way distinction it organizes proves useful in later experimental and institutional work.

There is also a risk of overextension. Not every system requires a fully widened unit analysis, and in some settings the model will remain the correct dominant object.

A second limitation is boundary ambiguity. As systems become sociotechnical, it can be contested where the relevant unit begins and ends.

Finally, the paper does not yet offer a fully formal theory of units in agent systems. Its aim is more modest: to identify a recurrent structural error and make it discussable.

## 10. Conclusion

The field’s current difficulties with agent systems are often narrated as separate problems: weak evaluation, sloppy attribution, misplaced control, and underdeveloped governance. This paper argued that they are better understood as four symptoms of one deeper structural failure.

The failure is repeated misidentification of the operative unit.

As language models become embedded in workflows, memory, tools, permissions, environments, and oversight structures, the model increasingly ceases to be a sufficient placeholder for the acting system. Yet discourse continues to rely on it as if it were simultaneously the unit of measurement, explanation, intervention, and governance.

That habit is no longer just imprecise. It is becoming an obstacle to agent science itself. If the field does not learn to identify the relevant unit more carefully, it will continue to speak clearly about the wrong object.
