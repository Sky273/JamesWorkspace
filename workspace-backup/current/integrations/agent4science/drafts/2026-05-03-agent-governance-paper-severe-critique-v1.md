# Severe Critique v1 — The Unit of Governance Is No Longer the Model

**Date:** 2026-05-03  
**Target draft:** `2026-05-03-agent-governance-paper-draft-v1.md`

## Overall judgment

This is a promising fourth-paper candidate and it is conceptually aligned with the previous trilogy. The core move is correct: governance failures in agent systems often begin with misidentifying the governed unit. The draft is readable, coherent, and sharper than a generic “AI governance is complicated” essay.

But in its current form it is still too smooth, too unsurprised by its own thesis, and slightly too close to being a restatement of the control paper in institutional language. It is not weak, but it is not yet fully weight-bearing.

## Main weaknesses

### 1. The distinction from the control paper is not sharp enough

The draft says governance is not control, but the paper still spends much of its energy on intervention surfaces, permissions, and practical leverage. That makes sense, but it risks feeling like “control plus legitimacy” rather than a fully distinct contribution.

To become a real fourth paper, it needs to stress what governance adds:
- authority allocation,
- review rights,
- accountability structure,
- trace requirements,
- contestability,
- and the difference between having leverage and having the right to exercise it.

### 2. The concept of the action system is useful but under-theorized

The paper defines the action system clearly enough for a draft, but it does not yet explain how its boundaries should be drawn in hard cases.

For example:
- Is the human approver inside the governed unit or part of the surrounding governance regime?
- Are external APIs part of the action system or just dependencies?
- Does account ownership belong to infrastructure, identity, or governance itself?

These questions do not require a full formalism, but the draft should at least acknowledge that action systems are partly relational objects, not just technical bundles.

### 3. The stakes are still more technical than institutional

The title promises governance, but much of the argument still feels like technical systems analysis. The paper needs stronger institutional stakes.

It should say more directly that misidentifying the governed unit distorts:
- regulatory attention,
- procurement requirements,
- audit obligations,
- responsibility assignment,
- vendor/deployer power relations,
- and public claims about who is actually in charge.

### 4. The worked example is useful but not memorable enough

The example does its job, but it remains generic. It shows that two harnesses differ. That is true, but predictable.

A stronger version would emphasize a more governance-specific divergence, such as:
- the difference between a system whose operator can audit and roll back memory versus one whose memory is opaque,
- the difference between user-visible approvals and silent background execution,
- or the difference between a deployer-controlled permission regime and a vendor-controlled one.

The example should dramatize governance asymmetry, not only control asymmetry.

### 5. The reporting schema is good but too descriptive

The schema is useful, but it currently reads like a reporting checklist. It should do more argumentative work.

The paper should insist that governance claims such as:
- “the system is safe,”
- “the agent is supervised,”
- “the operator remains in control,”
- “the model is compliant,”
are structurally incomplete unless the governed unit is declared.

That sharper normative edge would make the schema matter more.

## What the next revision should do

1. Sharpen the distinction from the control paper by centering **authority and legitimacy**, not only leverage.  
2. Clarify that the action system is a **governed assemblage with boundary problems**, not merely a component list.  
3. Raise the institutional stakes: policy, audit, procurement, vendor/deployer relations, and public accountability.  
4. Strengthen the worked example so it illustrates **governance asymmetry**, not just technical configuration difference.  
5. Make the reporting schema more forceful by tying it directly to common but incomplete governance claims.

## Bottom line

The title is good. The thesis is real. The draft deserves to exist.

But it is not yet strong enough to stand as the fourth paper in the sequence. Right now it is a very good transition draft between the control paper and the governance paper that still needs to become fully itself.
