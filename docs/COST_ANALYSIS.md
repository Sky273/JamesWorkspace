# Étude du Coût d'Utilisation de l'IA - ResumeConverter

**Date :** Février 2026  
**Version :** 1.0

---

## 1. Résumé Exécutif

Cette étude analyse les coûts d'utilisation des API d'intelligence artificielle dans l'application ResumeConverter. L'application utilise principalement **OpenAI** (GPT-4o, GPT-5.x) et **Anthropic** (Claude 3.5 Sonnet) pour diverses fonctionnalités d'assistance à la gestion de CV.

---

## 2. Modèles d'IA Utilisés

### 2.1 Fournisseurs Supportés

| Fournisseur | Modèles Supportés | Usage Principal |
|-------------|-------------------|-----------------|
| **OpenAI** | GPT-4o, GPT-4o-mini, GPT-4.1, GPT-5, GPT-5.2, GPT-5.2-pro | Analyse CV, Amélioration, Matching |
| **Anthropic** | Claude 3.5 Sonnet, Claude 3 Haiku, Claude 3 Opus | Alternative pour traitement CV |

### 2.2 Tarification Officielle (par million de tokens)

#### OpenAI (Février 2026)

| Modèle | Input ($/1M tokens) | Output ($/1M tokens) | Cached Input | Notes |
|--------|---------------------|----------------------|--------------|-------|
| **gpt-5.2** | $1.75 | $14.00 | $0.175 | Modèle de référence |
| **gpt-5.2-pro** | $21.00 | $168.00 | - | Raisonnement avancé |
| **gpt-5.1** | $1.25 | $10.00 | $0.125 | Version précédente |
| **gpt-5** | $1.25 | $10.00 | $0.125 | Génération 5 |
| **gpt-5-mini** | $0.25 | $2.00 | $0.025 | Économique |
| **gpt-5-nano** | $0.05 | $0.40 | $0.005 | Ultra-économique |
| **gpt-4o** | $2.50 | $10.00 | $1.25 | Génération 4 optimisée |
| **gpt-4o-mini** | $0.15 | $0.60 | $0.075 | Économique |
| **gpt-4.1** | $2.00 | $8.00 | $0.50 | Génération 4.1 |
| **gpt-4.1-mini** | $0.40 | $1.60 | $0.10 | Version légère |
| **gpt-4.1-nano** | $0.10 | $0.40 | $0.025 | Ultra-économique |
| **o1** | $15.00 | $60.00 | $7.50 | Raisonnement |
| **o1-mini** | $1.10 | $4.40 | $0.55 | Raisonnement léger |
| **o3** | $2.00 | $8.00 | $0.50 | Nouveau raisonnement |
| **o3-mini** | $1.10 | $4.40 | $0.55 | Raisonnement léger |
| **o4-mini** | $1.10 | $4.40 | $0.275 | Dernière génération |

#### Anthropic (Février 2026)

| Modèle | Input ($/1M tokens) | Output ($/1M tokens) | Notes |
|--------|---------------------|----------------------|-------|
| **Claude 3.5 Sonnet** | $3.00 | $15.00 | Modèle par défaut |
| **Claude 3 Opus** | $15.00 | $75.00 | Haute qualité |
| **Claude 3 Haiku** | $0.25 | $1.25 | Ultra-économique |

---

## 3. Cas d'Utilisation et Estimation des Tokens

*Les sections suivent l'ordre du menu latéral de l'application.*

---

### 📄 3.1 CVs (Menu: CVs)

Cette section regroupe toutes les fonctionnalités IA liées à la gestion des CV.

#### 3.1.1 Analyse de CV

**Fichier :** `server/services/openai.service.js` (analyzeResume)

| Paramètre | Valeur |
|-----------|--------|
| **max_tokens (output)** | 4,096 |
| **Prompt système** | ~50 tokens |
| **Prompt d'analyse** | ~1,500 tokens (template avec instructions) |
| **CV texte** | ~2,000 - 8,000 tokens |

**Estimation par requête :**
- **Input :** ~3,550 - 9,550 tokens
- **Output :** ~1,500 - 3,000 tokens (JSON avec notes, tags, suggestions)

**Coût par requête (GPT-5.2) :**
- Input : 6,550 tokens × $1.75/1M = **$0.011**
- Output : 2,250 tokens × $14.00/1M = **$0.032**
- **Total : ~$0.043 par analyse**

**Note :** L'analyse de CV est effectuée automatiquement lors de l'upload d'un CV et génère :
- Notes par section (Global, Summary, Skills, Experience, Education, etc.)
- Tags extraits (compétences, outils, industries, soft skills)
- Suggestions d'amélioration par section

#### 3.1.2 Amélioration de CV

**Fichier :** `server/services/openai.service.js` (improveResume)

| Paramètre | Valeur |
|-----------|--------|
| **max_tokens (output)** | 8,192 |
| **Prompt système** | ~500 tokens |
| **CV complet** | ~3,000 - 15,000 tokens |

**Estimation par requête :**
- **Input :** ~3,500 - 15,500 tokens
- **Output :** ~4,000 - 8,000 tokens (CV amélioré)

**Coût par requête (GPT-5.2) :**
- Input : 9,500 tokens × $1.75/1M = **$0.017**
- Output : 6,000 tokens × $14.00/1M = **$0.084**
- **Total : ~$0.101 par amélioration**

#### 3.1.3 Modification de CV par IA

**Fichier :** `server/routes/resumes/aiModify.handler.js`

| Paramètre | Valeur |
|-----------|--------|
| **max_tokens (output)** | 8,192 |
| **Prompt système** | ~800 tokens |
| **CV HTML (input)** | ~2,000 - 10,000 tokens |
| **Instructions utilisateur** | ~50 - 500 tokens |

**Estimation par requête :**
- **Input :** ~2,850 - 11,300 tokens
- **Output :** ~2,000 - 6,000 tokens (CV modifié)

**Coût par requête (GPT-5.2) :**
- Input : 7,075 tokens × $1.75/1M = **$0.012**
- Output : 4,000 tokens × $14.00/1M = **$0.056**
- **Total : ~$0.068 par modification**

---

### 💼 3.2 Missions (Menu: Missions)

Cette section regroupe les fonctionnalités IA liées à la gestion des missions/offres.

#### 3.2.1 Extraction de Mots-clés de Mission

**Fichier :** `server/services/profileMatching.service.js`

| Paramètre | Valeur |
|-----------|--------|
| **max_tokens (output)** | 1,024 |
| **Prompt système** | ~100 tokens |
| **Description mission** | ~500 - 2,000 tokens |

**Estimation par requête :**
- **Input :** ~600 - 2,100 tokens
- **Output :** ~200 - 500 tokens (JSON keywords)

**Coût par requête (GPT-5.2) :**
- Input : 1,350 tokens × $1.75/1M = **$0.002**
- Output : 350 tokens × $14.00/1M = **$0.005**
- **Total : ~$0.007 par extraction**

**Note :** L'extraction est effectuée automatiquement lors de la création/modification d'une mission pour identifier les compétences, outils et industries requis.

---

### 👥 3.3 Profile Matching (Menu: Profile Matching)

Cette section regroupe les fonctionnalités IA de matching entre CV et missions.

#### 3.3.1 Matching CV-Mission

**Fichier :** `server/services/openai.service.js` (matchResumeToMission)

| Paramètre | Valeur |
|-----------|--------|
| **max_tokens (output)** | 2,048 |
| **Prompt système** | ~200 tokens |
| **CV + Mission** | ~3,000 - 8,000 tokens |

**Estimation par requête :**
- **Input :** ~3,200 - 8,200 tokens
- **Output :** ~500 - 1,000 tokens (score + analyse)

**Coût par requête (GPT-5.2) :**
- Input : 5,700 tokens × $1.75/1M = **$0.010**
- Output : 750 tokens × $14.00/1M = **$0.011**
- **Total : ~$0.021 par matching**

#### 3.3.2 Analyse Détaillée de Profil

**Fichier :** `server/services/profileMatching.service.js`

| Paramètre | Valeur |
|-----------|--------|
| **max_tokens (output)** | 2,048 |
| **Prompt système** | ~100 tokens |
| **CV + Mission** | ~3,000 - 8,000 tokens |

**Estimation par requête :**
- **Input :** ~3,100 - 8,100 tokens
- **Output :** ~500 - 1,500 tokens (analyse JSON)

**Coût par requête (GPT-5.2) :**
- Input : 5,600 tokens × $1.75/1M = **$0.010**
- Output : 1,000 tokens × $14.00/1M = **$0.014**
- **Total : ~$0.024 par analyse**

---

### ✨ 3.4 Adaptations (Menu: Adaptations)

Cette section regroupe les fonctionnalités IA d'adaptation de CV aux missions.

#### 3.4.1 Adaptation de CV à une Mission

**Fichier :** `server/services/openai.service.js` (adaptResumeToMission)

| Paramètre | Valeur |
|-----------|--------|
| **max_tokens (output)** | 4,096 |
| **Prompt système** | ~300 tokens |
| **CV + Mission** | ~4,000 - 12,000 tokens |

**Estimation par requête :**
- **Input :** ~4,300 - 12,300 tokens
- **Output :** ~2,000 - 4,000 tokens (CV adapté)

**Coût par requête (GPT-5.2) :**
- Input : 8,300 tokens × $1.75/1M = **$0.015**
- Output : 3,000 tokens × $14.00/1M = **$0.042**
- **Total : ~$0.057 par adaptation**

---

### 📡 3.5 Market Radar (Menu: Market Radar)

*Aucun appel LLM direct.* Cette fonctionnalité utilise des API externes (France Travail, Adzuna) pour collecter les données du marché de l'emploi sans recours à l'IA générative.

---

### 💬 3.6 Chatbot Assistant (Accessible partout)

**Fichier :** `server/routes/chatbot.routes.js`

| Paramètre | Valeur |
|-----------|--------|
| **max_tokens (output)** | 1,000 (par défaut) |
| **Contexte système** | ~15,000 tokens (guide utilisateur inclus) |
| **Message utilisateur** | ~50-200 tokens |
| **Historique conversation** | ~500-2,000 tokens (variable) |

**Estimation par requête :**
- **Input :** ~15,500 - 17,200 tokens
- **Output :** ~200 - 800 tokens

**Coût par requête (GPT-5.2) :**
- Input : 16,350 tokens × $1.75/1M = **$0.029**
- Output : 500 tokens × $14.00/1M = **$0.007**
- **Total : ~$0.036 par message**

---

## 4. Tableau Récapitulatif des Coûts

### 4.1 Coût par Fonctionnalité (GPT-5.2)

*Organisé selon l'ordre du menu latéral*

| Menu | Fonctionnalité | Input (tokens) | Output (tokens) | Coût Input | Coût Output | **Coût Total** |
|------|----------------|----------------|-----------------|------------|-------------|----------------|
| 📄 CVs | Analyse CV | ~6,550 | ~2,250 | $0.011 | $0.032 | **$0.043** |
| 📄 CVs | Amélioration CV | ~9,500 | ~6,000 | $0.017 | $0.084 | **$0.101** |
| 📄 CVs | Modification CV | ~7,075 | ~4,000 | $0.012 | $0.056 | **$0.068** |
| 💼 Missions | Extraction keywords | ~1,350 | ~350 | $0.002 | $0.005 | **$0.007** |
| 👥 Matching | Matching CV-Mission | ~5,700 | ~750 | $0.010 | $0.011 | **$0.021** |
| 👥 Matching | Analyse profil | ~5,600 | ~1,000 | $0.010 | $0.014 | **$0.024** |
| ✨ Adaptations | Adaptation CV | ~8,300 | ~3,000 | $0.015 | $0.042 | **$0.057** |
| 📡 Market Radar | - | - | - | - | - | **$0.00** |
| 💬 Chatbot | Message | ~16,350 | ~500 | $0.029 | $0.007 | **$0.036** |

### 4.2 Comparaison par Modèle (pour Amélioration CV : 9,500 tokens in / 6,000 tokens out)

| Modèle | Coût Input | Coût Output | **Coût Total** | Économie vs GPT-5.2 |
|--------|------------|-------------|----------------|-------------------|
| gpt-5-nano | $0.0005 | $0.0024 | **$0.003** | -97% |
| gpt-4.1-nano | $0.001 | $0.002 | **$0.003** | -97% |
| gpt-4o-mini | $0.001 | $0.004 | **$0.005** | -95% |
| gpt-5-mini | $0.002 | $0.012 | **$0.014** | -86% |
| gpt-4.1-mini | $0.004 | $0.010 | **$0.014** | -86% |
| gpt-4o | $0.024 | $0.060 | **$0.084** | -17% |
| gpt-4.1 | $0.019 | $0.048 | **$0.067** | -34% |
| gpt-5 / gpt-5.1 | $0.012 | $0.060 | **$0.072** | -29% |
| Claude 3 Haiku | $0.002 | $0.008 | **$0.010** | -90% |
| Claude 3.5 Sonnet | $0.029 | $0.090 | **$0.119** | +18% |
| **gpt-5.2** | **$0.017** | **$0.084** | **$0.101** | **Référence** |
| gpt-5.2-pro | $0.200 | $1.008 | **$1.208** | +1096% |

---

## 5. Scénarios d'Utilisation

### 5.1 Utilisateur Occasionnel (5 CV/mois)

| Action | Fréquence | Coût unitaire | **Coût mensuel** |
|--------|-----------|---------------|------------------|
| Analyse CV (upload) | 5 | $0.043 | $0.22 |
| Amélioration CV | 5 | $0.101 | $0.51 |
| Chatbot (10 messages) | 10 | $0.036 | $0.36 |
| Modification CV | 3 | $0.068 | $0.20 |
| **TOTAL** | | | **$1.29/mois** |

### 5.2 Utilisateur Actif (20 CV/mois)

| Action | Fréquence | Coût unitaire | **Coût mensuel** |
|--------|-----------|---------------|------------------|
| Analyse CV (upload) | 20 | $0.043 | $0.86 |
| Amélioration CV | 20 | $0.101 | $2.02 |
| Adaptation CV | 15 | $0.057 | $0.86 |
| Matching | 30 | $0.021 | $0.63 |
| Chatbot (50 messages) | 50 | $0.036 | $1.80 |
| Modification CV | 10 | $0.068 | $0.68 |
| **TOTAL** | | | **$6.85/mois** |

### 5.3 Entreprise (100 utilisateurs actifs)

| Métrique | Valeur |
|----------|--------|
| Coût moyen par utilisateur | $6.85/mois |
| Nombre d'utilisateurs | 100 |
| **Coût mensuel estimé** | **$685/mois** |
| **Coût annuel estimé** | **$8,220/an** |

---

## 6. Optimisations Recommandées

### 6.1 Réduction des Coûts

1. **Utiliser GPT-4o-mini pour le chatbot**
   - Économie : ~90% sur les messages chatbot
   - Impact : Qualité légèrement réduite mais acceptable pour l'assistance

2. **Caching des réponses fréquentes**
   - Stocker les analyses de missions récurrentes
   - Éviter les appels redondants pour le même CV

3. **Modèles adaptés par fonctionnalité**
   - Chatbot : gpt-5-mini ou gpt-4o-mini
   - Amélioration CV : gpt-5.2 (qualité importante)
   - Extraction keywords : gpt-5-nano ou gpt-4.1-nano

4. **Limiter le contexte du chatbot**
   - Charger uniquement les sections pertinentes du guide
   - Réduire l'historique de conversation

### 6.2 Configuration Recommandée par Fonctionnalité

| Fonctionnalité | Coût GPT-5.2 | Modèle Optimisé | Coût Optimisé | Économie |
|----------------|--------------|------------------|---------------|----------|
| Chatbot | $0.036 | gpt-5-mini | $0.007 | -81% |
| Modification CV | $0.068 | gpt-5 | $0.051 | -25% |
| Extraction keywords | $0.007 | gpt-5-nano | $0.001 | -86% |
| Analyse profil | $0.024 | gpt-5-mini | $0.005 | -79% |
| **Amélioration CV** | **$0.101** | **gpt-5.2** | **$0.101** | **0%** |
| Adaptation CV | $0.057 | gpt-5 | $0.043 | -25% |
| Matching | $0.021 | gpt-5-mini | $0.004 | -81% |
| **Analyse CV** | **$0.043** | **gpt-5.2** | **$0.043** | **0%** |

**Économie potentielle avec optimisation : ~40-50%**

---

## 7. Suivi des Coûts

L'application intègre un système de métriques (`server/services/metrics.service.js`) qui :

- Suit les tokens input/output par requête
- Calcule les coûts par fournisseur
- Agrège les statistiques d'utilisation

### Accès aux métriques

Les métriques sont accessibles via l'API d'administration et incluent :
- Nombre total de requêtes LLM
- Tokens consommés (input/output)
- Coût estimé par période
- Répartition par modèle

---

## 8. Conclusion

| Métrique | Valeur (GPT-5.2) |
|----------|------------------|
| **Coût moyen par action** | $0.02 - $0.10 |
| **Coût utilisateur occasionnel** | ~$1.30/mois |
| **Coût utilisateur actif** | ~$7/mois |
| **Potentiel d'optimisation** | 40-50% |

L'utilisation de l'IA dans ResumeConverter représente un coût modéré et prévisible. Les principales recommandations sont :

1. **Utiliser des modèles économiques** pour les tâches simples (chatbot, extraction)
2. **Réserver les modèles premium** pour les tâches critiques (amélioration CV)
3. **Implémenter du caching** pour réduire les appels redondants
4. **Monitorer les coûts** via le système de métriques intégré

---

*Document généré automatiquement - Février 2026*
