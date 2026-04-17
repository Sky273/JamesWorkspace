# Coûts LLM et Projection Tarifaire

**Date :** 17 avril 2026  
**Statut :** note de cadrage économique  
**Périmètre :** coûts IA variables, option modèle local, projection de packs de crédits rentables

---

## 1. Résumé exécutif

ResumeConverter facture l'IA en **crédits métier** et non en appels provider bruts. Cette logique tient toujours après mise à jour avec les modèles publics les plus récents.

Au 17 avril 2026 :

- **OpenAI** expose désormais `GPT-5.4`, `GPT-5.4 mini` et `GPT-5.4 nano`
- **Anthropic** expose désormais `Claude Opus 4.7` et `Claude Haiku 4.5`, en plus de `Claude Sonnet 4`
- **Z.AI** expose `GLM-5.1` côté catalogue et release notes, mais sans ligne tarifaire publique distincte ; `GLM-5` reste la meilleure base officielle de projection
- **MiniMax** expose `M2.7` comme référence récente, au même prix token public que `M2.1`

Conclusion commerciale :

- la grille Stripe actuelle reste **premium-safe**
- une grille plus agressive reste viable si le mix réel reste dominé par `DeepSeek`, `MiniMax`, `GLM`, `GPT-5.4 mini` ou du local `Ollama`

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

- `resume.improvement` inclut génération + post-analyse
- `profile.search` inclut extraction keywords + scoring + explications

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

| Provider / modèle | Input USD / 1M | Output USD / 1M | Notes |
| --- | ---: | ---: | --- |
| OpenAI GPT-5.4 | 2.50 | 15.00 | Latest public OpenAI flagship visible on 2026-04-17 |
| OpenAI GPT-5.4 mini | 0.75 | 4.50 | Latest public OpenAI mini baseline |
| OpenAI GPT-5.4 nano | 0.20 | 1.25 | Cheapest public GPT-5.4-class option |
| Anthropic Claude Opus 4.7 | 5.00 | 25.00 | Latest public Anthropic premium model, published 2026-04-16 |
| Anthropic Claude Sonnet 4 | 3.00 | 15.00 | Stable public mid-tier baseline |
| Anthropic Claude Haiku 4.5 | 1.00 | 5.00 | Fast and cheaper recent option |
| DeepSeek V3.2 (`deepseek-chat`) | 0.28 | 0.42 | Cache-hit input can be much lower |
| Z.AI GLM-5 | 1.00 | 3.20 | Official public pricing proxy for GLM-5.1 |
| Z.AI GLM-5-Turbo | 1.20 | 4.00 | Official public high-end visible row |
| Z.AI GLM-4.7 | 0.60 | 2.20 | Still publicly priced |
| MiniMax M2.7 | 0.30 | 1.20 | Latest public MiniMax flagship family row |
| Hugging Face routed inference | provider-dependent | provider-dependent | Pas de markup selon HF |

Notes importantes :

- `GLM-5.1` est visible dans le catalogue public Z.AI et dans les release notes du 7 avril 2026.
- En revanche, la page de pricing publique Z.AI ne donne pas encore de ligne distincte `GLM-5.1`.
- Cette note utilise donc **GLM-5 comme proxy officiel le plus proche** pour les projections liées à `GLM-5.1`.
- C'est une **inférence à partir des sources**, pas un prix public distinct de `GLM-5.1`.

---

## 4. Hypothèses de consommation retenues

Le code définit des plafonds de tokens, mais pas encore un historique stable de **médianes réelles par `actionType`**. La projection utilise donc une enveloppe opérationnelle raisonnable.

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

## 5. Coût variable indicatif avec les derniers modèles

### 5.1 Coût par action sur des actions lourdes et visibles

| Action | GPT-5.4 | GPT-5.4 mini | Claude Opus 4.7 | GLM-5 proxy pour 5.1 | MiniMax M2.7 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `chatbot.message` | 0.0155 $ | 0.0046 $ | 0.0275 $ | 0.0042 $ | 0.0014 $ |
| `resume.analysis` | 0.1100 $ | 0.0330 $ | 0.1950 $ | 0.0300 $ | 0.0102 $ |
| `resume.improvement` | 0.2500 $ | 0.0750 $ | 0.4400 $ | 0.0664 $ | 0.0228 $ |
| `resume.adaptation` | 0.1300 $ | 0.0390 $ | 0.2300 $ | 0.0352 $ | 0.0120 $ |
| `template.extract` | 0.1100 $ | 0.0330 $ | 0.2000 $ | 0.0328 $ | 0.0108 $ |

Lecture :

- `GPT-5.4` et `Claude Opus 4.7` augmentent fortement le coût variable
- mais même sur `resume.improvement`, on reste loin d'une remise en cause de la rentabilité des packs actuels

### 5.2 Coût représentatif pour 1000 crédits

Panier métier utilisé :

- 4 améliorations
- 6 analyses
- 4 adaptations
- 6 extractions de template
- 10 matchings
- 10 profile searches
- 6 modifications IA
- 30 messages chatbot

| Politique LLM dominante | Coût variable IA pour 1000 crédits |
| --- | ---: |
| DeepSeek V3.2 | 0.2729 $ |
| MiniMax M2.7 | 0.4416 $ |
| Z.AI GLM-4.7 | 0.8434 $ |
| Z.AI GLM-5 (proxy GLM-5.1) | 1.3128 $ |
| OpenAI GPT-5.4 mini | 1.4025 $ |
| Anthropic Claude Haiku 4.5 | 1.6710 $ |
| OpenAI GPT-5.4 | 4.6750 $ |
| Anthropic Claude Sonnet 4 | 5.0130 $ |
| Anthropic Claude Opus 4.7 | 8.3550 $ |

Cette lecture change la hiérarchie mais pas la conclusion :

- les packs actuels sont toujours très sûrs
- la vraie variable stratégique n'est pas la survie économique, mais le positionnement commercial

---

## 6. Option modèle local

Pour **Ollama** ou un modèle local auto-hébergé, il n'existe pas de prix officiel au million de tokens comparable aux APIs SaaS.

Le bon modèle économique est donc :

- coût d'infrastructure
- coût d'exploitation
- coût d'amortissement matériel

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

- le local n'est pas forcément le moins cher à faible volume
- il devient très intéressant si le volume est stable ou si le client porte lui-même l'infrastructure

---

## 7. Tableau de tarifs recommandé

### Option A : budget / local-first

À utiliser si le runtime standard est dominé par :

- DeepSeek
- MiniMax
- GLM
- Ollama local
- GPT-5.4 mini ou nano

| Pack | Crédits | Tarif recommandé |
| --- | ---: | ---: |
| Starter | 250 | 12 € |
| Growth | 750 | 35 € |
| Scale | 2000 | 89 € |

### Option B : universal hosted

À utiliser si le runtime standard reste surtout sur :

- GPT-5.4 mini
- GLM-5 / GLM-5.1
- Claude Haiku 4.5
- DeepSeek
- MiniMax

| Pack | Crédits | Tarif recommandé |
| --- | ---: | ---: |
| Starter | 250 | 19 € |
| Growth | 750 | 55 € |
| Scale | 2000 | 139 € |

### Option C : premium-safe

À utiliser si des workflows lourds peuvent basculer fréquemment sur :

- GPT-5.4
- Claude Sonnet 4
- Claude Opus 4.7

| Pack | Crédits | Tarif recommandé |
| --- | ---: | ---: |
| Starter | 250 | 29 € |
| Growth | 750 | 79 € |
| Scale | 2000 | 199 € |

Cette option correspond à la configuration Stripe actuelle.

---

## 8. Recommandation commerciale

### Position la plus prudente

Conserver :

- Starter 250 crédits : 29 €
- Growth 750 crédits : 79 €
- Scale 2000 crédits : 199 €

### Position la plus agressive mais encore saine

Passer à :

- Starter 250 crédits : 19 €
- Growth 750 crédits : 55 €
- Scale 2000 crédits : 139 €

uniquement si le mix réel reste dominé par les modèles budget/mid-tier récents.

---

## 9. Limites de cette projection

- La projection repose sur des hypothèses de tokens par action, pas encore sur des médianes de production historisées.
- `GLM-5.1` est bien un modèle public récent, mais sans ligne de prix publique distincte visible au 17 avril 2026.
- Si certains cabinets activent des providers premium et d'autres non, une future grille pourra devoir dépendre d'une **politique provider par cabinet**.

---

## 10. Sources

- `server/config/aiCredits.js`
- `server/config/stripe.js`
- [https://openai.com/api/pricing](https://openai.com/api/pricing)
- [https://developers.openai.com/api/docs/models/gpt-5.4/](https://developers.openai.com/api/docs/models/gpt-5.4/)
- [https://www.anthropic.com/pricing](https://www.anthropic.com/pricing)
- [https://www.anthropic.com/claude/opus](https://www.anthropic.com/claude/opus)
- [https://www.anthropic.com/claude/haiku](https://www.anthropic.com/claude/haiku)
- [https://api-docs.deepseek.com/quick_start/pricing/](https://api-docs.deepseek.com/quick_start/pricing/)
- [https://docs.z.ai/guides/overview/overview](https://docs.z.ai/guides/overview/overview)
- [https://docs.z.ai/guides/overview/pricing](https://docs.z.ai/guides/overview/pricing)
- [https://docs.z.ai/release-notes/new-released](https://docs.z.ai/release-notes/new-released)
- [https://platform.minimax.io/docs/api-reference/text-anthropic-api](https://platform.minimax.io/docs/api-reference/text-anthropic-api)
- [https://platform.minimax.io/docs/api-reference/anthropic-api-compatible-cache](https://platform.minimax.io/docs/api-reference/anthropic-api-compatible-cache)
- [https://huggingface.co/docs/inference-providers/pricing](https://huggingface.co/docs/inference-providers/pricing)
