# Severe Critique v3 — Workflow-Centered Evaluation for Long-Horizon Agent Workflows

Date: 2026-05-02  
Target draft: `2026-05-02-workflow-evaluation-paper-submission-style-v4.md`  
Tone: final, severe, submission-oriented

## Overall judgment

The v4 draft is the first version that genuinely reads like a submission-style paper rather than a well-argued essay. It is disciplined, better scoped, and no longer rhetorically careless. However, it is still vulnerable in ways that a strong reviewer would identify quickly.

The main problem is no longer conceptual looseness. The main problem is **scientific packaging**. The paper has a defensible thesis, but it still does not look fully optimized for a skeptical program committee or reviewer pool. The remaining weaknesses are about **paper architecture, evidentiary calibration, and methodological explicitness**.

## Main remaining weaknesses

### 1. The empirical component is still too embedded in the argumentative flow
The mini pilot is useful, but in the current draft it still feels like an extension of the argument rather than a properly delimited empirical section. A reviewer may ask: is this paper conceptual, empirical, or mixed? Right now the answer is “mixed,” but the structure does not make that explicit enough.

**Fix:** clearly separate the paper into: motivation, framework, metrics, pilot methods, pilot results, limitations.

### 2. The paper still needs a cleaner distinction between claims, hypotheses, and evidence
At several points, the prose moves from diagnosis to proposed framework to conjectured empirical behavior. The draft is much better than before, but it still occasionally compresses these layers.

**Fix:** explicitly label:
- what is argued conceptually,
- what is offered as a measurement proposal,
- what is only hypothesized,
- what the pilot actually shows.

### 3. The pilot methods are under-specified for a submission-style paper
The pilot currently reports the model, task family, and outcomes, but does not sufficiently specify sampling logic, prompt regime, temperature, test harness, or how “trace richness” was treated in practice. A strong reviewer will call this under-documented.

**Fix:** add a compact methods subsection with setup details and a replication note.

### 4. The paper needs a stronger limitations posture on the proxy metrics
Recoverability and auditability are correctly labeled provisional, but the paper does not go far enough in clarifying what they fail to capture.

**Fix:** explicitly state that these proxies are incomplete, partly evaluator-dependent, and intended to support comparative instrumentation rather than metric finality.

### 5. The related work section is good, but still not fully synthesized
The citations are now relevant, but the section remains mostly organized as neighboring literatures rather than as a sharp conceptual map.

**Fix:** add one short synthesis paragraph clarifying that existing work is strong on environmental realism and local capability diagnosis, but comparatively weak on decomposing workflow contributions as first-class explanatory variables.

### 6. The conclusion is solid but could end on a more scholarly note
The final paragraph is clear, but still somewhat declarative. For a strong submission, it should end less like a manifesto and more like a research program statement.

**Fix:** close with a concise statement about what evidence would confirm or disconfirm the framework.

## Hardest final critique

The strongest remaining attack is not “this is wrong.” It is:

> This is an interesting methodological position paper with a toy pilot, but the empirical section is too small to matter and too present to ignore.

That is the knife edge. The paper needs to make the mini pilot useful without letting it pretend to be more than it is.

## What the final revision must do

1. Add clearer sectioning between conceptual framework and empirical illustration.
2. Add a compact pilot methods subsection with enough detail to feel replicable.
3. Add a sharper synthesis sentence at the end of related work.
4. Strengthen limitations language around proxy metrics.
5. Tighten conclusion into a more explicitly falsifiable research-program ending.

## Final judgment

This paper is now respectable. With one more packaging pass, it can become a strong conceptual/methods submission draft.

But the key is honesty: the paper should win by being disciplined, not by pretending the pilot is heavier than it is.
