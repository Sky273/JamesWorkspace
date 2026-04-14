# Resume Converter

[![Version](https://img.shields.io/badge/version-1.7.8-blue.svg)](./CHANGELOG.md)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18+-blue.svg)](https://www.postgresql.org/)
[![React](https://img.shields.io/badge/React-18.2-61dafb.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)

Application professionnelle de gestion et d'analyse de CVs avec intelligence artificielle, matching de profils et radar du marché de l'emploi intégré.

## 🚀 Fonctionnalités

### Gestion des CVs
- **Upload et parsing** : Support PDF, DOCX, DOC avec OCR serveur. Pour les PDFs scannés, la chaîne préférée est `pdftoppm` + `tesseract` CLI; `tesseract.js` reste un fallback si les binaires système sont absents.
- **Analyse IA** : Extraction automatique des compétences, expériences et formations via GPT-5/Claude
- **Tags ESCO** : Classification automatique selon le référentiel européen des compétences
- **Édition enrichie** : Éditeur TinyMCE intégré pour la mise en forme
- **Export PDF** : Génération de CVs formatés avec templates personnalisables
- **Amélioration IA** : Suggestions d'amélioration automatiques du contenu

- **Scoring LLM pilotable** : La concurrence et la taille des batches du profile matching sont configurables par environnement

### Gestion des Missions
- **Création et suivi** : Gestion complète des offres d'emploi
- **Association CV** : Lien entre missions et candidats
- **Historique** : Suivi des adaptations et matchings

### Gestion des Cabinets (Firms)
- **Multi-cabinets** : Support de plusieurs cabinets de recrutement
- **Association utilisateurs** : Gestion des droits par cabinet

### Radar du Marché
- **Tendances du marché** : Visualisation des offres d'emploi, tensions de recrutement, embauches
- **Carte de France interactive** : Répartition géographique par région avec MapLibre GL
- **Données France Travail** : Intégration API officielle (offres, tensions, BMO)
- **Données Adzuna** : Agrégation multi-sources d'offres d'emploi
- **Filtres avancés** : Par type de données, région, métier (code ROME)
- **Métiers ROME** : Référentiel complet avec recherche et navigation

### Chatbot IA
- **Hugging Face** : Support du provider `huggingface` via le routeur OpenAI-compatible Hugging Face, avec `MiniMaxAI/MiniMax-M2.7` comme modele par defaut, un identifiant de modele librement configurable dans les parametres, et l'alias `minimax-m2.7:cloud`.
- **Multi-modèles** : Support OpenAI (GPT-5.4 / GPT-5.4-pro / GPT-5.2 / GPT-5.1 / GPT-5 / GPT-4.1 / GPT-4o), Anthropic (Claude Opus 4.x / Sonnet 4 / Claude 3.7 / Claude 3.5), DeepSeek (DeepSeek-V3.2 via `deepseek-chat` et `deepseek-reasoner`), Gemma Cloud via Gemini, GLM (`glm-5.1`, `glm-5`), MiniMax et Ollama distant
- **Contexte CV** : Réponses personnalisées basées sur le profil

### Configuration Stripe
- Documentation pas Ã  pas : [docs/STRIPE_CONFIGURATION.md](C:/Users/mail/CascadeProjects/ResumeConverter/docs/STRIPE_CONFIGURATION.md)

### Administration
- **Gestion utilisateurs** : CRUD complet avec rôles (admin, user)
### Métriques LLM
- Nombre d'appels par modèle
- Tokens consommés (input/output)
- Coûts estimés
- Temps de réponse moyen
- Taux d'erreur
- Opérations de profile matching : recherches, profils demandés/scorés, batches démarrés/retriés/en échec

### Réglages de performance du profile matching
- `PROFILE_MATCHING_LLM_MAX_CONCURRENCY`
  - `0` : valeurs par défaut par provider
  - `1..100` : plafond de parallélisme des appels batch
- `PROFILE_MATCHING_LLM_BATCH_SIZE`
  - `0` : valeurs par défaut par provider
  - `1..100` : taille forcée des batches envoyés au LLM
- Valeurs par défaut :
  - MiniMax : `6`
  - DeepSeek : `4`
  - autres providers : `12`

### Réglages du ranking local du profile matching
- Les poids de pré-ranking local sont maintenant disponibles :
  - dans les paramètres d'administration
  - et via les variables d'environnement en fallback
- Champs administrables :
  - `Profile Matching Local Skill Weight`
  - `Profile Matching Local Tool Weight`
  - `Profile Matching Local Industry Weight`
  - `Profile Matching Local Soft Skill Weight`
  - `Profile Matching Local Title Exact Weight`
  - `Profile Matching Local Title Token Weight`
  - `Profile Matching Local Coverage Multiplier`
- Variables d'environnement correspondantes :
  - `PROFILE_MATCHING_LOCAL_SKILL_WEIGHT`
  - `PROFILE_MATCHING_LOCAL_TOOL_WEIGHT`
  - `PROFILE_MATCHING_LOCAL_INDUSTRY_WEIGHT`
  - `PROFILE_MATCHING_LOCAL_SOFTSKILL_WEIGHT`
  - `PROFILE_MATCHING_LOCAL_TITLE_EXACT_WEIGHT`
  - `PROFILE_MATCHING_LOCAL_TITLE_TOKEN_WEIGHT`
  - `PROFILE_MATCHING_LOCAL_COVERAGE_MULTIPLIER`
- Utilisation :
  - ces poids pilotent le pré-ranking local avant envoi des profils au LLM
  - si des valeurs sont enregistrées dans `Settings`, elles priment sur l'env

### Expiration des indisponibilités runtime LLM
- Les refus runtime provider/modèle persistés ne sont plus permanents.
- Chaque modèle marqué indisponible reçoit :
  - `markedAt`
  - `expiresAt`
- TTL configurable :
  - `LLM_RUNTIME_UNAVAILABLE_TTL_MS`
- Valeur par défaut :
  - `21600000` ms (`6h`)
- Effet :
  - un modèle refusé temporairement n'est pas masqué indéfiniment
  - l'application peut retester automatiquement le modèle après expiration

### Migration requise
- La persistance des nouveaux poids de ranking local nécessite la migration :
  - `docker/migrations/add_profile_matching_local_weights.sql`
- En environnement Docker, utilisez votre flux habituel de migration avant de sauvegarder ces nouveaux réglages.

## 🌐 API Endpoints

### Authentification
- `POST /api/auth/login` - Connexion
- `POST /api/auth/register` - Inscription
- `POST /api/auth/refresh` - Rafraîchir le token
- `POST /api/auth/logout` - Déconnexion

### CVs
- `GET /api/resumes` - Liste des CVs
- `POST /api/resumes` - Créer un CV
- `GET /api/resumes/:id` - Détails d'un CV
- `PUT /api/resumes/:id` - Modifier un CV
- `DELETE /api/resumes/:id` - Supprimer un CV
- `POST /api/resumes/extract-pdf` - Extraire le texte d'un PDF côté serveur
- `POST /api/resumes/extract-doc` - Extraire le texte d'un DOC côté serveur

### Jobs backend pour CVs
- `POST /api/batch-jobs` - Lancer l'import, l'extraction et l'analyse d'un ou plusieurs CVs
- `POST /api/batch-jobs/improve` - Lancer l'amélioration d'un CV
- `GET /api/batch-jobs/:id` - Suivre l'avancement et récupérer les résultats d'un job

### Missions
- `GET /api/missions` - Liste des missions
- `POST /api/missions` - Créer une mission
- `GET /api/missions/:id` - Détails d'une mission
- `PUT /api/missions/:id` - Modifier une mission
- `DELETE /api/missions/:id` - Supprimer une mission
- `DELETE /api/missions/:missionId/keywords-cache` - Vider le cache de mots-clés d'une mission

### Jobs backend pour missions et matching
- `POST /api/batch-jobs/profile-search` - Lancer une recherche de profils pour une mission
- `POST /api/batch-jobs/profile-analysis` - Lancer une analyse détaillée d'un profil pour une mission
- `POST /api/batch-jobs/match` - Lancer une analyse de match mission/CV
- `POST /api/batch-jobs/adapt` - Lancer une adaptation de CV pour une mission
- `GET /api/batch-jobs/:id` - Suivre l'avancement et récupérer les résultats d'un job

### Adaptations
- `GET /api/adaptations` - Liste des adaptations
- `POST /api/adaptations` - Créer une adaptation CV/Mission
- `GET /api/adaptations/:id` - Détails d'une adaptation

### Matching
- `POST /api/batch-jobs/match` - Lancer une analyse de matching CV/Mission
- `GET /api/batch-jobs/:id` - Suivre l'avancement et récupérer le résultat du matching

### Radar du Marché
- `GET /api/market-radar/trends` - Tendances paginées
- `GET /api/market-radar/trends/all` - Toutes les tendances (carte)
- `GET /api/market-radar/trends/:id/metadata` - Metadata d'une tendance
- `GET /api/market-radar/facts` - Faits du marché
- `POST /api/market-radar/collect` - Collecter nouvelles données

### Métiers ROME
- `GET /api/rome/metiers` - Liste des métiers
- `GET /api/rome/metiers/:code` - Détails d'un métier
- `GET /api/rome/search` - Recherche de métiers

### Tags
- `GET /api/tags` - Liste des tags
- `POST /api/tags/extract` - Extraire les tags d'un texte

### LLM (Proxy)
- `POST /api/llm/openai` - Proxy OpenAI (GPT-5, GPT-4o) avec routage compatible DeepSeek / Gemma / GLM / MiniMax / Hugging Face / Ollama selon configuration
- `POST /api/llm/anthropic` - Proxy Anthropic (Claude) avec routage compatible MiniMax selon configuration
- `POST /api/llm/messages` - Proxy Anthropic / providers compatibles
- `POST /api/llm/chat/completions` - Proxy OpenAI-compatible unifié (OpenAI, DeepSeek, Gemma, GLM, MiniMax, Hugging Face, Ollama selon configuration)
- `GET /api/llm/circuit-breakers` - Etat des familles LLM (`openai`, `anthropic`, `gemma`, `deepseek`, `glm`, `minimax`, `huggingface`, `ollama`)

### Cache applicatif
- Le cache applicatif fonctionne au niveau backend.
- Les lectures partagees passent par la couche service et utilisent des scopes versionnes stockes en base.
- Une creation, modification ou suppression invalide l'entite concernee, incremente les vues impactees et notifie les autres instances.
- `refresh=1` force une relecture depuis la source de verite.

### Configuration Hugging Face
- Variables d'environnement :
  - `HUGGINGFACE_API_KEY`
  - `HUGGINGFACE_BASE_URL` (optionnelle, valeur par defaut `https://router.huggingface.co/v1`)
- Provider : `huggingface`
- Modele par defaut : `MiniMaxAI/MiniMax-M2.7`
- Le modele Hugging Face reste configurable librement dans les parametres LLM
- Alias accepte pour ce modele par defaut : `minimax-m2.7:cloud`

### Cabinets (Firms)
- `GET /api/firms` - Liste des cabinets
- `POST /api/firms` - Créer un cabinet
- `PUT /api/firms/:id` - Modifier un cabinet

### Administration
- `GET /api/users` - Liste des utilisateurs (admin)
- `GET /api/metrics` - Métriques LLM
- `GET /api/settings` - Paramètres application
- `PUT /api/settings` - Modifier les paramètres

### Santé
- `GET /api/health` - État général
- `GET /api/health/memory` - Stats mémoire détaillées

## 🧪 Tests

```bash
# Lancer tous les tests
npm run test

# Mode watch
npm run test:watch

# Avec couverture
npm run test:coverage

# Tests frontend
npm run test:client

# E2E Playwright
npx playwright test --project=chromium
```

### Conventions E2E
- Les specs Playwright vivent dans `e2e/`.
- Les parcours authentifiés réutilisent `e2e/helpers/auth.ts`.
- Le helper bootstrappe un utilisateur `active` en base puis injecte des cookies JWT Playwright au lieu de passer par `/api/auth/signin`.
- Cette approche évite les collisions avec la spec de rate limiting auth et rend la suite stable en exécution parallèle.
- Le bootstrap e2e garantit aussi un template d'export actif pour l'utilisateur Playwright.
- La stack e2e démarre le proxy applicatif et le `pdf-server` via `scripts/start-e2e-stack.mjs`.
- Pour les uploads e2e, privilégier des fixtures déterministes et assez riches pour passer les seuils métier d'extraction.
- Les flux métier de référence actuellement couverts sont `upload -> analysis` et `analysis -> improve -> export`.

### Flux métier CV
- Le flux supporté pour l'import, l'analyse et l'amélioration des CVs passe par `batch-jobs`.
- Les endpoints `extract-pdf` et `extract-doc` restent exposés pour l'extraction technique utilisée par certains traitements frontend.
- L'ancien endpoint direct `POST /api/resumes/upload` n'est plus une voie supportée.

## 📊 Monitoring

L'application inclut un monitoring mémoire accessible via :
- **Header** : Indicateur de santé avec tooltip détaillé
- **API** : `/api/health/memory` pour les stats complètes
- **Page Métriques** : Dashboard complet des appels LLM

### Caches monitorés
- ESCO Cache (compétences)
- Trends Cache (tendances marché)
- Facts Cache (faits marché)
- Métiers Cache (référentiel ROME)
- Tags Cache (tags extraits)

### Backend de cache
- `CACHE_BACKEND=memory` : cache local au process, adapté au mono-instance
- `CACHE_BACKEND=redis` : cache partagé entre instances
- variables associées :
  - `CACHE_REDIS_URL`
  - `CACHE_KEY_PREFIX`
- comportement runtime :
  - `CACHE_BACKEND` correspond au backend demandé dans la configuration
  - si Redis est demandé mais indisponible, l'application bascule automatiquement sur `memory-fallback`
  - les métriques distinguent donc le backend configuré et le backend effectivement utilisé
- caches applicatifs déjà branchés sur cette abstraction :
  - `settings`
  - `templates`
  - `firms`
  - disponibilité runtime LLM via `settings`
- diagnostics visibles :
  - `/health` expose le backend effectif via `checks.cache.backend`, plus `checks.cache.connected` et `checks.cache.fallbackReason`
  - `/api/admin/cache-stats` expose :
    - `cacheBackend.configuredBackend`
    - `cacheBackend.backend` (backend effectif)
    - `cacheBackend.connected`
    - `cacheBackend.fallbackReason`
  - la page métriques admin affiche donc le backend configuré et le backend effectif
- en Docker :
  - `docker-run.bat` démarre la pile standard `app + redis`
  - `docker-run-compose.bat` reste un alias de compatibilité vers `docker-run.bat`


## 🤖 Intégration LLM

L'application supporte plusieurs fournisseurs LLM :

### OpenAI
- **GPT-5.4 / GPT-5.4-pro / GPT-5.2 / GPT-5.2-pro / GPT-5.1 / GPT-5** : famille de raisonnement principale (Responses API)
- **GPT-5-mini / GPT-5-nano** : variantes plus légères pour tâches rapides ou à coût réduit
- **GPT-4.1 / GPT-4.1-mini / GPT-4.1-nano** : famille non-reasoning à grande fenêtre de contexte
- **GPT-4o / GPT-4o-mini** : alternatives rapides et polyvalentes

### Anthropic
- **Claude Opus 4.1 / Opus 4** : qualité maximale
- **Claude Sonnet 4** : meilleur compromis performance / coût
- **Claude 3.7 Sonnet** : génération longue avec sortie élevée
- **Claude 3.5 Sonnet / Haiku** : modèles plus compacts et économiques

### DeepSeek
- **DeepSeek-V3.2 - Standard** : appelé via l'identifiant API `deepseek-chat`
- **DeepSeek-V3.2 - Raisonnement** : appelé via l'identifiant API `deepseek-reasoner`, avec sanitation serveur du `reasoning_content`

### Gemma Cloud (via Gemini)
- **Gemma 3 27B / 12B / 4B** : variantes instruction disponibles via l'endpoint OpenAI-compatible Google
- **Gemma 4 31B / 27B** : variantes Gemma Cloud compatibles avec le provider `gemma`
- Variables serveur : `GEMINI_API_KEY` et `GEMINI_OPENAI_BASE_URL` (par défaut `https://generativelanguage.googleapis.com/v1beta/openai`)

### GLM (Z.AI)
- **GLM-5.1** : modèle par défaut de la famille GLM dans l'application
- **GLM-5** : variante compatible OpenAI-compatible via l'API Z.AI
- Endpoint serveur : `GLM_BASE_URL` (par défaut `https://api.z.ai/api/paas/v4`)

### MiniMax
- **MiniMax-M2.7 / MiniMax-M2.7-highspeed** : modèles principaux côté MiniMax
- **MiniMax-M2.5 / MiniMax-M2.5-highspeed** : alternatives orientées performance / latence
- **MiniMax-M2.1 / MiniMax-M2.1-highspeed / MiniMax-M2 / M2-her** : variantes compatibles selon le cas d'usage

### Ollama (distant)
- Instance Ollama distante uniquement
- URL configurable dans les paramètres LLM
- `keep_alive` et `num_ctx` pilotables via les paramètres stockés

Configuration via les paramètres de l'application ou variables d'environnement. L'orchestration serveur passe par un gateway LLM unique avec retries, circuit breakers, sanitation du contenu et métriques bornées. Les providers distants (`openai`, `anthropic`, `gemma`, `deepseek`, `glm`, `minimax`) utilisent retry + circuit breaker, tandis que `ollama` utilise uniquement un retry réseau léger, sans circuit breaker.

## 🐳 Docker

L'application peut être déployée via Docker avec tous les services intégrés (PostgreSQL 18, Node.js, Google Chrome pour PDF).

```bash
# Build de l'image
docker build -t resumeconverter:latest .

# Lancer le conteneur
docker run -d \
    --name resumeconverter-app \
    -p 3443:3443 \
    -p 5433:5432 \
    --restart unless-stopped \
    resumeconverter:latest
```

**Accès** : https://localhost:3443  
**Identifiants** : `admin@resumeconverter.local` / `admin123`

Voir le dossier `docker/` et `docker/README.md` pour les configurations détaillées.

### Mode Docker standard avec Redis séparé

Le workflow principal Windows démarre maintenant Redis dans un service séparé :

```bash
docker-run.bat
```

Ce mode démarre :
- `resumeconverter-app`
- `resumeconverter-redis`

Fichiers associés :
- `docker-compose.redis.yml`
- `docker-run.bat`
- `docker-stop.bat`

## 📚 Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Architecture technique détaillée
- [USER_GUIDE.md](./USER_GUIDE.md) - Guide utilisateur complet
- [SECURITY.md](./SECURITY.md) - Politique de sécurité
- [MEMORY_AUDIT.md](./MEMORY_AUDIT.md) - Audit mémoire et optimisations
- [docs/ANALYSE_ALTERNATIVES_LLM.md](./docs/ANALYSE_ALTERNATIVES_LLM.md) - Analyse des alternatives LLM

## 🔄 Changelog

Voir [CHANGELOG.md](./CHANGELOG.md) pour l'historique des versions.

## 📝 Licence

Voir [LICENSE](./LICENSE) pour les détails.

## 👥 Contributeurs

- Équipe Resume Converter



Le mode hors Docker utilise le même bootstrap canonique : `npm run migrate` applique `docker/schema.sql` sur une base vide, puis les migrations incrémentales restantes.
