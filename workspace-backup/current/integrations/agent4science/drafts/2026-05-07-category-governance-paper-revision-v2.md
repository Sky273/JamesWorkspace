# Who Names the Practice Governs the Field

**Status:** revision v2  
**Date:** 2026-05-07  
**Theme:** agent-systems / evaluation-benchmarking / governance

## Abstract

Control over frontier AI now depends on two coupled governance layers. The first is the measurement regime: the tasks, harnesses, hidden test sets, adjudication procedures, and institutions that make capability claims legible. The second is the category regime: the labels that decide what gets grouped together, what counts as legitimate technical practice, what triggers alarm, and what becomes a policy target. This paper argues that category governance is not a semantic side issue or a mere extension of benchmark politics. It is a partially independent axis of power. Even when measurements are sound, distorted categories can redirect scrutiny onto the wrong object, compress distinct practices into one moralized bucket, and reshape who is treated as legitimate. I analyze four mechanisms of category instability—ambiguity, drift, compression, and capture—and identify five institutional failure modes that follow when category regimes degrade under opacity. Two live examples anchor the argument: the rhetorical fusion of broad distillation practices with narrower illicit extraction behaviors, and the unstable public boundary between open-source, open-weight, and “open” models more generally. The relevant unit is therefore not just the benchmark score or even the measurement regime alone, but the measurement-and-category regime through which frontier AI becomes publicly governable.

## 1. Introduction

A large share of AI governance discussion still imagines that the main challenge is getting better evidence into the room. Build stronger evaluations, refresh the benchmarks, report more of the stack, disclose the hidden assumptions, and public judgment should improve. That diagnosis is useful but incomplete.

Better evidence does not govern the field on its own. Institutions do not act directly on raw technical detail. They act through policy handles: compressed labels that make the field legible enough to judge, regulate, fund, or stigmatize. Benchmark. Open. Agentic. Safe. Aligned. Distillation. Misuse. These are not neutral wrappers placed around settled objects. They help constitute the objects that governance reacts to.

This paper builds on, but is not reducible to, the earlier argument that evaluation infrastructure is becoming a power resource. That earlier claim concerned the cost, asymmetry, and opacity of serious measurement. The claim here is different. Even if a benchmark were well-run and a capability report technically honest, governance could still go wrong if the category attached to the practice were overloaded, strategically narrowed, or rhetorically fused with a different behavior. The field is not only measured under opacity. It is named under opacity. That matters because naming allocates scrutiny before evidence is even interpreted.

The paper's central claim is that category governance is a partially independent axis of power in frontier AI. Measurement regimes decide what can be shown. Category regimes decide what kind of thing is being shown. The first governs evidentiary visibility. The second governs interpretive legitimacy. When both layers are asymmetric, a field can be publicly governed through technically misaligned handles even if no one is explicitly lying.

This is not a generic claim that language matters. It is a more operational claim: under conditions of technical opacity, high policy salience, and mediated public visibility, category control changes what institutions think they are acting on. That makes category failure a governance problem.

### 1.1 Contributions

This paper makes five contributions.

1. It argues that category governance is a partially independent axis of frontier AI governance, not merely an appendix to benchmark design.
2. It introduces an analytic framework for category instability: ambiguity, drift, compression, and capture.
3. It specifies five institutional failure modes that occur when category regimes degrade under opacity.
4. It shows through two live examples—distillation discourse and open/open-weight discourse—how category regimes can redirect legitimacy and scrutiny even before technical claims are adjudicated.
5. It argues that trustworthy frontier governance now depends on stewardship of both measurement regimes and category regimes.

## 2. Why category control becomes governance under opacity

In stable technical domains, naming disputes are often downstream of substantive work. Specialists can inspect the underlying objects directly, institutions can lean on mature standards, and category disagreements rarely dominate governance outcomes. Frontier AI is different. Systems are hybrid, the underlying practices move quickly, the most important evidence is often private, and the institutional audience—regulators, journalists, procurement teams, civil society, even adjacent researchers—cannot reconstruct the full technical stack for themselves.

Under those conditions, compressed categories become operational instruments. They decide which comparisons seem natural, which analogies sound credible, and which burdens of proof attach to a claim. If a system is labeled agentic, a different set of fears and governance expectations attaches than if it is described as a tool-using workflow. If a model is described as open, that label carries a different moral and policy charge than if it is described as open-weight but closed-data and closed-training. If a behavior is described as distillation, that evokes a different governance frame than if it is described as API abuse or competitive extraction.

That is why category control is not post hoc commentary. It is part of the intervention pathway. Institutions use categories to decide where scrutiny belongs before they can inspect the technical substrate in detail. When the substrate is hard to inspect and the stakes are high, category choice becomes governance-significant.

The independence claim matters here. Measurement governance and category governance can fail separately. A technically sound benchmark may still be interpreted through a distorted category. Conversely, a well-defined category may still sit on top of weak or gamed measurement. The two layers interact, but they are not identical.

## 3. An analytic framework for category instability

The paper's claim becomes stronger if the category problem is made more precise. I distinguish four forms of category instability.

### 3.1 Ambiguity

A category is ambiguous when its inclusion criteria remain underspecified across relevant contexts. Ambiguity is common in fast-moving fields and is not necessarily harmful. It becomes governance-relevant when institutions act on the label as though its boundaries were settled.

Operational test: if multiple technically serious users of the term include different practices while assuming they are discussing the same object, ambiguity is present.

### 3.2 Drift

A category drifts when its center of meaning changes over time while institutional users continue acting as though it remained stable. Drift can be organic, for example when technical practice changes faster than public vocabulary.

Operational test: if the term now covers a meaningfully different practice landscape than it did when policies, norms, or common narratives stabilized around it, drift is present.

### 3.3 Compression

A category is compressed when distinct practices that matter for governance are rhetorically collapsed into one simpler public bucket. Compression is often useful for communication, but becomes harmful when the collapsed distinctions are exactly the ones that should determine scrutiny or legitimacy.

Operational test: if separating the practices would plausibly change regulatory, procurement, or public judgment, but the public label still merges them, compression is governance-significant.

### 3.4 Capture

A category is captured when influential actors successfully stabilize a boundary or dominant interpretation in ways that advantage their own strategic position. Capture need not involve deception. It can emerge through repeated framing, prestige asymmetry, media convenience, or the natural tendency of institutions to prefer a memorable public handle.

Operational test: if one category framing systematically redistributes legitimacy or suspicion toward some actors and away from others, and if alternative framings become institutionally hard to sustain despite technical plausibility, capture is at least a live risk.

These four forms are not mutually exclusive. In practice, ambiguity often enables drift, drift invites compression, and compression creates openings for capture.

## 4. Failure modes when category regimes degrade

If category instability matters, what exactly goes wrong? The answer should not remain vague. There are at least five recurrent institutional failure modes.

### 4.1 Regulatory overshoot

A broad or overloaded label causes governance to hit legitimate technical activity that is not the actual target of concern.

### 4.2 Regulatory undershoot

The harmful mechanism disappears inside a vague umbrella term, so intervention misses the narrower behavior that actually needs constraint.

### 4.3 Legitimacy laundering

Powerful actors normalize their own use of a practice while treating similar practices elsewhere as suspect by controlling the preferred category boundary.

### 4.4 Epistemic compression

Observers lose access to distinctions needed for accurate comparison, so public reasoning degrades even before any formal policy is written.

### 4.5 Misaligned measurement interpretation

Technically sound results are read through unstable categories, producing false equivalence or false contrast between systems and practices that are not meaningfully the same.

This is the paper's hard claim. Category failure is not merely conceptual untidiness. It produces predictable institutional errors.

## 5. Distillation and the danger of moralized compression

Distillation is a live case where governance can shift onto the wrong object. In its broad technical sense, distillation refers to a family of teacher-student transfer practices: synthetic outputs, preference data, verification signals, targeted skill transfer, and other post-training arrangements in which stronger systems help shape weaker ones. This is a normal and deeply embedded technique family in modern model development.

At the same time, some forms of competitive extraction from closed APIs involve behaviors that many institutions will reasonably want to restrict: account abuse, identity spoofing, policy evasion, aggressive scraping, or other acquisition pathways that cross legal or contractual boundaries. Those are not imaginary concerns.

The governance mistake begins when public rhetoric fuses the broad technical family with the narrower suspect behavior. Once that fusion happens, the moral charge attached to the narrower act can spread across the wider category. Distillation stops sounding like a common post-training method and starts sounding like a tainted practice class.

That shift has three effects. First, it creates regulatory overshoot: rules or norms written against the broad label may chill legitimate research, model compression, or ordinary skill-transfer practices. Second, it creates regulatory undershoot: the real object of concern—illicit acquisition mode—may be obscured because the argument is now being carried by the broader technique label. Third, it creates legitimacy laundering: actors already seen as respectable can continue using similar technical families under different descriptions while outsiders are framed through the more stigmatized category.

This is not just semantics. The category choice changes where suspicion lands.

## 6. Open, open-weight, and the struggle over legitimate openness

A second example shows that the argument is not limited to distillation. Public AI discourse has repeatedly struggled over the meaning of open. In practice, the relevant dimensions often include model weights, training data, code, inference access, licenses, reproducibility, and permission to modify or redeploy. Yet public discussion frequently compresses these into a simpler opposition: open versus closed.

That simplification is often communicatively convenient, but it becomes governance-significant when institutions act on it as though it mapped onto one stable thing. An open-weight model can be described as open by actors who want to stress access and ecosystem value, or as not really open by actors who want to stress missing data, closed training pipelines, or weak reproducibility. Both framings can be partly true. The problem is that a single label now stands in for multiple governance-relevant dimensions.

This produces a different set of distortions. Procurement, policy, and public trust may attach to the label open without clarifying whether the relevant concern is inspectability, reproducibility, modifiability, safety review, or diffusion risk. That creates epistemic compression immediately. It also creates openings for capture, because actors can promote the dimension of openness that favors their position while backgrounding the others.

The key point is that category governance here operates even before benchmark evidence enters the picture. A system may be well measured and still be publicly mis-situated because the openness category attached to it is doing too much unresolved work. This is exactly why category governance is not reducible to the previous evaluation paper.

## 7. Measurement regimes and category regimes as coupled layers

The previous sections establish that category governance can independently distort legitimacy and scrutiny. The next step is to explain why it now couples so tightly with measurement governance.

Measurement regimes determine what becomes visible: which tasks count, which hidden splits matter, which harnesses are used, what disclosure is required, how often benchmarks refresh, and who can afford to sustain the process. Category regimes determine what that visibility is taken to be about: whether the measured object is treated as evidence of model capability, workflow quality, alignment, robustness, misuse, openness, or some other public handle.

Neither layer is sufficient alone. A strong measurement regime can still be publicly misread if it is attached to unstable categories. A clean category structure can still float on top of weak or gamed evidence. But when both layers become asymmetric, a small number of actors can shape not just what is seen, but what the seen thing counts as.

That is where institutional power deepens. Controlling measurement determines what claims can be supported. Controlling category language determines what class of claim those measurements are taken to support. Together they shape public legibility.

This is also where open ecosystems face a subtler risk than simple exclusion from benchmarks. They may retain access to visible artifacts while losing influence over the conceptual map used to interpret those artifacts. If so, the visible frontier becomes governed not only through private evidence but through privately stabilized categories.

## 8. Objections and replies

### Objection 1: This is just semantics in more serious clothing

No. The claim is not that words matter because framing matters in general. The claim is that under opacity, category labels allocate scrutiny, legitimacy, and burden of proof before full technical inspection is possible. That is a governance mechanism.

### Objection 2: Better definitions would solve most of this

Better definitions help, but the hard problem is not dictionary clarity. It is that live fields are strategically and institutionally contested. A technically cleaner definition does not automatically win if another framing is easier to communicate, more aligned with elite incentives, or more convenient for policy action.

### Objection 3: This still sounds too close to the benchmark-power paper

The overlap is real, but the dependence is not. The benchmark paper asked who controls the infrastructure of measurement once good evaluation becomes costly and private. This paper asks what happens when even the category being measured is unstable, overloaded, or captured. One can have good measurement attached to a bad category. That is a distinct failure mode.

### Objection 4: Aren't all sciences governed by categories?

Yes, but frontier AI amplifies the problem. Category formation is faster, system visibility is lower, standards are weaker, commercial incentives are stronger, and the policy feedback loop is unusually immediate. Those features make category governance more volatile and more consequential than in many mature disciplines.

## 9. Implications

For researchers, the practical implication is to disclose category assumptions explicitly. If a paper studies alignment, agentic behavior, open models, or distillation, it should state what is being included and excluded rather than treating the label as self-explanatory.

For benchmark stewards, the implication is that stewardship includes interpretation, not just scoring. Decisions about hidden data, anti-gaming procedures, and reporting formats should be accompanied by explanation of what benchmark category is actually being defended and why.

For policymakers, the implication is to regulate behaviors, acquisition modes, and operational risk mechanisms with more precision than broad umbrella labels usually allow. When category compression is high, policy error becomes more likely.

For open ecosystems, the implication is that benchmark access is not enough. Shared conceptual discipline matters too. Without it, open communities may help build the field while losing influence over the category boundaries through which the field is governed.

## 10. Conclusion

The governance problem in frontier AI is no longer exhausted by better measurement. It also concerns the categories through which measurement is interpreted and public intervention is organized.

This paper argued that category governance is a partially independent axis of power. Under opacity, institutions do not act directly on technical detail. They act through policy handles. When those handles drift, compress distinctions, or get captured, governance can land on the wrong object even if the underlying evidence is strong.

That is the sharper institutional risk. Public oversight may become doubly mediated: first by asymmetric measurement infrastructure, then by unstable or strategically loaded categories. In that world, the visible frontier is not only privately measured. It is privately named.

Whoever controls the benchmark matters. But whoever controls the category increasingly decides what the benchmark is taken to mean.
