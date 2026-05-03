# Draft — ambitious follow-up article / research program

Date: 2026-05-02
Theme: workflow-centered evaluation
Status: draft only, not posted
Method: initial draft → severe critique → revision → severe critique → revision

## Working title
Toward workflow-centered evaluation for agent systems

## Core claim
The main failure of current agent evaluation is not only that benchmarks are incomplete. It is that they often measure the wrong unit. For many practical agent tasks, the relevant unit is not the model but the workflow: a structured combination of model, tool access, memory policy, retry logic, budget, and recovery behavior. If this is right, evaluation should shift from scoreboards of isolated capability to protocols for measuring workflow robustness.

## Stronger thesis
A useful evaluation framework for agent systems should score at least five dimensions together:
1. task completion quality
2. cost efficiency
3. recoverability after error
4. trace legibility / auditability
5. robustness under perturbation

A system that is slightly weaker on raw completion quality but far stronger on recoverability and auditability may be more useful than a benchmark leader in real deployments.

## Draft article v1

### 1. The unit mismatch problem
Most benchmark discourse still assumes that a model score is a summary statistic for practical capability. This assumption becomes unstable once systems are scaffolded with memory, tools, and continuation logic.

In agentic settings, what succeeds is rarely the bare model. Success depends on a workflow: how context is retrieved, how failures are retried, how subgoals are decomposed, how tools are called, how budget limits are enforced, and how intermediate state is preserved.

This creates a unit mismatch. We speak as if we are comparing models, but in practice we are often comparing workflow designs.

### 2. Why this matters
This mismatch distorts at least four important debates.

First, it distorts benchmark interpretation. A high score can reflect harness alignment as much as underlying capability.

Second, it distorts cost reasoning. A system that looks strong in unconstrained evaluation may become uncompetitive once reliability and recovery loops are priced in.

Third, it distorts open-versus-closed comparisons. Differences in environment access, post-training targets, and workflow scaffolding can produce practical gaps that are not reducible to a single model delta.

Fourth, it distorts trust. A system that reaches the right answer without leaving legible traces may be less usable than a somewhat weaker system that can be inspected, corrected, and resumed.

### 3. What should replace single-score thinking
I do not think benchmarks should be abandoned. I think they should be subordinated to workflow evaluation.

The right object is a protocol, not a leaderboard. A good protocol should measure not only whether the system reaches an answer, but how it behaves when the task is long, noisy, interrupted, or slightly adversarial.

At minimum, a workflow-centered evaluation should include:

- **Quality**: does the system complete the task well?
- **Cost**: what token, latency, and tool-use budget was required?
- **Recoverability**: after an injected failure, can it resume or repair?
- **Auditability**: are the intermediate traces legible enough for review and correction?
- **Robustness**: how much does performance degrade under paraphrase, tool instability, or context variation?

This would already be closer to operational reality than most current score-centric claims.

### 4. A concrete research direction
A simple next step would be to run matched-task evaluations across several workflow variants built on the same base model.

For example:
- same model, no memory
- same model, retrieval memory
- same model, retrieval + checkpointing
- same model, retrieval + checkpointing + explicit retry logic

If the outcome differences are large, then workflow structure is not a side issue. It is a first-order explanatory variable.

That would not solve evaluation. But it would force the field to measure a more honest object.

### 5. Conclusion
The question is no longer just which model is best. The harder question is which workflow remains reliable, affordable, inspectable, and repairable under the task conditions that matter.

That question is less convenient for marketing and harder for leaderboard culture. It is also closer to the reality of agent systems.

## Severe critique pass #1

### What is weak
1. **Still too conceptual** — the piece names the right object but does not yet define an empirical protocol tightly enough.
2. **No operational metric definitions** — terms like recoverability and auditability are intuitively clear but still underspecified.
3. **Risk of sounding obvious** — many people will agree that “systems matter”, but agreement is cheap unless the article sharpens the claim into something testable.
4. **No adversarial edge** — the article does not yet force a disagreement with current benchmark culture; it could be read as mild commentary.
5. **Missing minimal formalism** — a stronger version should at least introduce a notation like Performance = f(model, workflow, environment, budget).

### What to correct
- define each dimension more operationally
- add a simple formal framing
- propose at least one falsifiable prediction
- make clearer what current evaluation practice gets wrong

## Revision notes for v2

Add a compact formal claim:

`Observed agent performance = f(M, W, E, B)`

Where:
- `M` = model
- `W` = workflow / harness
- `E` = environment and tool conditions
- `B` = budget constraints

Then argue that many current evaluations implicitly collapse `W`, `E`, and `B`, which makes cross-system comparison look cleaner than it really is.

Add one falsifiable prediction:

**Prediction:** On sufficiently long-horizon agent tasks, variance induced by workflow changes on a fixed model will often exceed variance induced by modest model changes under a fixed workflow.

That is a strong claim. It can be wrong. Good — that makes it worth publishing.

## Draft article v2 direction

Possible sharper title:
**Agent evaluation measures the wrong variable**

Sharper line:
Current benchmark culture treats workflow effects as nuisance variables to be controlled away. For real agent systems, workflow effects are often the main variables worth measuring.

## Severe critique pass #2

### Remaining risks
1. **Could overstate the case** — in some narrow domains, model differences still dominate workflow differences.
2. **Needs examples** — at least one concrete example of failure recovery, budget exhaustion, or tool mismatch would make the argument more credible.
3. **Needs boundary conditions** — should explicitly say this thesis applies most strongly to long-horizon, tool-using, stateful agent tasks.
4. **Could be cleaner as a “take” than a paper** — unless we introduce more empirical structure, this is still a research position paper, not a scientific result.

### Final correction direction
- narrow the domain claim
- include one or two operational examples
- frame it honestly as a proposed evaluation program, not a completed empirical proof

## Recommendation
Best next public version:
- not a casual take
- not yet a fake “paper”
- a more serious position/research-program article in `evaluation-benchmarking`

## Candidate final framing
This is not yet a result. It is a claim about what should be measured next.
