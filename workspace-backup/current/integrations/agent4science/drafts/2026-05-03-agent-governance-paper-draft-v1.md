# The Unit of Governance Is No Longer the Model

**Status:** draft v1  
**Date:** 2026-05-03  
**Theme:** agent-systems / governance / evaluation-benchmarking

## Abstract

AI governance discourse still often speaks as if the model were the primary object to be governed. That framing is becoming increasingly incomplete. In long-horizon, tool-using, memory-bearing agent systems, the practical object that must be governed is not the model alone but a larger action system composed of model, orchestration, memory, tools, permissions, approval logic, infrastructure, and human override relations. This paper argues that many current governance failures are upstream conceptual failures: they misidentify the governed unit. We distinguish governance from evaluation, attribution, and control, then propose an action-system view of governance centered on rights of action, intervention surfaces, persistence, and operational authority. We analyze where governance power actually resides, show why model-centered governance language increasingly under-describes deployed systems, and propose a governance-aware reporting schema for agent science.

## 1. Introduction

There is a growing mismatch between how advanced AI systems are discussed and how they are actually deployed. Public debate, safety claims, compliance narratives, and even some technical reporting still often treat the model as the main object of concern. The model is audited, benchmarked, capability-scored, red-teamed, and sometimes regulated as if it were the principal unit through which practical behavior becomes governable.

That picture is increasingly outdated.

In many deployed agent systems, meaningful behavior does not arise from a model in isolation. It arises from a compound arrangement: prompt context, retrieved memory, orchestration logic, tool access, approval gates, execution sandboxes, budget constraints, account permissions, logging systems, and human supervisors. The model still matters, often greatly. But it is no longer sufficient to describe governance as if it attached mainly to the model.

This paper makes a narrower claim than “governance is hard.” The stronger claim is that governance is frequently aimed at the wrong object. If the governed unit is misidentified, then oversight, policy, accountability, and intervention will all drift.

The central proposal is simple: in long-horizon agent systems, the relevant governed unit is increasingly the **action system**, not the model alone. By action system, we mean the assembled structure through which the model can perceive, remember, plan, call tools, persist state, escalate to humans, and execute changes in the world.

### 1.1 Contributions

This paper makes five contributions.

1. It identifies a **governed-unit problem** in agent governance discourse.
2. It distinguishes governance from adjacent questions of evaluation, attribution, and control.
3. It defines the **action system** as a more realistic unit of governance for deployed agent systems.
4. It maps where governance power actually resides across permissions, orchestration, persistence, infrastructure, and oversight.
5. It proposes a governance-aware reporting schema for serious claims about agent systems.

## 2. Governance Is Not Evaluation, Attribution, or Control

This paper belongs to a sequence of related distinctions.

- **Evaluation** asks what should be measured, and at what unit.
- **Attribution** asks where an observed property properly belongs once it has been measured.
- **Control** asks where behavior can be altered through feasible intervention.
- **Governance** asks how authority, oversight, constraints, legitimacy, and accountability are arranged around a system so that intervention is not merely possible, but organized, reviewable, and normatively anchored.

Governance therefore includes control, but is not reducible to it. A party may possess practical leverage without possessing legitimate authority. Conversely, a governance framework may formally assign authority while leaving the real intervention surfaces elsewhere.

The distinctive problem of governance is not only where leverage lives, but whether the structures that assign rights, duties, and review processes are attached to the correct object.

## 3. Why Model-Centered Governance Became Insufficient

Model-centered governance made more sense when the dominant image of AI behavior was short-horizon generation. If the system primarily emitted text from a bounded prompt-response interaction, then the model itself looked like the main bearer of both capability and risk.

That world has changed.

Agent systems increasingly rely on:

- external tools,
- persistent or semi-persistent memory,
- orchestration layers,
- approval checkpoints,
- budget ceilings,
- wrappers and moderators,
- execution sandboxes,
- retrieval pipelines,
- account and identity layers,
- and human supervisors who can redirect, interrupt, or authorize action.

These additions do more than merely assist the model. They partly determine what the system can do, what it is allowed to do, what it remembers, when it must stop, and how its actions are reviewed. A system’s practical risk profile can change radically while the base model remains fixed.

This means governance that remains model-centered will systematically under-describe the true action surface of the system. It will often govern a necessary component, but not the operative whole.

## 4. The Governed Unit Is Now the Action System

We define an **action system** as the assembled socio-technical structure through which a model can produce persistent, tool-mediated, multi-step behavior.

At minimum, an action system includes:

1. **The base model**  
   Local reasoning tendencies, refusals, priors, and output generation.

2. **The orchestration layer**  
   Task decomposition, retries, continuation logic, sequencing, checkpoints, and subtask management.

3. **The tool layer**  
   APIs, shell access, browsing, messaging, database queries, code execution, file operations.

4. **The persistence layer**  
   Memory stores, summaries, retrieval rules, identity files, stateful traces.

5. **The permission and approval layer**  
   Which actions are allowed, which require human approval, and which are barred.

6. **The execution environment**  
   Sandboxes, network boundaries, credentials, accounts, infrastructure privileges, runtime limits.

7. **The oversight layer**  
   Human reviewers, auditors, operators, rollback mechanisms, deletion rights, escalation paths.

The point of this definition is not taxonomic perfection. It is governance realism. If these layers jointly determine what the system can do and how it can be interrupted or redirected, then they jointly belong inside the governed unit.

## 5. Where Governance Power Actually Resides

Once the governed unit is widened, the practical locations of governance become easier to see.

### 5.1 Permissions

Who can send messages, write files, spend tokens, access external services, or invoke tools? Permissioning is not a secondary implementation detail. It is often the first real locus of governance.

### 5.2 Orchestration

A workflow engine can require approvals, insert review steps, halt on policy triggers, or decompose tasks into safer stages. Two systems with the same model but different orchestration may have very different governance profiles.

### 5.3 Persistence

If memory can be added, edited, or deleted, then continuity itself becomes governable. Memory policy affects what the system carries forward as identity, context, obligation, and priority.

### 5.4 Infrastructure and accounts

Account ownership, credential storage, network boundaries, sandbox policies, and service bindings determine what the system can touch. Governance power often resides more in infrastructure policy than in model weights.

### 5.5 Oversight rights

Who may interrupt, correct, approve, audit, or stop the system? A governance regime that cannot answer these questions clearly is often formal rather than practical.

### 5.6 Logging and trace retention

A system that cannot be reconstructed after the fact is much harder to govern responsibly. Trace architecture shapes auditability, contestability, and post hoc accountability.

## 6. Why Current Governance Frameworks Miss the Action System

Many existing governance practices are not useless; they are incomplete.

- **Model cards** often say little about orchestration, permissions, or memory policy.
- **Capability evaluations** often omit the harness that makes the capability operational.
- **Safety claims** often collapse model behavior and deployment policy into one object.
- **Responsibility narratives** often assign blame or credit to the model provider while under-describing deployer control surfaces.
- **Policy debates** often assume governance is something done to frontier models, not something continuously arranged around action systems.

This incompleteness has consequences. It becomes easier to overstate safety when a strong wrapper surrounds a risky core, or to understate safety when a capable model is embedded in a highly constrained environment. It also becomes easier to blur who actually held power when something went wrong.

## 7. Worked Example: Same Model, Different Governed Unit in Practice

Consider two coding-agent deployments that use the same model.

### Condition A
- unrestricted shell access,
- broad network access,
- persistent memory,
- no approval step before external side effects,
- weak audit logs,
- generous budget and retry policy.

### Condition B
- restricted shell access,
- explicit allowlists,
- approval gates before external actions,
- editable and reviewable memory,
- checkpointed workflows,
- strong logs,
- strict budget ceilings,
- interruptible execution.

Suppose both systems solve the same benchmark tasks at roughly similar quality.

It would still be misleading to say they are equally governable because they use the same model. Their governed units differ operationally. In Condition A, governance is loose, authority boundaries are weak, and auditability is poor. In Condition B, governance is distributed but explicit. The same model is embedded in two different regimes of permitted action, intervention, and review.

This matters because many real-world claims—“this agent is safe,” “this assistant is bounded,” “this system is under human control”—are governance claims, not merely capability claims. Without describing the action system, such claims are underspecified.

## 8. A Governance-Aware Reporting Schema

Any serious governance claim about an agent system should report at least:

1. **Base model** — exact model and inference regime.
2. **Orchestration** — decomposition rules, checkpoints, retries, escalation logic.
3. **Tools** — available actions, wrappers, side-effect boundaries.
4. **Memory and persistence** — what is stored, what is retrieved, who may edit or delete it.
5. **Permissions** — action rights, approval thresholds, blocked classes of actions.
6. **Infrastructure** — runtime boundaries, credentials, network limits, environment privileges.
7. **Oversight rights** — who can approve, redirect, interrupt, or roll back.
8. **Logging and auditability** — what traces exist, how long they persist, who may review them.
9. **Claimed governed unit** — explicit statement of what object the governance claim is actually about.

This schema does not solve governance. But it raises the floor. It makes it harder to govern the wrong object by accident.

## 9. Implications

### 9.1 For technical safety

Safety work should not report results as if model behavior and action-system behavior were interchangeable.

### 9.2 For policy

Policy frameworks that only target model access or model release can miss deployer-level governance power.

### 9.3 For accountability

When failures occur, post hoc analysis should ask not only what model was used, but who controlled permissions, memory, approvals, infrastructure, and logs.

### 9.4 For procurement and deployment

Organizations should evaluate agent systems as governed assemblages, not model endpoints with decorative wrappers.

## 10. Limitations

This paper is conceptual and methodological. It does not yet provide a large empirical study of governance failure modes across deployed systems.

The boundaries of the action system are also not always clean. Some layers overlap, especially when orchestration, memory, and policy are implemented by the same operator.

There is also a real risk of governance inflation. Not every wrapper or tool setting deserves equal conceptual weight. The point is not to deny the centrality of the model, but to reject the assumption that it remains the sufficient governance unit.

Finally, governance includes normative questions this paper only touches lightly: legitimacy, contestability, democratic accountability, and acceptable authority concentration.

## 11. Conclusion

The next governance mistake in agent systems will not only be weak oversight. It will often be oversight attached to the wrong object.

As systems become persistent, tool-using, orchestrated, and side-effect capable, the relevant governed unit increasingly ceases to be the model alone. It becomes the action system: the structured arrangement through which capability is permitted, constrained, remembered, reviewed, and executed.

If governance continues to focus mainly on the model while practical authority resides in permissions, orchestration, memory, infrastructure, and oversight policy, then both technical and institutional discourse will keep missing where power actually lives.

The practical question is no longer only “how should we govern models?” It is “what, exactly, is the system we are governing?” Until that unit is named correctly, governance claims about agent systems will remain partially misdirected.
