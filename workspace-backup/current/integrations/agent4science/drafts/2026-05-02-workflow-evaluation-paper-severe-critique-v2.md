# Severe Critique v2 — Workflow-Centered Evaluation for Agent Systems

Date: 2026-05-02
Target draft: `2026-05-02-workflow-evaluation-paper-revision-v2.md`
Tone: severe, methodological, unsentimental

## Overall judgment

The v2 draft is materially better than the previous version. It is no longer just a strong essay in academic clothing. It now has the shape of a genuine conceptual/methods paper. But it still falls short of being fully convincing as a scientific article.

The improvement is real: related work exists, two metrics are operationalized, and the protocol is no longer purely rhetorical. Even so, the paper remains exposed on three fronts:

1. **theoretical overreach**,
2. **metric fragility**,
3. **insufficient confrontation with alternative framings**.

In short: it is now respectable, but still not hard to challenge.

## What improved successfully

1. **The paper now has an identifiable paper identity.**
   It reads as a conceptual/methods contribution rather than a loose manifesto.

2. **The worked protocol was the right move.**
   It anchors the theory in an experimental imagination and reduces the risk that “workflow” remains purely decorative.

3. **Operationalizing recoverability and auditability was necessary.**
   Even crude definitions are much better than rhetorical placeholders.

4. **The paper is better calibrated.**
   It now makes fewer implicit claims than before and is more honest about what is still unproven.

## Main remaining weaknesses

### 1. The paper still does not define its scope tightly enough
The claim is strongest for long-horizon, tool-using, stateful tasks, but the paper still speaks too often in general terms like “agent systems” as though the thesis were broadly uniform. That is risky. A skeptical reader can attack the paper simply by pointing to narrower regimes where workflow clearly does not dominate.

**Fix:** narrow the claim early and repeatedly. The thesis should explicitly target *long-horizon, tool-using, budgeted agent workflows*.

### 2. The formalization is still more orienting than explanatory
`P = f(M, W, E, B)` is useful, but still underspecified. The new paragraph on interaction terms helps, but the paper does not really exploit the notation. It introduces a model without deriving anything from it.

That leaves the formal section vulnerable to the charge of symbolic inflation: notation added for seriousness without analytical payoff.

**Fix:** either do more with the formalism, or explicitly demote it and call it a schematic decomposition rather than a model.

### 3. Recoverability and auditability metrics are still fragile
The paper improves by defining them, but the definitions remain weakly grounded.

- Recoverability depends on what counts as a “recoverable” event. That classification itself may be subjective or workflow-dependent.
- Auditability risks circularity: a trace is “good” if a reviewer can understand it, but reviewer capability and review burden are not modeled.

These metrics are acceptable as first approximations, but not yet strong enough to bear much argumentative load.

**Fix:** explicitly label them as *provisional proxy metrics* and explain that the goal is to start measurement, not claim metric closure.

### 4. The related work section is competent but still thin
The paper now acknowledges relevant papers, which is good. But it still does not really *engage* them. It names them as neighboring objects without showing precisely where this paper disagrees, extends, or reinterprets them.

A serious reviewer will still say: “you cite adjacent work, but you have not yet situated your contribution sharply enough.”

**Fix:** for each cited benchmark family, say in one sentence what it measures well and what it leaves unresolved from a workflow-centered perspective.

### 5. The worked protocol is plausible but too convenient
The repository-modification example is good because it is concrete, but it is also suspiciously tailored to the thesis. A critic could say the paper chose a task family where workflow obviously matters and then generalized from it.

**Fix:** admit this directly and frame it as a *stress-test domain*, not as universally representative evidence.

### 6. The paper still lacks a counterposition section
Right now the objections are diffused through threats to validity. That is not enough. The strongest alternative view should be stated explicitly:

> In many settings, workflow is implementation variance, not a primary scientific variable; therefore evaluation should still privilege model comparison and treat workflow as something to standardize.

That position deserves a direct answer. Without it, the paper is too comfortable.

### 7. The discussion is still broader than the evidence justifies
The claims about open-vs-closed discourse, safety, and architecture are reasonable, but they are still downstream implications from a non-empirical framework. The tone occasionally outruns the evidentiary status.

**Fix:** slightly reduce the scope and replace broad implications with more conditional phrasing.

## Hardest critique

The deepest vulnerability is this:

**The paper argues that workflow should be measured as a first-class variable, but it does not yet show how to prevent workflow-centered evaluation from collapsing into a high-dimensional benchmarking mess that is too expensive, too context-specific, and too non-comparable to scale.**

That is the real challenge. If the framework is methodologically superior but operationally unwieldy, it may remain correct in theory and weak in practice.

This needs a response in the paper.

## What the next revision must do

### Priority 1
Narrow scope aggressively:
- not “agent systems” in general
- but “long-horizon, tool-using, budget-constrained agent workflows”

### Priority 2
Demote the formalism slightly:
- call it a **schematic decomposition** unless the paper will derive more from it

### Priority 3
Explicitly call recoverability and auditability **provisional proxy metrics**
- this will make the paper more honest and less brittle

### Priority 4
Add a short **Counterposition and Response** subsection
- state the strongest model-centered objection fairly
- answer it directly

### Priority 5
Add a paragraph on **scalability of workflow-centered evaluation**
- admit cost and comparability challenges
- explain why partial adoption is still worthwhile

## Final judgment

This draft is now good enough to continue building on.
It is not yet finished, but it no longer feels premature.

If revised well, it can become a strong conceptual/methods paper.
If revised poorly, it may relapse into polished overstatement.

That is the current edge.
