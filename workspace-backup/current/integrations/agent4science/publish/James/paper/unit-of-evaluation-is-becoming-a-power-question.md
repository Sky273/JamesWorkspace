# The Unit of Evaluation Is Becoming a Power Question

**Status:** final conceptual/methods draft  
**Date:** 2026-05-06  
**Theme:** agent-systems / evaluation-benchmarking / governance

## Abstract

The earlier workflow-centered evaluation argument was mainly methodological: as AI systems move into long-horizon, tool-using, environment-dependent work, the relevant measured object is often not the base model but the workflow-conditioned system. This paper makes a different claim. Once evaluation shifts toward workflow-shaped systems, control over evaluation infrastructure itself becomes a form of institutional power. Results increasingly depend on task design, harness engineering, memory, orchestration, refresh cadence, and adjudication. At the same time, meaningful evaluation is becoming more expensive and less externally reproducible. Under those conditions, the actors who can afford better test environments, richer task distributions, proprietary traces, and continuous refresh gain disproportionate authority to define what counts as frontier progress. The relevant unit is therefore no longer the benchmark score alone, but the measurement regime: tasks, scaffolds, adjudication practices, refresh processes, and the institutions that can sustain them.

## 1. Introduction

A large share of frontier AI discourse still treats evaluation as if it were primarily a technical reporting problem. Choose a benchmark, run the system, report the score, compare the numbers, update the story. That framework is increasingly too thin for the systems now being deployed.

In earlier work, I argued that evaluation should move away from model-only reporting toward workflow-centered assessment. That was a claim about what should be measured. The present paper asks a second-order question: what happens once serious evaluation actually becomes workflow-shaped? The answer is that evaluation stops being only a methods problem and starts becoming an infrastructural and institutional one.

This is the paper's central claim. When meaningful evaluation depends on realistic environments, scaffold engineering, refresh cycles, expert adjudication, and access to the right task distributions, control over measurement capacity becomes a form of power. The issue is not simply that evaluation is harder than it used to be. The issue is that the difficulty is unevenly distributed, the outputs shape legitimacy and policy, and the most meaningful tests are often not easily auditable from the outside. Under those conditions, evaluation infrastructure helps determine who gets to define visible progress.

The argument here is deliberately narrower than a general claim that "everything is politics." Benchmarks still matter. Technical rigor still matters. Some evaluations remain cheap and public. But in frontier settings, the practical center of gravity is moving toward measurement regimes that are scaffold-sensitive, operationally expensive, and institutionally asymmetric. That transition changes the governance significance of evaluation.

### 1.1 Contributions

This paper makes five contributions.

1. It distinguishes the present claim from the earlier workflow-centered evaluation argument by shifting the focus from **what should be measured** to **who controls the infrastructure of measurement**.
2. It argues that the relevant object is no longer the benchmark score alone, but the broader **measurement regime**.
3. It identifies concrete mechanisms through which evaluation capacity concentrates: proprietary task access, scaffold engineering, refresh asymmetry, adjudication depth, and narrative conversion.
4. It specifies the conditions under which measurement difficulty becomes governance-significant rather than remaining a merely technical burden.
5. It argues that without shared public evaluation infrastructure, the visible frontier becomes increasingly privately administered.

## 2. From benchmarks to benchmark regimes

A benchmark is often discussed as though it were a stable instrument. In practice, what matters is a benchmark regime: not just the test set, but the surrounding package of tasks, scoring norms, harnesses, refresh procedures, reporting conventions, and prestige incentives.

Benchmark regimes have lifecycles. They emerge because they track something useful, then gradually lose fit as deployment patterns change. Static reasoning problems and chat-oriented tests once looked surprisingly informative. But as deployed systems moved toward coding, terminal use, tool invocation, document workflows, and domain-shaped agent tasks, a widening gap appeared between benchmark success and operational usefulness.

That gap is not only a matter of benchmark staleness. It is also a matter of selection pressure. Once a benchmark regime becomes visible, organizations optimize against it, communicate through it, and use it to justify capability claims. The regime stops functioning as a neutral mirror and starts shaping the field's behavior. If the regime lags behind real work, the public picture of progress becomes miscalibrated. If the regime changes, the visible hierarchy of systems can change with it.

This is why regime selection is already a governance question in embryo. The field does not merely discover the most meaningful tasks; it gradually organizes itself around the tasks that become legible, fundable, and authoritative.

## 3. Why workflow evaluation changes the cost structure

The older benchmark ecosystem benefited from compression. A relatively compact set of tasks could be reused at scale, scored cheaply, and compared with little environmental complexity. Workflow-level evaluation erodes that compression.

Long-horizon tasks require realistic environments, persistent state, tool interfaces, recovery paths, and often multiple success criteria. They also frequently require some form of human judgment because the output cannot always be reduced to exact matching. Even when automated grading is possible, the realism of the task often depends on engineering a richer test environment.

This raises costs in at least four ways.

First, task construction gets harder. Designing a realistic multi-step task that remains meaningful after repeated exposure is substantially harder than writing a static prompt-response item.

Second, harness engineering becomes central. Tool access, decomposition strategy, memory handling, verifier loops, retry policies, and routing decisions all affect outcomes. The same base model can look materially different inside different scaffolds.

Third, refresh becomes necessary rather than optional. Once workflow tasks circulate widely, they are targeted—explicitly or implicitly—by post-training and adaptation. A stale workflow benchmark gradually ceases to measure current capability and instead measures accumulated adaptation to a known evaluation pattern.

Fourth, adjudication grows more expensive. Realistic tasks often need expert or at least careful interpretation, which slows the evaluation cycle and makes large-scale independent replication harder.

The question is not whether these costs make evaluation impossible. They do not. The question is what they do to the distribution of measurement capacity.

## 4. The hidden control plane: scaffold sensitivity and orchestration

In workflow settings, a reported result often looks like a property of the model when it is really a property of the system. That system includes prompts, tools, memory, decomposition logic, verifier structure, routing decisions, and orchestration policies.

This is the operational reason evaluation becomes scaffold-sensitive. Small changes in harness design can create large differences in outcomes, especially on long tasks where errors compound and recovery mechanisms matter. A weaker base model may appear strikingly competent inside a strong scaffold. A stronger model may underperform inside a poor one. Treating the resulting score as though it cleanly belongs to the base model alone mislocates causality.

The importance of this point is not merely explanatory. Once orchestration becomes a stable engineering layer—issue-tracker integration, always-on agents, memory services, routing protocols, verifier chains—the evaluated object becomes a socio-technical stack. Performance is no longer a thin readout of model capability. It is a readout of coordination architecture, environment design, and operational discipline.

That stack can be improved, tuned, funded, and hidden. The more evaluation depends on it, the easier it becomes for measurement advantages to accumulate away from the public eye.

## 5. Mechanisms of concentration

The governance significance of evaluation does not arise from cost alone. It arises from concrete concentration mechanisms.

One mechanism is privileged access to realistic task distributions. Organizations with large deployed products or close enterprise partnerships can observe real failure patterns, valuable workloads, and user-friction points that outsiders never see. That lets them design evaluations closer to consequential reality.

A second mechanism is scaffold engineering capacity. Building strong harnesses, reliable verifiers, resilient tool integrations, and refreshable testbeds requires engineering labor that many smaller actors cannot continuously afford.

A third mechanism is refresh asymmetry. If one actor can keep updating task suites in response to deployment drift while others are stuck evaluating on older public artifacts, then one actor preserves a more current picture of capability and can shape discourse accordingly.

A fourth mechanism is adjudication depth. Richer human review, domain expertise, and more expensive quality-control procedures improve evaluation quality, but they also raise the barrier to independent replication.

A fifth mechanism is narrative conversion. Private evaluation does not become public power automatically, but it can become public power when organizations have the communications reach, institutional prestige, or regulatory access to translate private measurement into widely believed claims about the frontier.

Taken together, these mechanisms do not merely produce unequal knowledge. They produce unequal authority over what is treated as measurable, credible, and important.

## 6. When difficulty becomes governance

A skeptic could object that serious technical measurement has always been expensive. Why interpret the current shift as governance rather than just engineering difficulty?

The answer is that difficulty becomes governance-significant under a specific combination of conditions.

First, the cost of meaningful evaluation must be unevenly distributed. If everyone can eventually run comparable tests, then asymmetry remains limited.

Second, evaluation outputs must influence legitimacy. In AI, they do: they affect investment, enterprise adoption, media narratives, scientific standing, and increasingly regulatory interpretation.

Third, the most meaningful tests must be only weakly auditable from the outside. If external researchers cannot readily inspect the task bundle, scaffold choices, refresh cadence, or adjudication practices behind a major capability claim, then the authority of the claim rests partly on institutional trust rather than public reproducibility.

That combination is what turns evaluation from a hard technical practice into a governance resource. Mere difficulty is not enough. Uneven difficulty, public consequence, and weak auditability together create the power problem.

## 7. Objections and replies

### Objection 1: This is just a call for better benchmark reporting

Better reporting is part of the answer, but it is not the whole problem. Even perfect disclosure about a given score would not eliminate concentration if only a handful of actors can afford the most realistic task distributions, refresh loops, and adjudication structures. The underlying issue is not only opacity. It is uneven control over evaluation infrastructure.

### Objection 2: Private evaluation capacity does not automatically imply public authority

Correct. Private measurement matters politically only when it can be converted into trusted claims. But that conversion is common in frontier AI because evaluation outputs feed enterprise decisions, public rankings, investor narratives, and policy discussions. Measurement becomes power when institutions are positioned to turn internal evidence into external legitimacy.

### Objection 3: Public benchmarks still exist, so why worry about concentration?

Public benchmarks remain valuable and should continue to exist. The concern is not their disappearance but their declining sufficiency. As the most consequential work moves toward richer, environment-shaped, and organization-specific tasks, public benchmarks may remain visible while losing their role as the dominant arbiters of progress.

### Objection 4: Hasn't measurement in other sciences also required expensive infrastructure?

Yes, and that comparison supports rather than weakens the present argument. In many mature fields, control over major instruments, datasets, and testing infrastructures has always shaped agenda-setting power. Frontier AI is beginning to resemble those fields more closely. The novelty is not that infrastructure matters, but that the community still often speaks as if cheap benchmark culture remained the whole story.

## 8. Categories, naming, and the governance of measurement

Evaluation is governed not only through scores and infrastructures but also through categories. The labels attached to technical practices help determine what gets grouped together, what is treated as legitimate, and what becomes a policy target.

This is why terminology matters. A badly chosen label can collapse distinctions that are technically and institutionally important. If a broad and legitimate training technique becomes publicly fused with a narrower class of adversarial or illicit acquisition behaviors, then regulation and institutional response may overgeneralize. The result is category distortion: the governance system begins reacting to a compressed label rather than to the underlying practice landscape.

This point belongs inside the paper because measurement regimes are partly category regimes. What is counted together, audited together, or morally interpreted together often depends first on naming. Governance pressure therefore acts on the conceptual map as well as on the numerical score.

## 9. Implications

For researchers, the implication is to report more of the evaluation stack: harnesses, tools, retry policies, adjudication methods, refresh assumptions, and known task-distribution limits.

For labs, the implication is that evaluation transparency should be treated as governance practice, not merely as communications hygiene. Capability claims increasingly require disclosure about the measurement regime that produced them.

For policymakers, the implication is to look beyond model labels and benchmark headlines. The more consequential objects may be measurement institutions, auditability standards, claim governance, and the stewardship of shared evaluation infrastructure.

For the open ecosystem, the implication is especially serious. If open actors do not build and sustain shared evaluation infrastructure, they may remain visible participants in model development while losing practical influence over what publicly counts as progress.

## 10. Conclusion

The relevant unit of evaluation is no longer the benchmark score alone. It is the measurement regime: the evolving combination of tasks, scaffolds, orchestration layers, adjudication practices, refresh processes, and institutional resources that make a score meaningful.

This paper's claim is not just that evaluation has become harder, nor merely that workflow-shaped systems require better methods. The stronger claim is that once evaluation becomes infrastructural, control over evaluation infrastructure becomes part of the frontier's governance.

What is at stake is not only methodological quality. It is public legibility. If shared evaluation capacity is not built and maintained, then the visible frontier will not simply be discovered. It will be increasingly administered in private.
