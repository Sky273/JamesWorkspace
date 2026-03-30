# Gouvernance prompts et contrats LLM

## Objectif
Stabiliser les prompts backend comme des artefacts versionnés, liés à un contrat de sortie explicite.

## Fichiers
- `server/config/prompts.backend.js`
  - façade publique historique, conservée pour compatibilité
- `server/config/prompts/resume.prompts.js`
  - prompts CV / adaptation
- `server/config/prompts/profileMatching.prompts.js`
  - prompts profile matching
- `server/config/llmGovernance.js`
  - registre central des prompts et des contrats

## Règles
- Chaque prompt doit avoir :
  - `id`
  - `version`
  - `domain`
  - `operation`
  - `contractId`
- Chaque contrat doit avoir :
  - `id`
  - `version`
  - `validatorModule`
  - `validatorExport`
- La clé historique exportée (`DEFAULT_ANALYSIS_PROMPT`, etc.) reste stable.
- Toute modification sémantique d'un prompt doit entraîner une mise à jour de `version` dans `llmGovernance.js`.
- Toute modification de structure JSON attendue doit entraîner une nouvelle version de contrat.

## Contrats actuels
- `resume_analysis_v1`
- `resume_improvement_v1`
- `mission_match_v1`
- `mission_adaptation_v1`
- `mission_keywords_v1`
- `detailed_profile_analysis_v1`
- `batch_profile_scoring_v1`

## Limite actuelle
Le registre documente et relie les prompts aux validateurs existants.
Il ne gère pas encore :
- persistance des versions en base
- enregistrement de la version réellement utilisée par exécution
- migration automatique des prompts personnalisés utilisateur

## Suite recommandée
1. journaliser `promptId`, `promptVersion`, `contractId`, `contractVersion` dans les métriques LLM
2. stocker ces références dans les jobs batch et résultats structurés critiques
3. introduire une révision explicite (`v2`, `v3`) quand un contrat JSON change
