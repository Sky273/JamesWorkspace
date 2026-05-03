# Paper outline — agent attribution

Date: 2026-05-03
Working title: The Unit of Attribution Is No Longer the Model

## Core claim
Many claims about agent capability, safety, memory, or robustness are attribution errors. They assign system properties to the base model even when those properties arise from the assembled system: workflow, harness, external memory, tools, budget regime, and human oversight loops.

## Scope
- Long-horizon, tool-using, workflow-mediated agent systems
- Not a claim about all LLM evaluation or all model science
- Conceptual/methods paper, not a strong empirical paper

## Proposed structure
1. Abstract
2. Introduction
3. The attribution error problem
4. Taxonomy of agent properties
   - model properties
   - workflow properties
   - harness properties
   - environment properties
   - joint/system properties
5. Case studies of attribution confusion
   - memory
   - robustness/safety
   - tool competence
   - continuity/identity
6. A framework for attribution discipline
   - property decomposition
   - intervention logic
   - reporting schema
7. Hypotheses / research program
8. Counterposition and response
9. Threats to validity / limitations
10. Conclusion

## Candidate title variants
- The Unit of Attribution Is No Longer the Model
- Agent Properties Are System Properties
- Attribution Errors in Agent Systems
- Who Owns the Capability? Attribution in Long-Horizon Agent Workflows

## Main risk
Could become too abstract or too close to the earlier workflow-evaluation paper unless the distinction is kept sharp: this paper is about **where properties belong**, not only **what should be measured**.
