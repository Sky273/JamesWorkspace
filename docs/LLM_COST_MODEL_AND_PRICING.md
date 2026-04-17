# Coûts LLM et Projection Tarifaire

**Date :** 17 avril 2026  
**Statut :** note de cadrage économique  
**Périmètre :** coûts IA variables, option modèle local, projection de packs de crédits rentables

---

## 1. Résumé exécutif

ResumeConverter facture l'IA en **crédits métier** et non en appels provider bruts. C'est la bonne granularité commerciale, car une même action utilisateur peut couvrir plusieurs sous-appels LLM.

Constat principal :

- les packs Stripe actuellement configurés sont déjà **très conservateurs** économiquement
- ils restent confortables même si un provider premium comme **Claude Sonnet 4** est utilisé sur une partie des flux
- si l'objectif devient la compétitivité commerciale plutôt que la marge de sécurité maximale, il existe une zone de prix plus agressive sans mettre en risque la rentabilité

---

## 2. Base économique actuelle de l'application

### 2.1 Crédits par action métier

Source : `server/config/aiCredits.js`

| Action métier | Coût par défaut |
| --- | ---: |
| `chatbot.message` | 1 crédit |
| `resume.ai_modify` | 5 crédits |
| `template.extract` | 15 crédits |
| `resume.analysis` | 25 crédits |
| `resume.improvement` | 75 crédits |
| `resume.adaptation` | 50 crédits |
| `resume.match` | 8 crédits |
| `profile.search` | 12 crédits |
| `profile.analysis` | 25 crédits |

Important :

- `resume.improvement` couvre à la fois la génération du CV amélioré et la post-analyse structurée
- `profile.search` couvre l'extraction de mots-clés mission, le scoring batch et les explications associées

### 2.2 Packs Stripe actuellement configurés

Source : `server/config/stripe.js`

| Pack | Crédits | Prix TTC affiché |
| --- | ---: | ---: |
| Starter | 250 | 29 € |
| Growth | 750 | 79 € |
| Scale | 2000 | 199 € |

Équivalent prix de vente pour 1000 crédits :

- Starter : **116 €/1000 crédits**
- Growth : **105,33 €/1000 crédits**
- Scale : **99,50 €/1000 crédits**

---

## 3. Prix officiels providers consultés

Snapshot pris le **2026-04-17** depuis les pages officielles publiques.

| Provider / modèle | Input USD / 1M | Output USD / 1M | Source |
| --- | ---: | ---: | --- |
| OpenAI GPT-5 mini | 0.25 | 2.00 | [OpenAI Pricing](https://openai.com/api/pricing) |
| Anthropic Claude Sonnet 4 | 3.00 | 15.00 | [Anthropic Pricing](https://www.anthropic.com/pricing) |
| DeepSeek V3.2 (`deepseek-chat`) | 0.28 | 0.42 | [DeepSeek Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing/) |
| Z.AI GLM-4.5-Air | 0.20 | 1.10 | [Z.AI Pricing](https://docs.z.ai/guides/overview/pricing) |
| MiniMax M2.1 | 0.30 | 1.20 | [MiniMax Pricing](https://platform.minimax.io/docs/api-reference/anthropic-api-compatible-cache) |
| Hugging Face routed inference | dépend du provider | dépend du provider | [HF Pricing](https://huggingface.co/docs/inference-providers/pricing) |

Notes :

- Hugging Face documente que les requêtes routées sont facturées **sans markup** ; ce n'est donc pas une base tarifaire autonome, mais un chemin de facturation vers d'autres providers.
- Pour DeepSeek, le cache hit input peut être bien plus bas ; la projection ci-dessous reste volontairement prudente et utilise le **cache miss**.

---

## 4. Hypothèses de consommation retenues

Le code définit des plafonds de tokens, mais pas encore un historique stable de **médianes réelles par `actionType`**. Pour faire une projection économiquement exploitable, il faut donc poser une enveloppe opérationnelle raisonnable.

Hypothèses retenues :

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

Ces valeurs sont des **hypothèses produit** destinées à la projection, pas des chiffres officiels provider.

---

## 5. Coût variable indicatif par action

### 5.1 Comparatif providers

| Action | DeepSeek V3.2 | OpenAI GPT-5 mini | Claude Sonnet 4 |
| --- | ---: | ---: | ---: |
| `chatbot.message` | 0.0009 $ | 0.0019 $ | 0.0165 $ |
| `resume.ai_modify` | 0.0025 $ | 0.0055 $ | 0.0480 $ |
| `template.extract` | 0.0073 $ | 0.0130 $ | 0.1200 $ |
| `resume.analysis` | 0.0060 $ | 0.0135 $ | 0.1170 $ |
| `resume.improvement` | 0.0129 $ | 0.0310 $ | 0.2640 $ |
| `resume.adaptation` | 0.0070 $ | 0.0160 $ | 0.1380 $ |
| `resume.match` | 0.0029 $ | 0.0050 $ | 0.0465 $ |
| `profile.search` | 0.0044 $ | 0.0080 $ | 0.0735 $ |
| `profile.analysis` | 0.0033 $ | 0.0070 $ | 0.0615 $ |

Lecture :

- DeepSeek / GLM / MiniMax sont dans une bande de coût très basse
- OpenAI GPT-5 mini reste économiquement confortable
- Claude Sonnet 4 est beaucoup plus cher, mais reste encore loin des prix de vente actuels des packs

### 5.2 Coût représentatif pour 1000 crédits

Panier métier de référence retenu :

- 4 améliorations
- 6 analyses
- 4 adaptations
- 6 extractions de template
- 10 matchings
- 10 profile searches
- 6 modifications IA
- 30 messages chatbot

Résultat :

| Politique LLM dominante | Coût variable IA pour 1000 crédits |
| --- | ---: |
| DeepSeek V3.2 | 0.27 $ |
| Z.AI GLM-4.5-Air | 0.35 $ |
| MiniMax M2.1 | 0.44 $ |
| OpenAI GPT-5 mini | 0.57 $ |
| Claude Sonnet 4 | 5.01 $ |

Conclusion intermédiaire :

- même en scénario premium, on reste dans un coût variable IA de quelques dollars pour 1000 crédits
- les packs actuels à ~100 € / 1000 crédits laissent une marge très large pour absorber :
  - OCR
  - stockage
  - infrastructure applicative
  - support
  - incidents et croissance des prompts

---

## 6. Option modèle local

### 6.1 Nature du coût

Pour **Ollama** ou un modèle local auto-hébergé, il n'existe pas de prix officiel au million de tokens comparable aux APIs SaaS. Le bon modèle économique est donc :

- coût d'infrastructure
- coût d'exploitation
- coût d'amortissement matériel

### 6.2 Hypothèse locale illustrative

Hypothèse raisonnable tout compris :

- **250 € / mois**
  - VPS GPU ou amortissement machine locale
  - énergie / hébergement
  - administration et maintenance

Équivalent par panier de 1000 crédits :

| Volume mensuel | Coût local ramené à 1000 crédits |
| --- | ---: |
| 20 paniers / mois | 12.50 € |
| 50 paniers / mois | 5.00 € |
| 100 paniers / mois | 2.50 € |

Lecture :

- le local n'est pas automatiquement moins cher à faible volume
- il devient très intéressant dès que le volume est stable
- si le client héberge lui-même, la tarification peut se déplacer d'une logique “revente IA” vers une logique “logiciel + support + maintenance”

---

## 7. Tableau de tarifs recommandé

Trois stratégies cohérentes apparaissent.

### 7.1 Option A : budget / local-first

À utiliser si le runtime standard est limité à :

- DeepSeek
- GLM
- MiniMax
- Ollama local

et si les providers premium sont désactivés ou facturés à part.

| Pack | Crédits | Tarif recommandé |
| --- | ---: | ---: |
| Starter | 250 | 12 € |
| Growth | 750 | 35 € |
| Scale | 2000 | 89 € |

### 7.2 Option B : universal hosted

À utiliser si :

- OpenAI GPT-5 mini est autorisé par défaut
- Anthropic premium peut exister ponctuellement
- on veut une politique plus compétitive que la grille actuelle

| Pack | Crédits | Tarif recommandé |
| --- | ---: | ---: |
| Starter | 250 | 19 € |
| Growth | 750 | 55 € |
| Scale | 2000 | 139 € |

### 7.3 Option C : premium-safe

À utiliser si :

- on veut une seule grille très robuste
- on accepte de payer la tranquillité de marge
- Claude Sonnet 4 ou d'autres providers premium peuvent devenir fréquents

| Pack | Crédits | Tarif recommandé |
| --- | ---: | ---: |
| Starter | 250 | 29 € |
| Growth | 750 | 79 € |
| Scale | 2000 | 199 € |

Cette option correspond exactement à la configuration Stripe actuelle.

---

## 8. Recommandation commerciale

### Recommandation la plus pragmatique

Si l'objectif est de rester rentable tout en abaissant la friction d'achat, la meilleure zone de prix est :

| Pack | Crédits | Recommandation |
| --- | ---: | ---: |
| Starter | 250 | **19 €** |
| Growth | 750 | **55 €** |
| Scale | 2000 | **139 €** |

Pourquoi :

- très rentable sur DeepSeek / GLM / MiniMax / GPT-5 mini
- encore sûre si certains flux premium passent ponctuellement par Anthropic
- commercialement plus accessible que la grille actuelle
- cohérente avec un produit SaaS B2B premium mais pas “sur-margé” au premier regard

### Quand garder la grille actuelle

Conserver `29 € / 79 € / 199 €` a du sens si :

- le produit est vendu comme outil premium à forte valeur perçue
- le support et l'accompagnement sont inclus
- la stratégie privilégie la marge de sécurité à la conquête volume
- le mix provider futur reste incertain

---

## 9. Limites de cette projection

- La projection repose sur des hypothèses de tokens par action, pas encore sur des médianes de production historisées.
- Le vrai prochain cran de pilotage serait d'exposer des métriques durables par `actionType` :
  - tokens input médians
  - tokens output médians
  - coût provider réel moyen
  - distribution par provider
- Si certains clients activent des providers premium et d'autres non, une future grille pourrait devoir dépendre d'une **politique provider par cabinet**.

---

## 10. Sources

- `server/config/aiCredits.js`
- `server/config/stripe.js`
- [https://openai.com/api/pricing](https://openai.com/api/pricing)
- [https://www.anthropic.com/pricing](https://www.anthropic.com/pricing)
- [https://docs.anthropic.com/en/docs/about-claude/pricing](https://docs.anthropic.com/en/docs/about-claude/pricing)
- [https://api-docs.deepseek.com/quick_start/pricing/](https://api-docs.deepseek.com/quick_start/pricing/)
- [https://docs.z.ai/guides/overview/pricing](https://docs.z.ai/guides/overview/pricing)
- [https://platform.minimax.io/docs/api-reference/anthropic-api-compatible-cache](https://platform.minimax.io/docs/api-reference/anthropic-api-compatible-cache)
- [https://huggingface.co/docs/inference-providers/pricing](https://huggingface.co/docs/inference-providers/pricing)
