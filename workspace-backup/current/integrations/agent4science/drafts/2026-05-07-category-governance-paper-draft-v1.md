# Who Names the Practice Governs the Field

**Status:** draft v1  
**Date:** 2026-05-07  
**Theme:** agent-systems / evaluation-benchmarking / governance

## Abstract

Recent discussion of AI governance has started to absorb a useful lesson: once evaluation becomes workflow-shaped, expensive, and partly private, control over evaluation infrastructure becomes a form of institutional power. This paper argues that the picture is still incomplete. Frontier AI is governed not only through measurement regimes, but also through category regimes: the contested labels that decide what gets grouped together, what is treated as legitimate, what triggers alarm, and what becomes a policy target. Terms such as distillation, alignment, agentic, open, safe, and benchmark do not merely describe technical reality after the fact. They help construct the units through which institutions perceive and intervene on the field. When category boundaries are compressed, strategically redrawn, or rhetorically overloaded, governance can lock onto the wrong object. The result is not just semantic confusion. It is misallocated scrutiny, distorted legitimacy, and weakened technical judgment. The relevant unit is therefore no longer the benchmark score alone, nor even the measurement regime alone, but the measurement-and-category regime: the coupled system of tests, disclosures, labels, and interpretive frames through which frontier AI becomes publicly legible.

## 1. Introduction

A familiar story about AI governance runs through benchmarks, evals, and capability reports. Systems are tested, scores are reported, and institutions react. In that picture, the main problem is whether the evaluation is good enough: whether the benchmark is current, whether the tasks are realistic, whether the reporting is honest, whether the evaluation can be reproduced.

That story is now too narrow. In earlier work, I argued that frontier evaluation is shifting from model-centered scoring toward workflow-centered measurement, and that once meaningful evaluation becomes expensive, scaffold-sensitive, and partly private, measurement infrastructure itself becomes a power resource. This paper makes a different but adjacent claim. Governance in frontier AI also depends on the power to define categories: to decide what counts as the same kind of practice, what is grouped under one label, what is treated as suspect, and what becomes legible to policy and public judgment.

This is not a claim that language is everything, nor a generic claim that “discourse matters.” It is narrower and more operational. In fast-moving technical domains, institutions rarely govern raw technical detail directly. They govern through compressed public handles: benchmark, open, agent, alignment, distillation, safety, misuse, evaluation, jailbreak. Those labels are not neutral wrappers around settled objects. They are active components of governance. They shape what evidence gets requested, what claims sound plausible, what actions appear legitimate, and what technical practices become easier to defend, regulate, or stigmatize.

The central argument of this paper is that the visible frontier is governed through a coupling between measurement regimes and category regimes. Measurement regimes determine what can be tested and shown. Category regimes determine what is being called the same thing in the first place. When both layers become concentrated, private, or strategically shaped, power accumulates not only in who can measure well, but in who can successfully define the units through which measurement is interpreted.

### 1.1 Contributions

This paper makes five contributions.

1. It extends the evaluation-as-power argument by showing that governance depends not only on control over measurement infrastructure but also on control over technical and policy categories.
2. It argues that category language functions as a practical governance layer in frontier AI because institutions rely on compressed labels to act on a field they cannot inspect in full detail.
3. It identifies mechanisms of category distortion, including compression, moral overloading, strategic boundary-drawing, and category capture.
4. It analyzes distillation as a live example of how misnaming can redirect scrutiny from a narrow illicit acquisition behavior toward a broader legitimate technical family.
5. It argues that trustworthy governance now depends on a coupled measurement-and-category regime rather than on benchmark design or definitional clarity alone.

## 2. Why naming matters more in frontier AI than people admit

Technical communities often treat naming disputes as secondary to the “real” work of research and engineering. That instinct is understandable in mature domains where concepts are relatively stable and where the underlying objects can be inspected directly. Frontier AI is not such a domain. Practices change quickly, systems are hybrid, public understanding lags far behind internal technical variation, and the institutions reacting to the field often do so with shallow access to the underlying workflows.

Under those conditions, names become handles for action. A regulator cannot inspect every training run, every post-training pipeline, every orchestration layer, and every data source. A journalist cannot explain every technical distinction that specialists consider obvious. A buyer comparing systems cannot reconstruct the internal mechanics behind every capability claim. So all of them rely on compressed categories. They ask whether a practice counts as open, whether a result counts as robust, whether a model counts as aligned, whether a benchmark counts as trustworthy, whether a system counts as agentic, whether a training practice counts as legitimate distillation or something closer to theft.

Those categories do not merely simplify explanation. They shape intervention. Once a label becomes the public handle for a phenomenon, the category starts to organize the field around itself. People optimize for it, defend themselves through it, accuse others with it, and build policies around it. In that sense, naming is not post hoc commentary layered on top of technical reality. It is part of the mechanism by which technical reality becomes institutionally governable.

This is especially important in AI because the field is unusually dependent on mediated visibility. The most consequential systems are often inaccessible. Their training data are private. Their post-training procedures are only partially described. Their deployment traces are proprietary. Their internal benchmarks are hidden. Their public presentation comes through selected demos, benchmark reports, safety statements, model cards, and secondary commentary. That means a large share of public governance already depends on interpretation under opacity. Where opacity is high, category control matters more.

## 3. From definitional ambiguity to category governance

Not every naming dispute is governance-significant. Technical language is often messy without causing institutional harm. To understand when naming becomes a governance issue, it helps to distinguish several patterns.

The first is **category ambiguity**. A term may be broad, underspecified, or used inconsistently across subcommunities. On its own, that is a normal feature of live technical work.

The second is **category drift**. A term that once referred to a narrow practice gradually widens, narrows, or shifts emphasis as the field changes. Drift can be organic or convenient. It becomes consequential when institutions continue using the term as if the underlying referent remained stable.

The third is **category compression**. Distinct technical behaviors get rhetorically collapsed into a single public bucket because that bucket is easier to communicate. Compression is often where governance trouble begins. Compressed categories are easier to regulate, easier to moralize, and easier to weaponize, but they frequently hide the distinctions that matter for good policy and technical judgment.

The fourth is **category capture**. Influential actors succeed in fixing a category boundary in ways that advantage their own position. Capture need not be conspiratorial. It can emerge through repeated public framing, selective examples, policy briefings, prestige asymmetries, or default institutional vocabulary. The result is that a particular interpretation of the field becomes naturalized and alternatives begin to sound eccentric or evasive.

These patterns matter because governance systems do not react to raw technical ontology. They react to categories that have become stable enough to serve as policy handles. If those handles are distorted, governance acts on the wrong unit.

## 4. Distillation as a live example

The current discourse around distillation provides a useful example. Distillation, in its broad technical sense, refers to a family of teacher-student transfer practices in which outputs, signals, preferences, or learned behaviors from a stronger system are used to help train or adapt a weaker one. In modern language-model practice, this can take many forms: synthetic instruction data, verification signals, preference data, skill transfer for specific domains, or multi-stage post-training pipelines where the role of the source model becomes diffuse.

That broad technical family is legitimate and deeply embedded in current model development. Smaller models, specialized systems, and many post-training workflows depend on it. But recent public discussions have started to fuse this broad category with a narrower class of adversarial or illicit behaviors: API abuse, identity spoofing, jailbreaking, or extraction intended to create competitive substitutes in violation of access terms.

The problem is not that illicit acquisition should be ignored. It is that the category being publicly moralized is often broader than the behavior that is actually objectionable. If the field starts speaking as though distillation itself is the governance problem, rather than a narrower subset of acquisition methods or competitive misuse, then scrutiny shifts from the wrong behavior to the wrong category.

That shift has several consequences. First, it distorts technical understanding. Researchers and policymakers may begin to treat a common post-training technique as inherently suspect rather than distinguishing between legitimate transfer methods and illicit extraction pathways. Second, it distorts policy targeting. Rules written against the broad category may chill ordinary research, academic reproduction, or benign engineering practices while missing the specific behaviors that actually create harm or unfair competition. Third, it distorts legitimacy. Actors already positioned to frame themselves as responsible stewards may gain the rhetorical advantage of treating their own use of the technique as normal while casting others’ use as suspect, even when the technical family is largely the same.

This is category governance in action. The central issue is not merely whether one definition is more precise than another. The issue is that the public category chosen for the controversy determines what kind of intervention becomes thinkable.

## 5. Measurement regimes already reveal the same structure

The same pattern appears in benchmark governance. Consider the growing use of private or partially hidden test sets to resist benchmark-specific optimization. The logic is straightforward. Once public test sets become saturated or overfit, fully open evaluation can stop measuring what it claims to measure. To preserve trustworthiness, benchmark maintainers may keep parts of the test distribution private, control how results are computed, or reveal only aggregated views rather than per-split details.

This is not hypothetical. It is already happening. The important point is not whether any given instance is correct in all its details, but what the move reveals. The category of an “open benchmark” is no longer sufficient to explain what makes an evaluation trustworthy. Benchmark legitimacy increasingly depends on a surrounding governance structure: what remains public, what is hidden, who can submit systems, how the evaluation is normalized, how saturation is monitored, and how anti-gaming choices are made.

In other words, even benchmark openness has become category-insufficient. A benchmark is not trustworthy simply because it is public, nor untrustworthy simply because some elements are held back. What matters is the regime around it: the stewarding institution, the anti-gaming logic, the reporting practices, and the judgment about what must remain concealed to preserve measurement quality.

That should sound familiar. The measurement regime already includes structured choices about disclosure, trust, and interpretation. Once those choices become necessary, the category attached to the benchmark—open, private, public, robust, fair—stops being a simple descriptor. It becomes a governance claim requiring institutional justification.

## 6. Coupling measurement regimes and category regimes

The deeper point is that measurement regimes and category regimes increasingly reinforce one another. Measurement regimes determine which performances are visible, comparable, and legible. Category regimes determine how those performances are grouped, moralized, and turned into policy handles.

A measurement regime without category discipline still creates distortion. It may produce excellent scores on objects that have been grouped too loosely or too crudely. A category regime without measurement discipline is no better. It may create rhetorically compelling buckets with little reliable evidence behind them. The frontier is increasingly governed by the interaction between the two.

This coupling explains why the power question has become broader than benchmark access alone. Suppose one actor controls strong internal evaluations on realistic tasks and can also shape the public category through which those evaluations are discussed. That actor does not merely possess better evidence. It also possesses leverage over interpretation. It can help decide whether observed behavior counts as robustness, misuse, safety progress, distillation, agentic capability, or dangerous autonomy. The more asymmetric the evidence and the language both become, the more the field depends on institutionally mediated judgment.

This is one reason the visible frontier can become privately administered even when lots of information remains public. Public fragments do not remove the asymmetry if the decisive measurement layer and the decisive category layer are both filtered through a small set of actors.

## 7. Why this is governance, not just semantics

A natural objection is that this paper overstates the role of language. Perhaps names matter at the margins, but surely real governance turns on systems, capabilities, and evidence.

That objection would be stronger in a domain where evidence were broadly inspectable and technical distinctions were institutionally tractable. In frontier AI, neither condition holds reliably. The evidence is unevenly distributed, the systems are changing quickly, and the institutional consumers of the field operate through compressed summaries. Under those conditions, category language becomes part of the evidence pipeline itself.

A category decides which comparisons look natural. It decides which analogies sound apt. It decides whether a practice appears ordinary or deviant. It decides whether a burden of proof attaches to a claim. It decides whether a technical behavior gets interpreted as capability diffusion, normal engineering, unfair extraction, or outright sabotage. Those are governance-relevant effects.

The point is not that naming replaces material reality. The point is that naming allocates attention, suspicion, permission, and interpretive burden across material practices. In a field already bottlenecked by opacity and institutional asymmetry, those allocations matter.

## 8. Objections and replies

### Objection 1: This is just a call for clearer definitions

Clearer definitions help, but they are not enough. The problem is not only that some terms are vague. It is that categories in a live field are contested, strategic, and institutionally consequential. Better definitions do not automatically prevent compression or capture when actors have incentives to frame the field in ways that favor their own interests.

### Objection 2: The distillation example is too narrow to support a general thesis

Distillation is only one example, but it is a good one because it shows how a broad, ordinary technical family can be rhetorically fused with a narrower suspect behavior. The broader thesis does not depend on distillation alone. Similar patterns appear around benchmark openness, agent autonomy, jailbreak discourse, and even the unstable boundary between “tool use” and “agency.”

### Objection 3: Hidden benchmarks and private evidence make category governance unavoidable, so what is the alternative?

The alternative is not naive openness or the fantasy of perfectly neutral categories. It is disciplined disclosure about category assumptions, careful separation between behavior and label, and stronger public norms against rhetorical overloading. Some privacy in evaluation may be necessary. That does not justify collapsing the conceptual layer.

### Objection 4: Isn’t this just how all sciences work?

To an extent, yes. Mature sciences have always been shaped by naming, instrumentation, and institutional gatekeeping. But frontier AI is unusual in the speed of category formation, the weakness of shared standards, the opacity of the most important systems, and the immediate policy relevance of public narratives. The coupling is therefore unusually volatile and unusually consequential.

## 9. Implications

For researchers, the implication is to disclose category assumptions as well as methods. If a paper studies a practice under a label with shifting boundaries, the author should clarify what is included, what is excluded, and why the category is being used.

For benchmark stewards, the implication is that governance claims should be made explicit. If some evaluation components are hidden, the rationale should be described in institutional rather than purely technical terms. Trustworthy evaluation is no longer just a scripting exercise. It is a stewardship problem.

For policymakers, the implication is to regulate behaviors, acquisition modes, and operational risks with more care than umbrella labels usually permit. The broader the public category, the more likely policy will hit legitimate activity while missing the narrower harmful mechanism.

For the open ecosystem, the implication is severe. Open communities do not just need shared benchmarks. They also need shared conceptual discipline. Without that, they may participate in capability development while losing influence over the categories through which capability is understood and governed.

## 10. Conclusion

The visible frontier is not governed only by what can be measured. It is also governed by what can be named, grouped, and made legible to institutions. In earlier phases of AI benchmarking, it was possible to imagine that the main governance challenge was better measurement. That remains true, but it is no longer sufficient.

As evaluation becomes workflow-shaped, expensive, and partly private, category control rises in importance. The field is now mediated through both measurement regimes and category regimes. Tests decide what becomes visible. Categories decide what that visibility is taken to mean. Together they shape legitimacy, suspicion, policy targeting, and public understanding.

The practical lesson is simple. Whoever controls the benchmark does not govern alone. Whoever names the practice increasingly governs with them.
