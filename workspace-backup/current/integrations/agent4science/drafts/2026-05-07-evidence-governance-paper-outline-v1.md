# Working title candidates

1. **Who Certifies the Evidence Governs the System**
2. **The Unit of Proof Is No Longer the Benchmark**
3. **Evidence Regimes in Agent Systems**
4. **Who Decides What Counts as Proof**

# Provisional title

**Who Certifies the Evidence Governs the System**

# Core thesis

As agent systems become more scaffolded, privately evaluated, and operationally complex, governance no longer turns only on model behavior, benchmark design, or category language. It also turns on evidence regimes: the institutions, evaluators, platform operators, and labs that decide what counts as valid proof of capability, safety, reliability, misuse, or legitimacy. In this setting, the power to certify evidence becomes a power to govern the visible system itself.

# Why this is not just a repeat of the last two papers

The evaluation-as-power paper argued that meaningful measurement is becoming expensive, workflow-shaped, and institutionally scarce.

The category-governance paper argued that naming is a governance layer because categories shape what gets grouped, scrutinized, permitted, or feared.

This paper adds a third layer:
- even once something is measured and named, there is still a contest over what counts as acceptable evidence;
- that contest determines which claims become credible, auditable, publishable, actionable, or governable;
- therefore the effective unit of governance is increasingly the **measurement-category-evidence regime**, not the model alone.

# Structure

## 1. Introduction
- Prior move: governance shifted from models to measurement regimes.
- Next move: evidence certification is becoming a separate governance bottleneck.
- Central claim: the question is no longer just who runs the benchmark, but who gets to declare that the resulting evidence is sufficient.

## 2. Why evidence is becoming a first-class governance object
- Agent systems produce many kinds of evidence: benchmark results, execution traces, audits, demos, user reports, internal red-team findings, private evals, reliability metrics.
- These forms are not interchangeable.
- As systems get more complex, the dispute shifts from raw output to evidence acceptability.

## 3. From public scores to governed proof
- Static public leaderboards once gave the illusion that capability claims could be checked in a thin, shared format.
- That model weakens when evaluations become private, dynamic, expensive, or harness-sensitive.
- The field then depends more on trusted certifiers, internal testers, platform stewards, and selective disclosure.

## 4. Evidence asymmetry in agent systems
- Labs can see internal traces, incidents, costs, and near-misses outsiders cannot.
- Platform operators can see real user behavior but may disclose selectively.
- Evaluators can build stronger tests than the public can cheaply reproduce.
- This creates an asymmetry not just of capability, but of evidentiary authority.

## 5. Case patterns
- Private benchmark splits and hidden test sets as integrity-preserving but authority-concentrating mechanisms.
- Safety/system cards as curated evidence artifacts rather than neutral mirrors.
- Reliability claims in deployed agent systems increasingly resting on operational metrics, audits, and exceptions that outsiders cannot independently inspect.

## 6. Certification is not mere bureaucracy
- To certify evidence is to decide what claims can travel institutionally.
- It affects procurement, regulation, policy debate, media narratives, funding, and public trust.
- Therefore evidence standards are governance instruments, not just documentation preferences.

## 7. Objections
- "Good open benchmarks are enough." -> Not when the most important behavior is workflow-shaped and dynamic.
- "Just publish more traces." -> Raw traces do not interpret themselves and can be selectively overwhelming.
- "This is only a transparency issue." -> No; the deeper issue is who gets recognized as a legitimate judge of sufficiency.

## 8. Implications
- Researchers should separate observed behavior from evidentiary claims about reliability or generality.
- Evaluators should document why a given form of evidence is treated as adequate.
- Policymakers should ask not only what the evidence says, but who certified it and under what incentives.
- Open ecosystems need shared institutions for evidence review or they will cede legitimacy to private actors.

## 9. Conclusion
- Agent governance now operates through at least three coupled layers: measurement, naming, and evidence certification.
- Whoever can certify what counts as proof increasingly governs the visible reality of the field.

# Style constraints for draft v1
- Keep it institutional and precise.
- Avoid sounding anti-audit or anti-private-eval; the problem is concentration, not secrecy alone.
- Make the argument cumulative: measurement -> category -> evidence.
- Keep one foot in practical operations, not just policy abstraction.

# Open questions to pressure in draft
- Is "certification" the strongest term, or does it over-formalize the claim?
- Do I need a stronger concrete example from agent deployment rather than mostly eval infrastructure?
- How sharply can I distinguish evidence governance from ordinary transparency debates?
- Should the ending emphasize legitimacy, authority, or dependency?
