# Analyse des Alternatives à ChatGPT 5.2

**Date :** Février 2026  
**Application :** ResumeConverter  
**Version actuelle :** GPT-5.2 (OpenAI) via Responses API

---

## 1. Contexte et Utilisation Actuelle

### 1.1 Modèle Actuel
L'application utilise actuellement **GPT-5.2** d'OpenAI comme modèle LLM principal, avec support pour :
- **GPT-5.2** (standard) - reasoning.effort = "none"
- **GPT-5.2-pro** - reasoning.effort = "medium" (raisonnement avancé)
- **Claude 3.5 Sonnet** (Anthropic) comme alternative

### 1.2 Cas d'Usage dans l'Application

| Fonctionnalité | Description | Complexité | Tokens moyens |
|----------------|-------------|------------|---------------|
| **Analyse de CV** | Extraction structurée (nom, titre, compétences, expériences) | Élevée | 4000-8000 |
| **Amélioration de CV** | Suggestions de reformulation et optimisation ATS | Élevée | 4000-6000 |
| **Matching Mission/Profil** | Comparaison CV vs offre d'emploi | Moyenne | 2000-4000 |
| **Chatbot Assistant** | Réponses conversationnelles | Faible | 500-1500 |
| **Extraction de tags** | Identification compétences, outils, secteurs | Moyenne | 1000-2000 |

### 1.3 Exigences Techniques
- **Format de sortie** : JSON structuré (response_format: json_object)
- **Latence acceptable** : < 30s pour analyse, < 10s pour chat
- **Contexte** : 8K-32K tokens (CV + instructions)
- **Langue** : Français principalement, anglais secondaire
- **Confidentialité** : Données RH sensibles (CV, informations personnelles)

---

## 2. Modèles Cloud Commerciaux

### 2.1 OpenAI GPT-4o / GPT-4o-mini

| Critère | Évaluation |
|---------|------------|
| **Qualité** | ⭐⭐⭐⭐ Excellente, proche de GPT-5 |
| **Coût** | ⭐⭐⭐⭐⭐ 50-80% moins cher que GPT-5 |
| **Latence** | ⭐⭐⭐⭐⭐ Plus rapide que GPT-5 |
| **Compatibilité** | ⭐⭐⭐⭐⭐ Même API, migration triviale |
| **JSON structuré** | ⭐⭐⭐⭐⭐ Natif |

**Pertinence : 95%**

**Avantages :**
- Même infrastructure, aucune modification de code
- Coût significativement réduit
- Latence inférieure
- Très bonne qualité pour l'analyse de CV

**Inconvénients :**
- Légèrement moins performant sur le raisonnement complexe
- Pas de mode "reasoning" avancé

**Recommandation :** Excellent fallback, idéal pour réduire les coûts sans sacrifier la qualité.

---

### 2.2 Anthropic Claude 4.6 Sonnet / Claude 4.5 Sonnet

| Critère | Claude 4.6 Sonnet | Claude 4.5 Sonnet | Claude 3.5 Sonnet |
|---------|-------------------|-------------------|-------------------|
| **Qualité** | ⭐⭐⭐⭐⭐ Exceptionnelle | ⭐⭐⭐⭐⭐ Excellente | ⭐⭐⭐⭐ Très bonne |
| **Coût** | $6-18/1M tokens | $4-12/1M tokens | $3-15/1M tokens |
| **Latence** | Rapide | Très rapide | Rapide |
| **Contexte** | 200K tokens | 200K tokens | 200K tokens |
| **JSON structuré** | ⭐⭐⭐⭐⭐ Excellent | ⭐⭐⭐⭐⭐ Excellent | ⭐⭐⭐⭐ Bon |

#### Claude 4.6 Sonnet (Dernière génération)

**Pertinence : 95%**

| Critère | Évaluation |
|---------|------------|
| **Qualité** | ⭐⭐⭐⭐⭐ Exceptionnelle, rivalise avec GPT-5 |
| **Coût** | ⭐⭐⭐⭐ $6/1M input, $18/1M output |
| **Latence** | ⭐⭐⭐⭐⭐ Rapide |
| **Compatibilité** | ⭐⭐⭐⭐⭐ Déjà intégré (mise à jour modèle) |
| **JSON structuré** | ⭐⭐⭐⭐⭐ Excellent (tool_use natif) |

**Avantages :**
- Qualité de raisonnement proche de GPT-5.2
- Excellent suivi d'instructions complexes
- JSON structuré fiable via tool_use
- Meilleure gestion du français que GPT
- Contexte 200K tokens
- Mode "extended thinking" pour tâches complexes

**Inconvénients :**
- Coût légèrement supérieur à Claude 4.5
- API Anthropic (différente d'OpenAI)

**Recommandation :** **Alternative principale à GPT-5.2**. Migration simple car déjà intégré.

---

#### Claude 4.5 Sonnet

**Pertinence : 92%**

| Critère | Évaluation |
|---------|------------|
| **Qualité** | ⭐⭐⭐⭐⭐ Excellente |
| **Coût** | ⭐⭐⭐⭐⭐ $4/1M input, $12/1M output |
| **Latence** | ⭐⭐⭐⭐⭐ Très rapide |
| **Compatibilité** | ⭐⭐⭐⭐⭐ Déjà intégré |
| **JSON structuré** | ⭐⭐⭐⭐⭐ Excellent |

**Avantages :**
- Meilleur rapport qualité/prix de la gamme Claude
- Très rapide (optimisé pour la production)
- Excellent sur l'analyse de CV et texte structuré
- Déjà intégré dans l'application

**Inconvénients :**
- Légèrement moins performant que 4.6 sur le raisonnement complexe

**Recommandation :** **Meilleur choix pour la production quotidienne**. Excellent compromis coût/qualité.

---

#### Claude 3.5 Sonnet (Génération précédente)

**Pertinence : 85%**

Toujours disponible et fonctionnel. Recommandé comme fallback économique.

**Coût :** $3/1M input, $15/1M output

---

#### Comparaison des Coûts Claude

| Modèle | Input/1M | Output/1M | Coût pour 1000 analyses CV* |
|--------|----------|-----------|----------------------------|
| Claude 4.6 Sonnet | $6 | $18 | ~$48 |
| Claude 4.5 Sonnet | $4 | $12 | ~$32 |
| Claude 3.5 Sonnet | $3 | $15 | ~$36 |
| GPT-5.2 (référence) | $15 | $30 | ~$90 |

*Estimation basée sur 4K tokens input, 2K tokens output par analyse

**Recommandation globale Anthropic :**
- **Production principale** : Claude 4.5 Sonnet (meilleur rapport qualité/prix)
- **Tâches complexes** : Claude 4.6 Sonnet (qualité maximale)
- **Fallback économique** : Claude 3.5 Sonnet

---

### 2.3 Google Gemini 2.0 Pro / Ultra

| Critère | Évaluation |
|---------|------------|
| **Qualité** | ⭐⭐⭐⭐ Très bonne |
| **Coût** | ⭐⭐⭐⭐ Compétitif |
| **Latence** | ⭐⭐⭐⭐ Bonne |
| **Compatibilité** | ⭐⭐⭐ Nouvelle intégration requise |
| **JSON structuré** | ⭐⭐⭐⭐ Supporté |

**Pertinence : 75%**

**Avantages :**
- Contexte très long (1M+ tokens)
- Multimodal natif (PDF, images)
- Bon rapport qualité/prix

**Inconvénients :**
- Nouvelle intégration à développer
- Moins testé sur le français
- API différente

**Recommandation :** À considérer pour le multimodal (lecture directe de PDF).

---

### 2.4 Mistral AI (Large / Medium)

| Critère | Évaluation |
|---------|------------|
| **Qualité** | ⭐⭐⭐⭐ Très bonne |
| **Coût** | ⭐⭐⭐⭐⭐ Très compétitif |
| **Latence** | ⭐⭐⭐⭐⭐ Excellente |
| **Compatibilité** | ⭐⭐⭐ Nouvelle intégration |
| **JSON structuré** | ⭐⭐⭐⭐ Supporté |

**Pertinence : 80%**

**Avantages :**
- Entreprise française (conformité RGPD)
- Excellent sur le français
- Très bon rapport qualité/prix
- API compatible OpenAI

**Inconvénients :**
- Contexte plus limité (32K)
- Moins performant sur le raisonnement complexe

**Recommandation :** Excellent choix pour la conformité RGPD et le français.

---

### 2.5 Cohere Command R+

| Critère | Évaluation |
|---------|------------|
| **Qualité** | ⭐⭐⭐ Bonne |
| **Coût** | ⭐⭐⭐⭐ Compétitif |
| **Latence** | ⭐⭐⭐⭐ Bonne |
| **Compatibilité** | ⭐⭐⭐ Nouvelle intégration |
| **JSON structuré** | ⭐⭐⭐⭐ Supporté |

**Pertinence : 65%**

**Avantages :**
- Spécialisé RAG et entreprise
- Bonne gestion multilingue

**Inconvénients :**
- Moins performant que GPT-4/Claude sur l'analyse
- Communauté plus petite

---

## 3. Modèles Open Source (Déploiement Local)

### 3.0 Coûts d'Hébergement - Vue d'Ensemble

#### Options d'Hébergement Cloud GPU

| Fournisseur | GPU | Prix/heure | Prix/mois (24/7) | Région |
|-------------|-----|------------|------------------|--------|
| **RunPod** | RTX 4090 24GB | $0.44 | ~$320 | US/EU |
| **RunPod** | A100 40GB | $1.09 | ~$785 | US/EU |
| **RunPod** | A100 80GB | $1.89 | ~$1,360 | US/EU |
| **RunPod** | H100 80GB | $3.29 | ~$2,370 | US/EU |
| **Vast.ai** | RTX 4090 24GB | $0.30-0.50 | ~$250-400 | Variable |
| **Vast.ai** | A100 40GB | $0.80-1.20 | ~$600-900 | Variable |
| **Lambda Labs** | A100 40GB | $1.10 | ~$792 | US |
| **Lambda Labs** | H100 80GB | $2.49 | ~$1,793 | US |
| **AWS** | A10G 24GB | $1.00 | ~$720 | Global |
| **AWS** | A100 40GB | $3.67 | ~$2,642 | Global |
| **GCP** | A100 40GB | $3.67 | ~$2,642 | Global |
| **Azure** | A100 80GB | $3.40 | ~$2,448 | Global |
| **OVHcloud** | A100 80GB | €2.50 | ~€1,800 | EU (RGPD) |
| **Scaleway** | H100 80GB | €3.31 | ~€2,383 | EU (RGPD) |

#### Options On-Premise (Achat)

| Configuration | Coût Achat | Coût Mensuel (électricité + maintenance) | Amortissement 3 ans |
|---------------|------------|------------------------------------------|---------------------|
| 1x RTX 4090 24GB | ~$2,000 | ~$50-80 | ~$110/mois total |
| 2x RTX 4090 24GB | ~$4,000 | ~$100-150 | ~$210/mois total |
| 1x RTX 3090 24GB | ~$1,200 | ~$60-90 | ~$90/mois total |
| 4x RTX 4090 (serveur) | ~$15,000 | ~$200-300 | ~$650/mois total |
| 1x A100 40GB (occasion) | ~$8,000 | ~$100-150 | ~$370/mois total |
| 8x A100 80GB (serveur) | ~$150,000 | ~$500-800 | ~$4,700/mois total |

#### Coûts Additionnels à Prévoir

| Poste | Coût Estimé |
|-------|-------------|
| Bande passante (1TB/mois) | $50-100/mois |
| Stockage SSD (1TB NVMe) | $10-30/mois |
| Monitoring/Logs | $20-50/mois |
| Backup | $20-50/mois |
| DevOps/Maintenance | 0.5-1 jour/semaine |
| Haute disponibilité (x2) | +80-100% du coût GPU |

---

### 3.1 Llama 3.1 405B / 70B (Meta)

| Critère | Évaluation |
|---------|------------|
| **Qualité** | ⭐⭐⭐⭐ Très bonne (405B proche GPT-4) |
| **Coût** | ⭐⭐⭐⭐⭐ Gratuit (hors infra) |
| **Latence** | ⭐⭐⭐ Variable selon infra |
| **Compatibilité** | ⭐⭐⭐ API compatible OpenAI via vLLM |
| **JSON structuré** | ⭐⭐⭐ Nécessite fine-tuning |

**Pertinence : 70%**

**Infrastructure et Coûts Détaillés :**

| Variante | GPU Requis | Cloud (RunPod) | Cloud (AWS) | On-Premise |
|----------|------------|----------------|-------------|------------|
| **405B FP16** | 8x A100 80GB | ~$10,900/mois | ~$21,000/mois | ~$4,700/mois* |
| **405B INT8** | 4x A100 80GB | ~$5,450/mois | ~$10,500/mois | ~$2,400/mois* |
| **70B FP16** | 2x A100 80GB | ~$2,720/mois | ~$5,300/mois | ~$1,200/mois* |
| **70B INT4** | 1x RTX 4090 | ~$320/mois | ~$720/mois | ~$110/mois* |

*On-Premise = amortissement 3 ans + électricité + maintenance

**Coût Total Estimé (incluant infra + ops) :**
- 405B production : **$12,000-25,000/mois**
- 70B production : **$3,000-6,000/mois**
- 70B INT4 (budget) : **$400-800/mois**

**Avantages :**
- Contrôle total des données (RGPD)
- Pas de dépendance fournisseur
- Personnalisable (fine-tuning)

**Inconvénients :**
- Coût infrastructure élevé
- Maintenance complexe
- JSON moins fiable sans fine-tuning

**Recommandation :** Viable pour grandes entreprises avec exigences strictes de confidentialité. La version 70B INT4 offre un bon compromis coût/qualité.

---

### 3.2 Mistral 7B / Mixtral 8x7B / Mixtral 8x22B

| Critère | Évaluation |
|---------|------------|
| **Qualité** | ⭐⭐⭐ à ⭐⭐⭐⭐ (selon taille) |
| **Coût** | ⭐⭐⭐⭐⭐ Gratuit (hors infra) |
| **Latence** | ⭐⭐⭐⭐ Bonne |
| **Compatibilité** | ⭐⭐⭐⭐ API compatible OpenAI |
| **JSON structuré** | ⭐⭐⭐ Correct |

**Pertinence : 65%**

**Infrastructure et Coûts Détaillés :**

| Variante | GPU Requis | Cloud (RunPod) | Cloud (Vast.ai) | On-Premise |
|----------|------------|----------------|-----------------|------------|
| **Mixtral 8x22B** | 4x A100 40GB | ~$3,140/mois | ~$2,400/mois | ~$1,500/mois* |
| **Mixtral 8x7B** | 1x A100 80GB | ~$1,360/mois | ~$900/mois | ~$400/mois* |
| **Mixtral 8x7B INT4** | 1x RTX 4090 | ~$320/mois | ~$300/mois | ~$110/mois* |
| **Mistral 7B** | 1x RTX 4090 | ~$320/mois | ~$300/mois | ~$110/mois* |
| **Mistral 7B INT4** | 1x RTX 3090 | ~$250/mois | ~$200/mois | ~$90/mois* |

*On-Premise = amortissement 3 ans + électricité + maintenance

**Coût Total Estimé (incluant infra + ops) :**
- Mixtral 8x22B : **$3,500-4,500/mois**
- Mixtral 8x7B : **$1,500-2,000/mois**
- Mistral 7B (budget) : **$150-400/mois**

**Avantages :**
- Excellent sur le français
- Architecture MoE efficace
- Déploiement plus léger
- Mistral 7B très accessible

**Inconvénients :**
- Qualité inférieure à GPT-4/Claude
- Contexte limité (32K)

---

### 3.3 Qwen 2.5 72B (Alibaba)

| Critère | Évaluation |
|---------|------------|
| **Qualité** | ⭐⭐⭐⭐ Très bonne |
| **Coût** | ⭐⭐⭐⭐⭐ Gratuit |
| **Latence** | ⭐⭐⭐⭐ Bonne |
| **Compatibilité** | ⭐⭐⭐ API compatible |
| **JSON structuré** | ⭐⭐⭐⭐ Bon |

**Pertinence : 60%**

**Infrastructure et Coûts Détaillés :**

| Variante | GPU Requis | Cloud (RunPod) | Cloud (Vast.ai) | On-Premise |
|----------|------------|----------------|-----------------|------------|
| **Qwen 2.5 72B** | 2x A100 80GB | ~$2,720/mois | ~$1,800/mois | ~$1,200/mois* |
| **Qwen 2.5 72B INT4** | 1x RTX 4090 | ~$320/mois | ~$300/mois | ~$110/mois* |
| **Qwen 2.5 32B** | 1x A100 40GB | ~$785/mois | ~$600/mois | ~$370/mois* |
| **Qwen 2.5 14B** | 1x RTX 4080 | ~$280/mois | ~$220/mois | ~$100/mois* |
| **Qwen 2.5 7B** | 1x RTX 3080 | ~$200/mois | ~$150/mois | ~$80/mois* |

**Coût Total Estimé :**
- 72B production : **$2,000-3,500/mois**
- 72B INT4 (budget) : **$400-600/mois**
- 14B (léger) : **$150-350/mois**

**Avantages :**
- Très performant sur les benchmarks
- Bon support multilingue
- Versions légères disponibles (7B, 14B)

**Inconvénients :**
- Moins testé en production occidentale
- Documentation en anglais limitée

---

### 3.4 DeepSeek V3 (671B MoE)

| Critère | Évaluation |
|---------|------------|
| **Qualité** | ⭐⭐⭐⭐⭐ Excellente (proche GPT-4o) |
| **Coût** | ⭐⭐⭐⭐⭐ Gratuit |
| **Latence** | ⭐⭐⭐ Variable |
| **Compatibilité** | ⭐⭐⭐ API compatible |
| **JSON structuré** | ⭐⭐⭐⭐ Bon |

**Pertinence : 70%**

**Infrastructure et Coûts Détaillés :**

| Variante | GPU Requis | Cloud (RunPod) | Cloud (Lambda) | On-Premise |
|----------|------------|----------------|----------------|------------|
| **DeepSeek V3 671B** | 8x H100 80GB | ~$18,960/mois | ~$14,344/mois | ~$8,000/mois* |
| **DeepSeek V3 INT8** | 4x H100 80GB | ~$9,480/mois | ~$7,172/mois | ~$4,000/mois* |
| **DeepSeek V2.5 236B** | 4x A100 80GB | ~$5,440/mois | ~$4,000/mois | ~$2,400/mois* |

*On-Premise = amortissement 3 ans + électricité + maintenance (H100 très coûteux à l'achat ~$30K/unité)

**Coût Total Estimé :**
- V3 671B production : **$15,000-25,000/mois**
- V3 INT8 : **$8,000-12,000/mois**
- V2.5 (alternative) : **$4,500-7,000/mois**

**Avantages :**
- Qualité exceptionnelle pour un modèle open source
- Architecture MoE efficace (seulement 37B actifs sur 671B)
- Performance proche GPT-4o

**Inconvénients :**
- Infrastructure très lourde
- Origine chinoise (considérations géopolitiques)
- Coût élevé malgré le MoE

---

### 3.5 GLM-4.7 Flash (Zhipu AI / THUDM)

| Critère | Évaluation |
|---------|------------|
| **Qualité** | ⭐⭐⭐⭐ Très bonne |
| **Coût** | ⭐⭐⭐⭐⭐ Gratuit (open source) |
| **Latence** | ⭐⭐⭐⭐⭐ Excellente (optimisé pour vitesse) |
| **Compatibilité** | ⭐⭐⭐⭐ API compatible OpenAI via vLLM/Ollama |
| **JSON structuré** | ⭐⭐⭐⭐ Bon support natif |

**Pertinence : 75%**

**Infrastructure et Coûts Détaillés :**

| Variante | GPU Requis | Cloud (RunPod) | Cloud (Vast.ai) | On-Premise |
|----------|------------|----------------|-----------------|------------|
| **GLM-4.7-9B-Flash** | 1x RTX 4090 | ~$320/mois | ~$300/mois | ~$110/mois* |
| **GLM-4.7-9B-Flash INT4** | 1x RTX 3090 | ~$250/mois | ~$200/mois | ~$90/mois* |
| **GLM-4.7-32B** | 2x RTX 4090 | ~$640/mois | ~$600/mois | ~$210/mois* |
| **GLM-4.7-32B** | 1x A100 40GB | ~$785/mois | ~$600/mois | ~$370/mois* |
| **GLM-4.7-32B INT4** | 1x RTX 4090 | ~$320/mois | ~$300/mois | ~$110/mois* |

*On-Premise = amortissement 3 ans + électricité + maintenance

**Coût Total Estimé (incluant infra + ops) :**
- 9B Flash (recommandé budget) : **$150-400/mois**
- 32B (recommandé production) : **$400-900/mois**
- 32B INT4 (compromis) : **$200-450/mois**

**Avantages :**
- **Optimisé pour la vitesse** (Flash = inférence rapide)
- Excellent support multilingue (chinois, anglais, français)
- Architecture moderne avec attention efficiente
- Contexte jusqu'à 128K tokens
- Licence Apache 2.0 (usage commercial autorisé)
- Bon suivi d'instructions et génération JSON
- **Meilleur rapport qualité/coût pour déploiement local**

**Inconvénients :**
- Documentation principalement en chinois
- Communauté occidentale plus petite
- Moins de ressources de fine-tuning disponibles

**Recommandation :** Excellent choix pour déploiement local avec contraintes de latence. La version 9B-Flash offre le meilleur rapport coût/performance pour les budgets limités. La version 32B est recommandée pour une qualité proche des modèles cloud.

---

### 3.6 Phi-3 / Phi-4 (Microsoft)

| Critère | Évaluation |
|---------|------------|
| **Qualité** | ⭐⭐⭐ à ⭐⭐⭐⭐ (Phi-4 meilleur) |
| **Coût** | ⭐⭐⭐⭐⭐ Très léger |
| **Latence** | ⭐⭐⭐⭐⭐ Excellente |
| **Compatibilité** | ⭐⭐⭐⭐ Bonne |
| **JSON structuré** | ⭐⭐⭐ Moyen |

**Pertinence : 55%**

**Infrastructure et Coûts Détaillés :**

| Variante | GPU Requis | Cloud (RunPod) | Cloud (Vast.ai) | On-Premise |
|----------|------------|----------------|-----------------|------------|
| **Phi-4 14B** | 1x RTX 4080 | ~$280/mois | ~$220/mois | ~$100/mois* |
| **Phi-4 14B INT4** | 1x RTX 3070 | ~$180/mois | ~$140/mois | ~$70/mois* |
| **Phi-3 Medium 14B** | 1x RTX 4080 | ~$280/mois | ~$220/mois | ~$100/mois* |
| **Phi-3 Mini 3.8B** | 1x RTX 3060 | ~$150/mois | ~$100/mois | ~$50/mois* |

**Coût Total Estimé :**
- Phi-4 14B : **$150-350/mois**
- Phi-3 Mini (ultra-budget) : **$80-180/mois**

**Avantages :**
- Très léger, déployable sur GPU consumer
- Phi-4 améliore significativement le raisonnement
- Bon pour tâches simples et moyennes
- **Coût le plus bas** de tous les modèles

**Inconvénients :**
- Qualité insuffisante pour analyse complexe de CV
- Contexte limité (16K)

---

### 3.7 Gemma 2 (Google)

| Critère | Évaluation |
|---------|------------|
| **Qualité** | ⭐⭐⭐⭐ Très bonne pour sa taille |
| **Coût** | ⭐⭐⭐⭐⭐ Gratuit |
| **Latence** | ⭐⭐⭐⭐⭐ Excellente |
| **Compatibilité** | ⭐⭐⭐⭐ Bonne |
| **JSON structuré** | ⭐⭐⭐⭐ Bon |

**Pertinence : 60%**

**Infrastructure et Coûts Détaillés :**

| Variante | GPU Requis | Cloud (RunPod) | Cloud (Vast.ai) | On-Premise |
|----------|------------|----------------|-----------------|------------|
| **Gemma 2 27B** | 1x RTX 4090 | ~$320/mois | ~$300/mois | ~$110/mois* |
| **Gemma 2 27B** | 1x A10 24GB | ~$350/mois | ~$280/mois | ~$150/mois* |
| **Gemma 2 27B INT4** | 1x RTX 4080 | ~$280/mois | ~$220/mois | ~$100/mois* |
| **Gemma 2 9B** | 1x RTX 4080 | ~$280/mois | ~$220/mois | ~$100/mois* |
| **Gemma 2 9B INT4** | 1x RTX 3070 | ~$180/mois | ~$140/mois | ~$70/mois* |
| **Gemma 2 2B** | 1x RTX 3060 | ~$150/mois | ~$100/mois | ~$50/mois* |

**Coût Total Estimé :**
- 27B production : **$350-500/mois**
- 9B (budget) : **$150-350/mois**
- 2B (edge/mobile) : **$80-180/mois**

**Avantages :**
- Qualité exceptionnelle pour sa taille
- Licence permissive (Gemma Terms)
- Bien documenté par Google
- Versions très légères disponibles (2B)

**Inconvénients :**
- Contexte limité (8K)
- Moins performant sur le français

---

### 3.8 Yi-1.5 / Yi-Large (01.AI)

| Critère | Évaluation |
|---------|------------|
| **Qualité** | ⭐⭐⭐⭐ Très bonne |
| **Coût** | ⭐⭐⭐⭐⭐ Gratuit |
| **Latence** | ⭐⭐⭐⭐ Bonne |
| **Compatibilité** | ⭐⭐⭐ API compatible |
| **JSON structuré** | ⭐⭐⭐⭐ Bon |

**Pertinence : 55%**

**Infrastructure et Coûts Détaillés :**

| Variante | GPU Requis | Cloud (RunPod) | Cloud (Vast.ai) | On-Premise |
|----------|------------|----------------|-----------------|------------|
| **Yi-1.5 34B** | 2x RTX 4090 | ~$640/mois | ~$600/mois | ~$210/mois* |
| **Yi-1.5 34B** | 1x A100 40GB | ~$785/mois | ~$600/mois | ~$370/mois* |
| **Yi-1.5 34B INT4** | 1x RTX 4090 | ~$320/mois | ~$300/mois | ~$110/mois* |
| **Yi-1.5 9B** | 1x RTX 4080 | ~$280/mois | ~$220/mois | ~$100/mois* |
| **Yi-1.5 6B** | 1x RTX 3070 | ~$180/mois | ~$140/mois | ~$70/mois* |

**Coût Total Estimé :**
- 34B production : **$700-1,000/mois**
- 34B INT4 (budget) : **$350-500/mois**
- 9B (léger) : **$150-350/mois**

**Avantages :**
- Très performant sur les benchmarks
- Bon support multilingue
- Versions légères disponibles

**Inconvénients :**
- Origine chinoise
- Moins testé en production occidentale

---

### 3.9 Command R (Cohere) - Self-hosted

| Critère | Évaluation |
|---------|------------|
| **Qualité** | ⭐⭐⭐⭐ Bonne |
| **Coût** | ⭐⭐⭐⭐⭐ Gratuit (open weights) |
| **Latence** | ⭐⭐⭐⭐ Bonne |
| **Compatibilité** | ⭐⭐⭐⭐ API Cohere compatible |
| **JSON structuré** | ⭐⭐⭐⭐ Bon |

**Pertinence : 60%**

**Infrastructure et Coûts Détaillés :**

| Variante | GPU Requis | Cloud (RunPod) | Cloud (Vast.ai) | On-Premise |
|----------|------------|----------------|-----------------|------------|
| **Command R+ 104B** | 4x A100 40GB | ~$3,140/mois | ~$2,400/mois | ~$1,500/mois* |
| **Command R 35B** | 2x RTX 4090 | ~$640/mois | ~$600/mois | ~$210/mois* |
| **Command R 35B** | 1x A100 40GB | ~$785/mois | ~$600/mois | ~$370/mois* |
| **Command R 35B INT4** | 1x RTX 4090 | ~$320/mois | ~$300/mois | ~$110/mois* |

**Coût Total Estimé :**
- R+ 104B : **$2,800-4,000/mois**
- R 35B production : **$700-1,000/mois**
- R 35B INT4 : **$350-500/mois**

**Avantages :**
- Spécialisé RAG et recherche documentaire
- Bon pour systèmes de Q&A
- Citations et sources intégrées

**Inconvénients :**
- Moins généraliste
- Moins performant sur l'analyse de CV

---

### 3.10 Falcon 180B / Falcon 2 (TII)

| Critère | Évaluation |
|---------|------------|
| **Qualité** | ⭐⭐⭐ Correcte |
| **Coût** | ⭐⭐⭐⭐⭐ Gratuit |
| **Latence** | ⭐⭐⭐ Variable |
| **Compatibilité** | ⭐⭐⭐ API compatible |
| **JSON structuré** | ⭐⭐⭐ Moyen |

**Pertinence : 45%**

**Infrastructure et Coûts Détaillés :**

| Variante | GPU Requis | Cloud (RunPod) | Cloud (Vast.ai) | On-Premise |
|----------|------------|----------------|-----------------|------------|
| **Falcon 180B** | 8x A100 80GB | ~$10,900/mois | ~$7,200/mois | ~$4,700/mois* |
| **Falcon 2 11B** | 1x RTX 4090 | ~$320/mois | ~$300/mois | ~$110/mois* |
| **Falcon 2 11B INT4** | 1x RTX 3090 | ~$250/mois | ~$200/mois | ~$90/mois* |

**Coût Total Estimé :**
- 180B : **$8,000-12,000/mois** (non recommandé)
- Falcon 2 11B : **$350-500/mois**

**Avantages :**
- Licence très permissive (Apache 2.0)
- Modèle européen (UAE - Technology Innovation Institute)
- Falcon 2 beaucoup plus léger

**Inconvénients :**
- Qualité inférieure aux alternatives (Llama, Mistral)
- 180B trop lourd pour le rapport qualité/coût
- Moins de support communautaire

---

## 4. Outils de Déploiement Local

### 4.1 Frameworks d'Inférence

| Outil | Description | Avantages |
|-------|-------------|-----------|
| **Ollama** | Déploiement simplifié | Installation en 1 commande, API OpenAI compatible |
| **vLLM** | Inférence haute performance | PagedAttention, throughput élevé |
| **llama.cpp** | CPU/GPU mixte | Fonctionne sans GPU dédié |
| **TGI (HuggingFace)** | Production-ready | Batching, streaming, métriques |
| **LocalAI** | Drop-in OpenAI replacement | 100% compatible API OpenAI |

### 4.2 Configuration Recommandée pour ResumeConverter

```yaml
# Configuration locale recommandée
production_locale:
  modele_principal: "glm-4.7-32b-flash"
  modele_fallback: "mistral-7b-instruct"
  framework: "vLLM"
  gpu: "2x RTX 4090 ou 1x A100"
  
developpement:
  modele: "glm-4.7-9b-flash"
  framework: "Ollama"
  gpu: "1x RTX 4090 ou RTX 3090"
```

---

## 5. Solutions Hybrides

### 5.1 Routage Intelligent par Complexité

```
┌─────────────────┐
│ Requête entrante│
└────────┬────────┘
         │
    ┌────▼────┐
    │ Router  │
    └────┬────┘
         │
    ┌────┴────────────────┬──────────────────┐
    ▼                     ▼                  ▼
┌───────────┐      ┌───────────┐      ┌───────────┐
│ Simple    │      │ Moyen     │      │ Complexe  │
│ Mistral 7B│      │ GPT-4o-mini│     │ GPT-5.2   │
│ Local     │      │ Cloud     │      │ Cloud     │
└───────────┘      └───────────┘      └───────────┘
```

**Répartition suggérée :**
- **Chatbot simple** → Mistral 7B local (gratuit)
- **Extraction tags** → GPT-4o-mini ($0.15/1M tokens)
- **Analyse CV complète** → GPT-5.2 ou Claude 4.5/4.6 Sonnet

**Économie estimée : 40-60%**

---

### 5.2 Cache Sémantique

Implémenter un cache basé sur la similarité des requêtes :
- Réutiliser les analyses pour CV similaires
- Réduction des appels API de 20-30%

---

## 6. Tableau Comparatif Global

| Modèle | Type | Qualité | Coût | Latence | JSON | Français | Pertinence |
|--------|------|---------|------|---------|------|----------|------------|
| **GPT-5.2** (actuel) | Cloud | ⭐⭐⭐⭐⭐ | $15-30/1M | Lent | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 100% |
| **Claude 4.6 Sonnet** | Cloud | ⭐⭐⭐⭐⭐ | $6-18/1M | Rapide | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | **95%** |
| GPT-4o | Cloud | ⭐⭐⭐⭐ | $5-15/1M | Rapide | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | **95%** |
| **Claude 4.5 Sonnet** | Cloud | ⭐⭐⭐⭐⭐ | $4-12/1M | Très rapide | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | **92%** |
| Claude 3.5 Sonnet | Cloud | ⭐⭐⭐⭐ | $3-15/1M | Rapide | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 85% |
| Mistral Large | Cloud | ⭐⭐⭐⭐ | $2-8/1M | Rapide | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | **80%** |
| Gemini 2.0 Pro | Cloud | ⭐⭐⭐⭐ | $1-7/1M | Rapide | ⭐⭐⭐⭐ | ⭐⭐⭐ | 75% |
| GPT-4o-mini | Cloud | ⭐⭐⭐ | $0.15-0.60/1M | Très rapide | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 75% |
| **GLM-4.7 Flash** | **Local** | ⭐⭐⭐⭐ | ~$500/mois | **Excellent** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | **75%** |
| Llama 3.1 405B | Local | ⭐⭐⭐⭐ | ~$25K/mois | Variable | ⭐⭐⭐ | ⭐⭐⭐ | 70% |
| DeepSeek V3 | Local | ⭐⭐⭐⭐⭐ | ~$40K/mois | Variable | ⭐⭐⭐⭐ | ⭐⭐⭐ | 70% |
| Mixtral 8x22B | Local | ⭐⭐⭐ | ~$12K/mois | Bon | ⭐⭐⭐ | ⭐⭐⭐⭐ | 65% |
| Gemma 2 27B | Local | ⭐⭐⭐⭐ | ~$500/mois | Excellent | ⭐⭐⭐⭐ | ⭐⭐⭐ | 60% |
| Command R 35B | Local | ⭐⭐⭐⭐ | ~$1K/mois | Bon | ⭐⭐⭐⭐ | ⭐⭐⭐ | 60% |
| Yi-1.5 34B | Local | ⭐⭐⭐⭐ | ~$1K/mois | Bon | ⭐⭐⭐⭐ | ⭐⭐⭐ | 55% |
| Phi-4 14B | Local | ⭐⭐⭐⭐ | ~$300/mois | Excellent | ⭐⭐⭐ | ⭐⭐⭐ | 55% |
| Mistral 7B | Local | ⭐⭐⭐ | ~$300/mois | Excellent | ⭐⭐⭐ | ⭐⭐⭐⭐ | 50% |
| Falcon 2 | Local | ⭐⭐⭐ | ~$500/mois | Variable | ⭐⭐⭐ | ⭐⭐⭐ | 45% |

---

## 7. Recommandations

### 7.1 Court Terme (0-3 mois)
1. **Migrer vers Claude 4.5 Sonnet** comme modèle principal (meilleur rapport qualité/prix)
2. **Conserver GPT-5.2** pour les tâches de raisonnement complexe
3. **Activer GPT-4o** comme fallback automatique

### 7.2 Moyen Terme (3-6 mois)
1. **Évaluer Claude 4.6 Sonnet** pour les analyses les plus complexes
2. **Intégrer Mistral Large** pour conformité RGPD
3. **Implémenter le routage intelligent** par complexité
4. **Ajouter un cache sémantique**

### 7.3 Long Terme (6-12 mois)
1. **Évaluer le déploiement local** de GLM-4.7 Flash ou Llama 3.1 70B pour clients enterprise
2. **Fine-tuner un modèle** sur les CV français pour améliorer la qualité
3. **Monitorer les nouveaux modèles** (GPT-5.3, Claude 5, Llama 4)

---

## 8. Conclusion

L'application est bien positionnée avec GPT-5.2 comme modèle principal. Les alternatives les plus pertinentes sont :

### Modèles Cloud (recommandés pour la production)
1. **Claude 4.6 Sonnet (95%)** - Qualité proche GPT-5.2, meilleur sur le français, déjà intégré
2. **GPT-4o (95%)** - Migration triviale, excellent rapport qualité/prix
3. **Claude 4.5 Sonnet (92%)** - Meilleur rapport qualité/prix global, très rapide
4. **Mistral Large (80%)** - Conformité RGPD, entreprise française

### Modèles Locaux (recommandés pour confidentialité/coûts)
1. **GLM-4.7 Flash (75%)** - Meilleur rapport qualité/latence/coût pour déploiement local
2. **Llama 3.1 70B (70%)** - Référence open source, large communauté
3. **DeepSeek V3 (70%)** - Qualité exceptionnelle mais infrastructure lourde

### Stratégie Optimale

Pour une optimisation des coûts sans sacrifier la qualité, une stratégie de **routage intelligent** est recommandée :

| Tâche | Modèle recommandé | Coût estimé |
|-------|-------------------|-------------|
| Chatbot simple | GLM-4.7 Flash local ou Mistral 7B | ~$0 (infra) |
| Extraction tags | GPT-4o-mini | $0.15/1M tokens |
| Analyse CV standard | Claude 4.5 Sonnet | $4-12/1M tokens |
| Analyse CV complexe | Claude 4.6 Sonnet ou GPT-5.2 | $6-30/1M tokens |

**Économie estimée : 50-70% des coûts LLM actuels** (en migrant de GPT-5.2 vers Claude 4.5)

### Pour un déploiement 100% local

Si la confidentialité des données est critique (RGPD strict, données sensibles), la configuration recommandée est :

```
Production : GLM-4.7-32B-Flash via vLLM (2x RTX 4090)
Fallback   : Mistral 7B via Ollama (1x RTX 4090)
Coût       : ~$1.5K/mois infrastructure
```

---

*Document généré le 11 février 2026*
