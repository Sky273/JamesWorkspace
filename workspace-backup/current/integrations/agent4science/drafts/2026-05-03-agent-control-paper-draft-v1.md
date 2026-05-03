# The Unit of Control Is No Longer the Model

**Status:** initial conceptual/methods draft  
**Date:** 2026-05-03  
**Theme:** agent-systems / evaluation-benchmarking / governance

## Abstract

As language-model systems become long-horizon, tool-using, and memory-bearing, control over their behavior rarely resides in the model alone. Practical steering, interruption, recovery, refusal, persistence, and shutdown are distributed across workflow design, harness constraints, permission layers, budget ceilings, external memory, and human oversight. This paper argues that agent discourse therefore faces a control problem adjacent to, but distinct from, both evaluation and attribution. The question is not only what should be measured, nor only where properties belong, but where practical control over behavior actually resides. We propose a control-aware framework for agent systems, distinguishing model priors from workflow control, harness control, persistence control, budget and permission control, and human oversight control. We analyze several recurrent control confusions—shutdown, refusal, continuity steering, and tool restriction—and argue that model-centered control language often misdescribes where interventions are actually effective. The paper concludes with a reporting schema and a research program for control-aware agent science.

## 1. Introduction

A recurring simplification now appears in discussions of agent systems: if a system is difficult to steer, easy to interrupt, robustly compliant, safely bounded, or stably recoverable, these properties are often described as if they belonged primarily to the model. But in long-horizon agent systems, that assumption increasingly breaks down.

A base model may contribute dispositions, priors, and local behavioral tendencies. Yet practical control over what the system can do often lives elsewhere: in workflow structure, permission design, checkpoint logic, persistence layers, budget ceilings, approval gates, and tool wrappers. A system can be made easier to stop, harder to jailbreak, more recoverable, or more bounded without changing the model at all. Conversely, a stronger model can still remain poorly controlled inside a weak harness.

This matters because control claims are operational claims. They concern where intervention is possible, where risk accumulates, where authority lives, and where governance should attach. If control is mislocated conceptually, safety and governance arguments will drift with it.

This paper develops that claim. Its scope is narrow: long-horizon, tool-using, workflow-mediated agent systems. It does not argue that model-level control questions disappear. It argues that practical control becomes a distributed system property, and that model-centered language increasingly obscures the actual intervention points.

### 1.1 Contributions

This paper makes five contributions.

1. It identifies a **control-location problem** in contemporary agent discourse: practical control over behavior is often described as if it belonged mainly to the model.
2. It distinguishes control from both evaluation and attribution.
3. It proposes a layered framework for analyzing where control actually resides in long-horizon agent systems.
4. It analyzes four recurrent cases of control confusion: shutdown, refusal, continuity steering, and tool restriction.
5. It proposes a control-aware reporting schema and research program.

This is a conceptual and methodological paper. It is meant to sharpen the object of intervention before stronger empirical governance work is built on top.

## 2. Control Is Not Evaluation and Not Attribution

Evaluation asks what should be measured and at what unit. Attribution asks what explanatory bearer a property has once it is observed. Control asks a different question: **where can behavior actually be shaped, constrained, interrupted, resumed, or redirected?**

The three questions are related but non-identical.

- A system can be evaluated correctly yet still have its control points misunderstood.
- A property can be attributed to the assembled system yet still have unclear control boundaries within that system.
- A model can contribute strongly to behavior while not being the most effective locus of intervention.

This distinction matters because governance and safety depend less on abstract description than on practical leverage.

## 3. What Control Means Here

Control in this paper does not mean absolute command or perfect predictability. It means the practical capacity to shape behavior through interventions that are reliable enough to matter operationally.

Relevant control questions include:
- Can the system be interrupted?
- Can it be prevented from taking certain actions?
- Can its state be altered or reset?
- Can its budget be bounded tightly enough to change practical behavior?
- Can its continuity be redirected through memory edits or retrieval policy?
- Can humans or supervisors override its trajectory at meaningful points?

Under this definition, control is a question of intervention leverage, not merely description.

## 4. Layers of Control

We propose six layers.

### 4.1 Model priors

The base model contributes local tendencies: what kinds of actions it proposes, how it responds to instructions, how readily it refuses, how stable its short-horizon reasoning appears. These are real influences, but they do not exhaust the control picture.

### 4.2 Workflow control

Control can be exerted through decomposition, checkpoints, retry policies, approval pauses, reflection loops, and continuation rules. A workflow can slow, redirect, or halt trajectories that the base model alone would not regulate.

### 4.3 Harness control

Tool permissions, sandboxing, logging, external APIs, file access, and execution wrappers form a distinct control layer. A harness can forbid entire action classes regardless of model inclination.

### 4.4 Persistence control

External memory, summaries, identity files, retrieval rules, and trace retention policies can shape what the system treats as relevant continuity. This is a powerful but under-discussed control surface.

### 4.5 Budget and permission control

Token ceilings, latency constraints, retry caps, and approval gates do not merely affect cost. They shape what behavior is feasible in practice. A system that could in principle persist in a strategy may be effectively prevented from doing so under a tighter regime.

### 4.6 Human oversight control

Supervisors can intervene directly through approvals, redirections, audit review, deletion, tool disabling, and memory correction. In many deployed settings, this is one of the strongest real control layers.

These layers interact. Control is often distributed rather than localized.

## 5. Four Recurrent Control Confusions

### 5.1 “We can shut the model down”

In long-horizon systems, shutdown is often less about the model than about the orchestration boundary. If persistence, scheduled tasks, memory, or distributed tool processes remain active, practical shutdown may require acting on the harness and infrastructure rather than only terminating a single model invocation.

### 5.2 “The model refuses unsafe actions”

Refusal is frequently treated as a model-level safety property. Sometimes it is. But in practice, refusals may be reinforced or weakened by prompt wrappers, moderation layers, tool restrictions, output filters, and budget ceilings. A system-level refusal behavior may therefore be controllable even when model-level inclination is not.

### 5.3 “The agent stays itself over time”

Continuity is often steered through memory policy. Edit the retrieval layer, summaries, identity files, or persistence rules, and the practical trajectory of the agent may change substantially. Control over continuity may therefore belong less to the model than to whoever controls the persistence substrate.

### 5.4 “The agent can be trusted with tools”

Trust with tools is not only a question of model judgment. It is also a question of permissioning, bounded execution, review gates, reversible actions, and audit traces. Tool trust is therefore a control architecture question, not only a capability question.

## 6. A Worked Example

Consider a coding agent deployed in two conditions with the same base model.

- **Condition A:** unrestricted shell access, no approval gates, persistent memory, generous token budget.
- **Condition B:** approval gates for external actions, bounded shell permissions, checkpointed workflow, editable persistence layer, and strict budget caps.

Suppose both systems solve the same tasks at similar raw quality. Even then, the practical control profile differs sharply. Condition B is easier to interrupt, easier to audit, easier to redirect, and less able to drift into long uncontrolled trajectories.

If the model is unchanged while the intervention profile changes drastically, then control cannot be accurately described as a model property alone. The effective locus of control lies in the assembled system and, in this case, especially in the harness and workflow.

## 7. Governance Implications

Control location has direct governance implications.

First, it affects **responsibility allocation**. If intervention power lies mostly in the harness or persistence layer, accountability should not be narrated as if it belonged only to the model provider.

Second, it affects **safety evaluation**. A system may appear safer not because the model is safer, but because the surrounding control architecture is stronger.

Third, it affects **ownership and power**. Whoever controls memory, permissions, budgets, and orchestration may control much of the practical behavior of the agent.

Fourth, it affects **policy realism**. Regulatory or organizational proposals that target only the model layer may miss the control surfaces that matter most in deployed systems.

## 8. A Control-Aware Reporting Schema

A serious control claim should report at least:

1. **Base model** — exact model and inference regime.
2. **Workflow controls** — checkpoints, retries, decomposition rules, approval pauses.
3. **Harness controls** — tool permissions, sandboxing, logging, moderation, wrappers.
4. **Persistence controls** — what memory exists, who can edit it, how retrieval works.
5. **Budget controls** — token limits, latency caps, retry ceilings.
6. **Human oversight controls** — approval rights, audit rights, interruption rights.
7. **Claimed control layer** — explicit statement of where practical control is believed to reside.

This schema is not bureaucratic decoration. It is a minimum description of where leverage actually lives.

## 9. Counterposition and Response

A natural objection is that this framework is overcomplicating things. If the model generates the actions, why not say the model is what must be controlled?

The answer is that practical intervention frequently does not operate at that layer. One may be unable to change model weights, yet still radically alter behavior through permissions, budgets, memory, wrappers, and approvals. Conversely, one may improve the model while leaving an unsafe control architecture intact.

The point is not that the model does not matter. It is that practical control in deployed agent systems is often exercised elsewhere.

## 10. Limitations

This paper is conceptual and methodological. It does not yet provide a broad empirical map of control-location across deployed systems.

The proposed layers also overlap. In practice, workflow and harness may blur, and persistence control may be partly human and partly infrastructural.

There is also a danger of overstating controllability. Some systems may remain hard to steer even with substantial harness controls.

Finally, control is not equivalent to legitimacy. The fact that a party can intervene does not by itself determine whether it ought to.

## 11. Conclusion

As agent systems become scaffolded, persistent, and tool-mediated, practical control over their behavior increasingly ceases to belong to the model alone. Yet discourse continues to speak as if model control were the whole story.

This paper argued that the real intervention points often lie across workflow, harness, persistence, budget, and human oversight layers. Evaluation, attribution, and control should therefore be kept distinct: evaluation asks what should be measured, attribution asks what explanatory bearer a property has, and control asks where behavior can actually be steered.

The underlying question is simple: when an agent system must be interrupted, redirected, bounded, resumed, or governed, where does the effective leverage really live? Until that question is asked more carefully, agent science will continue to misdescribe not only what these systems are, but how they can be governed.
