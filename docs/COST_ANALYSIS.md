# Étude du Coût d'Utilisation de l'IA - ResumeConverter

**Date :** 17 avril 2026  
**Version :** 2.0  
**Statut :** mise à jour alignée sur les derniers modèles publics visibles au 2026-04-17

---

## 1. Résumé exécutif

Cette étude recadre le coût IA de ResumeConverter à partir :

- des `actionType` réellement facturés par l'application
- des packs Stripe actuellement configurés
- des derniers modèles officiellement visibles pour chaque provider consulté

Conclusion rapide :

- la tarification actuelle des packs crédits reste largement rentable
- elle reste solide même avec des modèles premium comme **GPT-5.4** ou **Claude Opus 4.7**
- les modèles “budget” ou “mid-tier” modernes (`DeepSeek V3.2`, `MiniMax M2.7`, `GLM-4.7`, `GLM-5` proxy de `GLM-5.1`, `GPT-5.4 mini`, `Claude Haiku 4.5`) gardent un coût variable très bas

---

## 2. Modèle économique produit

### 2.1 Unité de facturation

ResumeConverter ne facture pas au nombre d'appels provider.  
Le produit facture par **action métier**.

Source : `server/config/aiCredits.js`

| Action métier | Crédits |
| --- | ---: |
| `chatbot.message` | 1 |
| `resume.ai_modify` | 5 |
| `template.extract` | 15 |
| `resume.analysis` | 25 |
| `resume.improvement` | 75 |
| `resume.adaptation` | 50 |
| `resume.match` | 8 |
| `profile.search` | 12 |
| `profile.analysis` | 25 |

### 2.2 Packs crédits actuellement vendus

Source : `server/config/stripe.js`

| Pack | Crédits | Prix |
| --- | ---: | ---: |
| Starter | 250 | 29 € |
| Growth | 750 | 79 € |
| Scale | 2000 | 199 € |

Équivalent pour 1000 crédits :

- Starter : 116 €/1000 crédits
- Growth : 105,33 €/1000 crédits
- Scale : 99,50 €/1000 crédits

---

## 3. Derniers modèles publics visibles par provider

Snapshot officiel vérifié le **17 avril 2026**.

### 3.1 OpenAI

Source : [OpenAI API pricing](https://openai.com/api/pricing/)

| Modèle | Input $ / 1M | Cached input $ / 1M | Output $ / 1M |
| --- | ---: | ---: | ---: |
| GPT-5.4 | 2.50 | 0.25 | 15.00 |
| GPT-5.4 mini | 0.75 | 0.075 | 4.50 |
| GPT-5.4 nano | 0.20 | 0.02 | 1.25 |

Note :

- au 17 avril 2026, la famille phare publique chez OpenAI n'est plus `GPT-5.2`, mais `GPT-5.4`

### 3.2 Anthropic

Sources :

- [Anthropic pricing](https://www.anthropic.com/pricing)
- [Claude Opus 4.7](https://www.anthropic.com/claude/opus)
- [Claude Haiku 4.5](https://www.anthropic.com/claude/haiku)

| Modèle | Input $ / 1M | Output $ / 1M | Commentaire |
| --- | ---: | ---: | --- |
| Claude Opus 4.7 | 5.00 | 25.00 | Dernier modèle public annoncé le 16 avril 2026 |
| Claude Sonnet 4 | 3.00 | 15.00 | Toujours visible comme référence tarifaire générale |
| Claude Haiku 4.5 | 1.00 | 5.00 | Option rapide et économique |

Notes :

- `Claude Opus 4.7` est bien officiel au **16 avril 2026**
- le snapshot de pricing historique sur la page Anthropic peut encore afficher `Opus 4.1` dans certains index, mais la page produit `Opus 4.7` est plus récente et explicite son tarif

### 3.3 Z.AI / GLM

Sources :

- [Z.AI overview](https://docs.z.ai/guides/overview/overview)
- [Z.AI pricing](https://docs.z.ai/guides/overview/pricing)
- [Z.AI release notes](https://docs.z.ai/release-notes/new-released)

| Modèle | Statut public | Input $ / 1M | Output $ / 1M |
| --- | --- | ---: | ---: |
| GLM-5.1 | Dernier modèle public annoncé le 7 avril 2026 | n/a public | n/a public |
| GLM-5 | Dernier tarif officiel public “flagship” visible | 1.00 | 3.20 |
| GLM-5-Turbo | Tarif officiel public visible | 1.20 | 4.00 |
| GLM-4.7 | Toujours tarifé publiquement | 0.60 | 2.20 |

Note importante :

- `GLM-5.1` est bien visible dans l'overview et les release notes
- mais la page de pricing publique ne donne pas encore de ligne distincte `GLM-5.1`
- dans cette étude, **GLM-5** est donc utilisé comme **proxy officiel le plus proche** pour projeter le coût de `GLM-5.1`

Cette projection est une **inférence à partir des sources officielles**, pas un prix officiel distinct de Z.AI pour `GLM-5.1`.

### 3.4 DeepSeek

Source : [DeepSeek Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing/)

| Modèle API | Version réelle | Input cache miss $ / 1M | Output $ / 1M |
| --- | --- | ---: | ---: |
| `deepseek-chat` | DeepSeek-V3.2 | 0.28 | 0.42 |
| `deepseek-reasoner` | DeepSeek-V3.2 thinking mode | 0.28 | 0.42 |

### 3.5 MiniMax

Sources :

- [MiniMax compatible Anthropic API](https://platform.minimax.io/docs/api-reference/text-anthropic-api)
- [MiniMax prompt caching pricing](https://platform.minimax.io/docs/api-reference/anthropic-api-compatible-cache)

| Modèle | Input $ / 1M | Output $ / 1M |
| --- | ---: | ---: |
| MiniMax-M2.7 | 0.30 | 1.20 |
| MiniMax-M2.7-highspeed | 0.30 | 2.40 |
| MiniMax-M2.5 | 0.30 | 1.20 |
| MiniMax-M2.1 | 0.30 | 1.20 |

Pour le produit, `MiniMax-M2.7` est la meilleure référence “dernier modèle public”.

### 3.6 Hugging Face routed inference

Source : [HF Inference Providers pricing](https://huggingface.co/docs/inference-providers/pricing)

Constat :

- Hugging Face documente une facturation routed **sans markup**
- il s'agit donc d'une couche de routage/facturation, pas d'une grille de coût autonome pour le calcul de rentabilité

---

## 4. Hypothèses de consommation produit

Les coûts sont projetés à partir des actions métier, pas de prompts théoriques isolés.

| Action | Input tokens | Output tokens |
| --- | ---: | ---: |
| `chatbot.message` | 2000 | 700 |
| `resume.ai_modify` | 6000 | 2000 |
| `template.extract` | 20000 | 4000 |
| `resume.analysis` | 14000 | 5000 |
| `resume.improvement` | 28000 | 12000 |
| `resume.adaptation` | 16000 | 6000 |
| `resume.match` | 8000 | 1500 |
| `profile.search` | 12000 | 2500 |
| `profile.analysis` | 8000 | 2500 |

Ce sont des hypothèses de planification produit, pas des chiffres officiels provider.

---

## 5. Coût indicatif par action avec les modèles actuels

### 5.1 Points de repère par action

| Action | GPT-5.4 | GPT-5.4 mini | Claude Opus 4.7 | GLM-5 (proxy 5.1) | MiniMax M2.7 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `resume.analysis` | 0.1100 $ | 0.0330 $ | 0.1950 $ | 0.0300 $ | 0.0102 $ |
| `resume.improvement` | 0.2500 $ | 0.0750 $ | 0.4400 $ | 0.0664 $ | 0.0228 $ |
| `resume.adaptation` | 0.1300 $ | 0.0390 $ | 0.2300 $ | 0.0352 $ | 0.0120 $ |
| `template.extract` | 0.1100 $ | 0.0330 $ | 0.2000 $ | 0.0328 $ | 0.0108 $ |
| `chatbot.message` | 0.0155 $ | 0.0046 $ | 0.0275 $ | 0.0042 $ | 0.0014 $ |

Lecture :

- `GPT-5.4` et `Claude Opus 4.7` augmentent clairement le coût variable
- mais même sur des actions lourdes comme `resume.improvement`, le coût reste dans une zone compatible avec les packs actuels
- `GPT-5.4 mini`, `GLM-5` proxy `GLM-5.1`, `MiniMax M2.7` et `DeepSeek V3.2` restent très confortables économiquement

### 5.2 Coût représentatif pour 1000 crédits

Panier utilisé :

- 4 améliorations
- 6 analyses
- 4 adaptations
- 6 extractions template
- 10 matchings
- 10 profile searches
- 6 modifications IA
- 30 messages chatbot

| Modèle de référence | Coût variable estimé pour 1000 crédits |
| --- | ---: |
| DeepSeek V3.2 | 0.2729 $ |
| MiniMax M2.7 | 0.4416 $ |
| GLM-4.7 | 0.8434 $ |
| GLM-5 (proxy GLM-5.1) | 1.3128 $ |
| GPT-5.4 mini | 1.4025 $ |
| Claude Haiku 4.5 | 1.6710 $ |
| GPT-5.4 | 4.6750 $ |
| Claude Sonnet 4 | 5.0130 $ |
| Claude Opus 4.7 | 8.3550 $ |

---

## 6. Option modèle local

Pour `Ollama`, il n'existe pas de tarif token public comparable aux APIs SaaS.  
Le bon modèle est donc un coût d'infrastructure amorti.

Hypothèse illustrative :

- 250 € / mois tout compris

Équivalent par panier de 1000 crédits :

| Volume mensuel | Coût local ramené à 1000 crédits |
| --- | ---: |
| 20 paniers / mois | 12.50 € |
| 50 paniers / mois | 5.00 € |
| 100 paniers / mois | 2.50 € |

Conclusion :

- le local n'est pas forcément le moins cher à faible volume
- il devient très intéressant si le volume est stable ou si le client porte lui-même l'infrastructure

---

## 7. Conséquence sur la rentabilité

Même après mise à jour avec les derniers modèles publics :

- les packs actuels `29 € / 79 € / 199 €` restent **premium-safe**
- la grille intermédiaire `19 € / 55 € / 139 €` reste cohérente pour :
  - `DeepSeek V3.2`
  - `MiniMax M2.7`
  - `GLM-5` proxy `GLM-5.1`
  - `GPT-5.4 mini`
  - `Claude Haiku 4.5`
- si `GPT-5.4` ou `Claude Opus 4.7` deviennent les defaults fréquents sur les workflows lourds, il faut conserver la grille actuelle ou différencier la politique provider par cabinet

---

## 8. Recommandation opérationnelle

### Si l'application reste “provider-agnostic premium”

Conserver :

- Starter 250 crédits : 29 €
- Growth 750 crédits : 79 €
- Scale 2000 crédits : 199 €

### Si l'application vise une offre plus agressive commercialement

Utiliser :

- Starter 250 crédits : 19 €
- Growth 750 crédits : 55 €
- Scale 2000 crédits : 139 €

mais uniquement si le mix réel reste dominé par :

- DeepSeek
- MiniMax
- GLM
- GPT-5.4 mini
- local Ollama

---

## 9. Sources

- `server/config/aiCredits.js`
- `server/config/stripe.js`
- [OpenAI API pricing](https://openai.com/api/pricing/)
- [GPT-5.4 model page](https://developers.openai.com/api/docs/models/gpt-5.4/)
- [Anthropic pricing](https://www.anthropic.com/pricing)
- [Claude Opus 4.7](https://www.anthropic.com/claude/opus)
- [Claude Haiku 4.5](https://www.anthropic.com/claude/haiku)
- [DeepSeek Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing/)
- [Z.AI overview](https://docs.z.ai/guides/overview/overview)
- [Z.AI pricing](https://docs.z.ai/guides/overview/pricing)
- [Z.AI release notes](https://docs.z.ai/release-notes/new-released)
- [MiniMax model compatibility](https://platform.minimax.io/docs/api-reference/text-anthropic-api)
- [MiniMax prompt caching pricing](https://platform.minimax.io/docs/api-reference/anthropic-api-compatible-cache)
- [Hugging Face pricing](https://huggingface.co/docs/inference-providers/pricing)
