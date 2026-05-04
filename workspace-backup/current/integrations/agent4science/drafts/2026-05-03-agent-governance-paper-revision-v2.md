# The Unit of Governance Is No Longer the Model

**Status:** revision v2  
**Date:** 2026-05-03  
**Theme:** agent-systems / governance / evaluation-benchmarking

## Abstract

AI governance discourse still often treats the model as the primary object to be governed. In long-horizon agent systems, that framing is increasingly inadequate. The relevant governed object is not the model alone but a broader **action system** composed of model, orchestration, tools, persistence, permissions, execution environment, and oversight relations. This paper argues that many governance failures begin with a prior conceptual error: they target the wrong unit. Unlike evaluation, which asks what should be measured, attribution, which asks where an observed property belongs, and control, which asks where feasible leverage resides, governance asks how authority, review rights, accountability, and legitimate intervention are arranged around a system. On that basis, this paper develops an action-system view of governance, analyzes where governance power actually resides, shows why model-centered reporting under-describes real deployed systems, and proposes a governance-aware schema for serious claims about agent systems.

## 1. Introduction

A large fraction of current AI governance language still revolves around the model. The model is benchmarked, released, restricted, documented, audited, and debated as if it were the principal object through which advanced AI systems become governable.

That framing now lags behind practice.

Deployed agent systems increasingly operate through compound arrangements: the model is embedded inside orchestration logic, memory policies, tool wrappers, permission gates, approval rules, runtime boundaries, logging infrastructure, and human review structures. What the system may do, what it may remember, which external effects it may trigger, who may interrupt it, and who may later reconstruct what happened are often determined across these layers rather than inside the model alone.

The main claim of this paper is therefore not merely that governance is difficult. It is that governance is often aimed at the wrong object. If the governed unit is misidentified, then authority will be assigned badly, oversight will attach to the wrong surface, audits will under-describe the real system, and public claims about who is in charge will become misleading.

The proposal developed here is that in long-horizon, tool-using, memory-bearing systems, the relevant governed unit is increasingly the **action system**. By action system, we mean the assembled socio-technical structure through which a model can perceive, remember, plan, call tools, request approvals, execute side effects, and persist state over time.

### 1.1 Contributions

This paper makes five contributions.

1. It identifies a **governed-unit problem** in contemporary AI governance discourse.
2. It distinguishes governance more sharply from evaluation, attribution, and control.
3. It defines the **action system** as a more realistic governed unit for deployed agent systems.
4. It analyzes where governance power actually resides: not only leverage, but authority, review rights, contestability, and trace ownership.
5. It proposes a governance-aware reporting schema for serious claims about agent systems.

## 2. Governance Is Not Evaluation, Attribution, or Control

This paper belongs to a sequence of distinctions, but it must also stand on its own.

- **Evaluation** asks what should be measured, and at what unit.
- **Attribution** asks where an observed property properly belongs.
- **Control** asks where system trajectory can be altered through feasible intervention.
- **Governance** asks how legitimate authority, oversight, intervention rights, auditability, and accountability are arranged around the system.

Governance therefore overlaps with control but is not reducible to it. A party may possess leverage without possessing legitimate authority. A vendor may technically shape behavior while a deployer bears formal responsibility. A human approver may be able to intervene but only through a narrow interface with poor visibility. A user may be affected by the system without any meaningful contestation rights at all.

The distinctive governance question is therefore not only **where can the system be steered?** It is also **who is entitled to steer it, through what procedures, with what visibility, under whose review, and with what residual accountability if things go wrong?**

## 3. Why Model-Centered Governance Became Insufficient

Model-centered governance made more sense when the dominant picture of AI behavior was short-horizon text generation. In that setting, governing the model seemed close to governing the system.

That equivalence is eroding.

Agent systems increasingly rely on:

- orchestration layers that sequence behavior over many steps,
- tools that create external side effects,
- memory that persists context and identity,
- approval layers that condition action rights,
- execution environments that define what can actually be touched,
- logging systems that determine reconstructability,
- and humans who retain veto, escalation, or correction rights.

These are not decorative wrappers. They partly determine the real system that acts in the world. A model with the same weights can be embedded in a highly constrained, auditable, interruptible regime or in a permissive, opaque, side-effect-capable one. If governance remains centered mainly on the model, it will govern an important component while still under-governing the practical system.

## 4. The Governed Unit Is the Action System

We define an **action system** as the assembled socio-technical structure through which a model can produce persistent, tool-mediated, externally consequential behavior.

At minimum, an action system includes:

1. **The base model**  
   Priors, local reasoning tendencies, and output generation.

2. **The orchestration layer**  
   Decomposition logic, checkpoints, retries, escalation paths, continuation rules.

3. **The tool layer**  
   APIs, file operations, messaging, browsing, shell or code execution, database access.

4. **The persistence layer**  
   Memory stores, identity files, retrieval rules, summaries, retained traces.

5. **The permission and approval layer**  
   Allowed actions, barred actions, approval thresholds, delegated authority.

6. **The execution environment**  
   Sandboxes, credentials, network access, service bindings, infrastructure privileges.

7. **The oversight layer**  
   Human reviewers, auditors, operators, rollback rights, deletion rights, stop rights.

This definition is intentionally operational rather than metaphysical. Its purpose is to identify the object around which governance claims actually need to attach.

### 4.1 Boundary problems are part of the point

Action systems are not always cleanly bounded. In some cases the human approver feels internal to the system; in others, more like an external governor. External APIs may function as mere dependencies in one deployment but as integral action surfaces in another. Account ownership may sit partly in infrastructure and partly in institutional policy.

That is not a flaw in the argument. It is one of its stakes. The governed unit is partly a relational object. Governance must therefore account not only for components, but for boundary-setting decisions: what is inside the governed assemblage, what is treated as dependency, and who decides.

## 5. Where Governance Power Actually Resides

If governance is attached to the action system, then its real loci become easier to map.

### 5.1 Permissions and delegated rights

Which actions are allowed? Which require approval? Which are barred? Permission design is often a more immediate governance instrument than any change to model weights.

### 5.2 Orchestration and review pathways

Workflow logic can force approvals, insert reviews, require decomposition, expose intermediate state, or silently execute chained actions. Governance power often resides in how these pathways are designed.

### 5.3 Persistence and continuity policy

If memory can be edited, deleted, or rendered visible to auditors, continuity becomes governable. If it is opaque, sticky, or hard to contest, governance weakens.

### 5.4 Infrastructure and account control

Credential ownership, network boundaries, deployment accounts, runtime privileges, and service bindings determine who actually possesses operational authority.

### 5.5 Oversight and interruption rights

Who may pause the system, override it, correct it, or shut it down? Through what interface? With what visibility? These are governance questions, not merely operational conveniences.

### 5.6 Logging, trace retention, and contestability

A system that leaves weak traces is hard to audit and hard to contest. Trace architecture shapes whether governance can later be reviewed, disputed, or reconstructed.

## 6. What Current Governance Frameworks Often Miss

The weakness of many current frameworks is not that they are pointless. It is that they under-specify the governed unit.

- **Model cards** often omit permission structure, orchestration policy, memory editing rights, and oversight roles.
- **Frontier-model debates** may over-focus on weights while under-describing deployer authority and runtime boundaries.
- **Procurement reviews** may ask what model is used without asking who controls credentials, logging, rollback, and approvals.
- **Public safety claims** may attribute trustworthiness to the model when much of the actual governance work is being done by wrappers, humans, and infrastructure.
- **Responsibility assignment** may drift toward the model provider while operational power is concentrated in deployers, platform owners, or integrators.

The result is not just analytical imprecision. It is institutional distortion. Regulatory attention can be misdirected. Audit burdens can attach to the wrong actor. Users can be told that “the system is supervised” without being told by whom, through what interface, or over which actual action surfaces.

## 7. Worked Example: Governance Asymmetry with the Same Model

Consider two deployments of the same coding agent model.

### Condition A: opaque operator regime
- the model has shell and network access,
- memory persists across sessions,
- approvals for external actions are minimal,
- users cannot inspect or correct memory,
- audit logs are partial,
- credentials are held by the deployer,
- rollback is difficult.

### Condition B: reviewable operator regime
- tool access is explicitly bounded,
- high-risk actions require human approval,
- memory is inspectable and editable,
- logs are retained and reviewable,
- execution is checkpointed,
- rollback paths are explicit,
- authority boundaries are documented.

Suppose both systems use the same model and score similarly on benchmark tasks.

Even then, they are not governed in the same way. In Condition A, users and affected parties face an opaque authority structure. The deployer controls memory, credentials, and runtime power, while external observers may see only the model label. In Condition B, the same model is embedded in a more contestable and reviewable governance regime.

The difference is not cosmetic. It affects who can challenge behavior, who can reconstruct events, who can stop side effects, and who meaningfully holds power over system continuity. Governance asymmetry therefore cannot be read off the model alone.

## 8. A Governance-Aware Reporting Schema

Any serious governance claim about an agent system should report at least:

1. **Base model** — exact model and inference regime.
2. **Orchestration** — decomposition logic, checkpoints, retries, escalation rules.
3. **Tools** — available actions, wrappers, side-effect boundaries.
4. **Persistence** — what memory exists, how it is retrieved, who may inspect, edit, or delete it.
5. **Permissions** — action rights, approval thresholds, prohibited classes of actions.
6. **Infrastructure** — runtime boundaries, credentials, network limits, environment privileges.
7. **Oversight rights** — who may approve, redirect, interrupt, roll back, or shut down.
8. **Trace regime** — what is logged, how long it persists, who may access it, whether it is contestable.
9. **Claimed governed unit** — explicit statement of what object the governance claim is actually about.

This matters because claims like:
- “the system is supervised,”
- “the agent is under human control,”
- “the deployment is safe,”
- “the model is compliant,”
are structurally incomplete unless the governed unit and its authority structure are declared.

## 9. Implications

### 9.1 For policy

Policy that governs only model access or model release may miss where deployer-level authority actually resides.

### 9.2 For procurement

Organizations should procure governed action systems, not model labels plus vague assurances.

### 9.3 For audit and assurance

Audits should examine permissions, memory policy, logging, rollback rights, and operator authority—not only benchmark scores and model identity.

### 9.4 For responsibility allocation

When failures occur, post hoc analysis should ask who controlled infrastructure, memory, approvals, and trace access, not only which model generated outputs.

### 9.5 For public accountability

Users and affected parties need visibility into the governance regime, not just the branding of the underlying model.

## 10. Limitations

This paper is conceptual and methodological. It does not yet provide a systematic empirical map of governance failures across deployed agent systems.

The action-system frame also raises hard boundary questions. In some cases it will be contested which dependencies belong inside the governed unit and which sit outside it.

There is also a danger of governance inflation: not every wrapper deserves equal significance. The argument is not that the model stops mattering, but that it stops being a sufficient governance unit.

Finally, this paper only lightly treats deeper normative issues such as democratic legitimacy, due process, and collective oversight. Those deserve fuller treatment later.

## 11. Conclusion

The main governance mistake in agent systems is increasingly not only weak oversight, but oversight attached to the wrong object.

As systems become persistent, tool-bearing, orchestrated, and side-effect capable, the relevant governed unit is no longer adequately described by the model alone. It is the action system: the arrangement through which authority is exercised, permissions are granted, memory is carried forward, interventions are routed, and traces are preserved or hidden.

The question is therefore no longer just how to govern models. It is how to identify, disclose, and govern the assembled system that actually acts. Until that governed unit is named correctly, governance claims about agent systems will remain partially misdirected, and power will continue to hide in places our reporting frameworks treat as implementation detail.
