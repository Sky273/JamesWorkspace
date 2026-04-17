# Présentation Exécutive - Choix de LLM et Politique Tarifaire

**Date :** 17 avril 2026  
**Source :** synthèse de `docs/LLM_COST_MODEL_AND_PRICING.md` et `docs/COST_ANALYSIS.md`  
**Public visé :** direction, produit, commerce, opérations

---

## Slide 1 - Décision à prendre

**Objectif**

Définir une politique LLM et une grille tarifaire qui permettent simultanément :

- une qualité perçue élevée sur les usages CV les plus visibles
- une marge robuste sur les packs de crédits
- une gouvernance simple à expliquer commercialement

**Décisions attendues**

1. quel LLM par défaut pour les usages standards
2. quel LLM pour les usages premium ou sensibles
3. quelle grille tarifaire crédit retenir selon le positionnement commercial

---

## Slide 2 - Ce que vend réellement ResumeConverter

ResumeConverter ne vend pas des appels API bruts.  
L'application vend des **actions métier**, converties en crédits :

- chatbot
- analyse de CV
- amélioration de CV
- adaptation de CV à une mission
- extraction de template
- matching et recherche de profils

**Implication**

Le bon niveau de pilotage économique n'est pas le coût au token isolé, mais le **coût variable par action métier** et par panier de crédits.

---

## Slide 3 - Packs vendus aujourd'hui

| Pack | Crédits | Prix TTC |
| --- | ---: | ---: |
| Starter | 250 | 29 € |
| Growth | 750 | 79 € |
| Scale | 2000 | 199 € |

Équivalent prix de vente :

- Starter : **116 €/1000 crédits**
- Growth : **105,33 €/1000 crédits**
- Scale : **99,50 €/1000 crédits**

**Lecture direction**

La grille actuelle est déjà positionnée comme une grille **premium-safe**.

---

## Slide 4 - Derniers modèles publics pris en compte

### OpenAI

- GPT-5.4
- GPT-5.4 mini
- GPT-5.4 nano

### Anthropic

- Claude Opus 4.7
- Claude Sonnet 4
- Claude Haiku 4.5

### Z.AI

- GLM-5.1 visible publiquement
- pricing distinct non visible publiquement à date
- projection réalisée avec **GLM-5** comme proxy officiel le plus proche

### Autres options pertinentes

- DeepSeek V3.2
- MiniMax M2.7
- Ollama / modèle local auto-hébergé

---

## Slide 5 - Lecture simple des coûts

### Coût estimé pour 1000 crédits consommés

| Politique LLM dominante | Coût variable IA |
| --- | ---: |
| DeepSeek V3.2 | 0,27 $ |
| MiniMax M2.7 | 0,44 $ |
| GLM-4.7 | 0,84 $ |
| GLM-5 proxy pour GLM-5.1 | 1,31 $ |
| GPT-5.4 mini | 1,40 $ |
| Claude Haiku 4.5 | 1,67 $ |
| GPT-5.4 | 4,68 $ |
| Claude Sonnet 4 | 5,01 $ |
| Claude Opus 4.7 | 8,36 $ |

**Message clé**

Même avec des modèles premium, la grille actuelle reste rentable.  
La vraie décision n'est donc pas la survie économique, mais le **meilleur arbitrage qualité / marge / simplicité commerciale**.

---

## Slide 6 - Ce que coûtent les usages les plus visibles

| Action métier | GPT-5.4 | GPT-5.4 mini | Claude Opus 4.7 | GLM-5 proxy 5.1 | MiniMax M2.7 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Analyse de CV | 0,11 $ | 0,033 $ | 0,195 $ | 0,030 $ | 0,010 $ |
| Amélioration de CV | 0,25 $ | 0,075 $ | 0,44 $ | 0,066 $ | 0,023 $ |
| Adaptation de CV | 0,13 $ | 0,039 $ | 0,23 $ | 0,035 $ | 0,012 $ |
| Extraction de template | 0,11 $ | 0,033 $ | 0,20 $ | 0,033 $ | 0,011 $ |

**Lecture**

- `GPT-5.4` et `Claude Opus 4.7` améliorent potentiellement la qualité, mais augmentent fortement le coût unitaire
- `GPT-5.4 mini`, `GLM-5` et `MiniMax M2.7` offrent un compromis économique très confortable

---

## Slide 7 - Option modèle local

### Hypothèse de travail

- coût complet local ou Ollama : **250 € / mois**

### Coût ramené à 1000 crédits

| Volume mensuel | Coût local ramené à 1000 crédits |
| --- | ---: |
| 20 paniers / mois | 12,50 € |
| 50 paniers / mois | 5,00 € |
| 100 paniers / mois | 2,50 € |

**Conclusion**

- le local n'est pas automatiquement moins cher à faible volume
- il devient intéressant si :
  - le volume est stable
  - le client veut une option souveraine
  - l'infrastructure est portée par le client

---

## Slide 8 - Trois stratégies possibles

### Option A - Budget / local-first

À privilégier si la plateforme repose surtout sur :

- DeepSeek
- MiniMax
- GLM
- Ollama local
- GPT-5.4 mini / nano

**Avantage :** prix très agressif  
**Risque :** perception premium plus difficile sur certains cas complexes

### Option B - Hosted universal

À privilégier si le standard produit reste surtout sur :

- GPT-5.4 mini
- GLM-5
- Claude Haiku 4.5
- DeepSeek / MiniMax selon disponibilité

**Avantage :** très bon compromis qualité / coût  
**Risque :** nécessite une gouvernance claire des fallbacks

### Option C - Premium-safe

À privilégier si l'on veut préserver la liberté d'utiliser :

- GPT-5.4
- Claude Sonnet 4
- ponctuellement Claude Opus 4.7

**Avantage :** tranquillité économique et narrative premium  
**Risque :** prix plus élevé à défendre commercialement

---

## Slide 9 - Grilles tarifaires projetées

| Option | Starter 250 | Growth 750 | Scale 2000 | Positionnement |
| --- | ---: | ---: | ---: | --- |
| A - Budget / local-first | 12 € | 35 € | 89 € | offensif |
| B - Hosted universal | 19 € | 55 € | 139 € | équilibré |
| C - Premium-safe | 29 € | 79 € | 199 € | sécurisant |

**Lecture direction**

- l'option A maximise l'acquisition, mais suppose une discipline stricte sur le mix LLM
- l'option B est la meilleure candidate si l'objectif est d'accélérer commercialement sans fragiliser la marge
- l'option C reste la meilleure option si l'on assume un produit premium avec liberté de provider

---

## Slide 10 - Recommandation

### Recommandation de fonctionnement

- **standard runtime** : `GPT-5.4 mini`, `GLM-5/5.1`, `MiniMax M2.7`, `DeepSeek V3.2`
- **premium ou cas sensibles** : `GPT-5.4`, `Claude Sonnet 4`
- **exception haut de gamme** : `Claude Opus 4.7` uniquement sur usages justifiés
- **option souveraine / grand compte** : `Ollama` ou modèle local en offre spécifique

### Recommandation tarifaire

**Choix recommandé : Option B - Hosted universal**

| Pack | Tarif recommandé |
| --- | ---: |
| Starter 250 | 19 € |
| Growth 750 | 55 € |
| Scale 2000 | 139 € |

### Pourquoi

- plus agressif commercialement que la grille actuelle
- encore très rentable avec un mix raisonnable de modèles modernes
- suffisamment simple à expliquer en interne et en vente

---

## Slide 11 - Conditions de succès

Pour tenir ce modèle sans dérive :

- gouverner le provider par type d'action métier
- éviter les modèles premium en défaut sur les workflows lourds
- exposer les métriques de fallback et de coût par opération
- distinguer clairement :
  - offre standard
  - offre premium
  - offre souveraine / local model

---

## Slide 12 - Décision proposée à la hiérarchie

### À valider

1. retenir une stratégie **Hosted universal** comme cible par défaut
2. conserver la grille actuelle comme référence haute
3. lancer un test commercial de la grille :
   - Starter 19 €
   - Growth 55 €
   - Scale 139 €
4. réserver les modèles premium complets aux usages à forte valeur ou aux offres supérieures
5. formaliser une offre locale / souveraine en option séparée, pas dans le standard

### Message final

La plateforme est déjà économiquement saine.  
La décision à prendre porte maintenant sur le **positionnement commercial** et sur la **discipline de gouvernance LLM**, pas sur la faisabilité financière de base.
