# Resume Converter

[![Version](https://img.shields.io/badge/version-1.7.8-blue.svg)](./CHANGELOG.md)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18+-blue.svg)](https://www.postgresql.org/)
[![React](https://img.shields.io/badge/React-18.2-61dafb.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)

Application professionnelle de gestion et d'analyse de CVs avec intelligence artificielle, matching de profils et radar du marchÃƒÂ© de l'emploi intÃƒÂ©grÃƒÂ©.

## Ã°Å¸Å¡â‚¬ FonctionnalitÃƒÂ©s

### Gestion des CVs
- **Upload et parsing** : Support PDF, DOCX, DOC avec OCR (Tesseract.js)
- **Analyse IA** : Extraction automatique des compÃƒÂ©tences, expÃƒÂ©riences et formations via GPT-5/Claude
- **Tags ESCO** : Classification automatique selon le rÃƒÂ©fÃƒÂ©rentiel europÃƒÂ©en des compÃƒÂ©tences
- **Ãƒâ€°dition enrichie** : Ãƒâ€°diteur TinyMCE intÃƒÂ©grÃƒÂ© pour la mise en forme
- **Export PDF** : GÃƒÂ©nÃƒÂ©ration de CVs formatÃƒÂ©s avec templates personnalisables
- **AmÃƒÂ©lioration IA** : Suggestions d'amÃƒÂ©lioration automatiques du contenu

- **Scoring LLM pilotable** : La concurrence et la taille des batches du profile matching sont configurables par environnement

### Gestion des Missions
- **CrÃƒÂ©ation et suivi** : Gestion complÃƒÂ¨te des offres d'emploi
- **Association CV** : Lien entre missions et candidats
- **Historique** : Suivi des adaptations et matchings

### Gestion des Cabinets (Firms)
- **Multi-cabinets** : Support de plusieurs cabinets de recrutement
- **Association utilisateurs** : Gestion des droits par cabinet

### Radar du MarchÃƒÂ©
- **Tendances du marchÃƒÂ©** : Visualisation des offres d'emploi, tensions de recrutement, embauches
- **Carte de France interactive** : RÃƒÂ©partition gÃƒÂ©ographique par rÃƒÂ©gion avec MapLibre GL
- **DonnÃƒÂ©es France Travail** : IntÃƒÂ©gration API officielle (offres, tensions, BMO)
- **DonnÃƒÂ©es Adzuna** : AgrÃƒÂ©gation multi-sources d'offres d'emploi
- **Filtres avancÃƒÂ©s** : Par type de donnÃƒÂ©es, rÃƒÂ©gion, mÃƒÂ©tier (code ROME)
- **MÃƒÂ©tiers ROME** : RÃƒÂ©fÃƒÂ©rentiel complet avec recherche et navigation

### Chatbot IA
- **Assistant conversationnel** : Aide ÃƒÂ  la rÃƒÂ©daction et conseils carriÃƒÂ¨re
- **Multi-modÃƒÂ¨les** : Support OpenAI (GPT-5.4 / GPT-5.4-pro / GPT-5.2 / GPT-5.1 / GPT-5 / GPT-4.1 / GPT-4o), Anthropic (Claude Opus 4.x / Sonnet 4 / Claude 3.7 / Claude 3.5), DeepSeek (DeepSeek-V3.2 via `deepseek-chat` et `deepseek-reasoner`), GLM (`glm-5.1`, `glm-5`), MiniMax et Ollama distant
- **Contexte CV** : RÃƒÂ©ponses personnalisÃƒÂ©es basÃƒÂ©es sur le profil

### Administration
- **Gestion utilisateurs** : CRUD complet avec rÃƒÂ´les (admin, user)
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

## Ã°Å¸Å’Â API Endpoints

### Authentification
- `POST /api/auth/login` - Connexion
- `POST /api/auth/register` - Inscription
- `POST /api/auth/refresh` - RafraÃƒÂ®chir le token
- `POST /api/auth/logout` - DÃƒÂ©connexion

### CVs
- `GET /api/resumes` - Liste des CVs
- `POST /api/resumes` - CrÃƒÂ©er un CV
- `GET /api/resumes/:id` - DÃƒÂ©tails d'un CV
- `PUT /api/resumes/:id` - Modifier un CV
- `DELETE /api/resumes/:id` - Supprimer un CV
- `POST /api/resumes/upload` - Upload fichier CV
- `POST /api/resumes/:id/analyze` - Analyser un CV avec IA
- `POST /api/resumes/:id/improve` - AmÃƒÂ©liorer un CV avec IA

### Missions
- `GET /api/missions` - Liste des missions
- `POST /api/missions` - CrÃƒÂ©er une mission
- `GET /api/missions/:id` - DÃƒÂ©tails d'une mission
- `PUT /api/missions/:id` - Modifier une mission
- `DELETE /api/missions/:id` - Supprimer une mission
- `DELETE /api/missions/:missionId/keywords-cache` - Vider le cache de mots-clÃƒÂ©s d'une mission

### Jobs backend pour missions et matching
- `POST /api/batch-jobs/profile-search` - Lancer une recherche de profils pour une mission
- `POST /api/batch-jobs/profile-analysis` - Lancer une analyse dÃƒÂ©taillÃƒÂ©e d'un profil pour une mission
- `POST /api/batch-jobs/match` - Lancer une analyse de match mission/CV
- `POST /api/batch-jobs/adapt` - Lancer une adaptation de CV pour une mission
- `GET /api/batch-jobs/:id` - Suivre l'avancement et rÃƒÂ©cupÃƒÂ©rer les rÃƒÂ©sultats d'un job

### Adaptations
- `GET /api/adaptations` - Liste des adaptations
- `POST /api/adaptations` - CrÃƒÂ©er une adaptation CV/Mission
- `GET /api/adaptations/:id` - DÃƒÂ©tails d'une adaptation

### Matching
- `POST /api/batch-jobs/match` - Lancer une analyse de matching CV/Mission
- `GET /api/batch-jobs/:id` - Suivre l'avancement et rÃƒÂ©cupÃƒÂ©rer le rÃƒÂ©sultat du matching

### Radar du MarchÃƒÂ©
- `GET /api/market-radar/trends` - Tendances paginÃƒÂ©es
- `GET /api/market-radar/trends/all` - Toutes les tendances (carte)
- `GET /api/market-radar/trends/:id/metadata` - Metadata d'une tendance
- `GET /api/market-radar/facts` - Faits du marchÃƒÂ©
- `POST /api/market-radar/collect` - Collecter nouvelles donnÃƒÂ©es

### MÃƒÂ©tiers ROME
- `GET /api/rome/metiers` - Liste des mÃƒÂ©tiers
- `GET /api/rome/metiers/:code` - DÃƒÂ©tails d'un mÃƒÂ©tier
- `GET /api/rome/search` - Recherche de mÃƒÂ©tiers

### Tags
- `GET /api/tags` - Liste des tags
- `POST /api/tags/extract` - Extraire les tags d'un texte

### LLM (Proxy)
- `POST /api/llm/openai` - Proxy OpenAI (GPT-5, GPT-4o) avec routage compatible DeepSeek / GLM / MiniMax / Ollama selon configuration
- `POST /api/llm/anthropic` - Proxy Anthropic (Claude) avec routage compatible MiniMax selon configuration
- `POST /api/llm/messages` - Proxy Anthropic / providers compatibles
- `POST /api/llm/chat/completions` - Proxy OpenAI-compatible unifiÃƒÂ© (OpenAI, DeepSeek, GLM, MiniMax, Ollama selon configuration)
- `GET /api/llm/circuit-breakers` - Etat des familles LLM (`openai`, `anthropic`, `deepseek`, `glm`, `minimax`, `ollama`)

### Cabinets (Firms)
- `GET /api/firms` - Liste des cabinets
- `POST /api/firms` - CrÃƒÂ©er un cabinet
- `PUT /api/firms/:id` - Modifier un cabinet

### Administration
- `GET /api/users` - Liste des utilisateurs (admin)
- `GET /api/metrics` - MÃƒÂ©triques LLM
- `GET /api/settings` - ParamÃƒÂ¨tres application
- `PUT /api/settings` - Modifier les paramÃƒÂ¨tres

### SantÃƒÂ©
- `GET /api/health` - Ãƒâ€°tat gÃƒÂ©nÃƒÂ©ral
- `GET /api/health/memory` - Stats mÃƒÂ©moire dÃƒÂ©taillÃƒÂ©es

## Ã°Å¸Â§Âª Tests

```bash
# Lancer tous les tests
npm run test

# Mode watch
npm run test:watch

# Avec couverture
npm run test:coverage
```

## Ã°Å¸â€œÅ  Monitoring

L'application inclut un monitoring mÃƒÂ©moire accessible via :
- **Header** : Indicateur de santÃƒÂ© avec tooltip dÃƒÂ©taillÃƒÂ©
- **API** : `/api/health/memory` pour les stats complÃƒÂ¨tes
- **Page MÃƒÂ©triques** : Dashboard complet des appels LLM

### Caches monitorÃƒÂ©s
- ESCO Cache (compÃƒÂ©tences)
- Trends Cache (tendances marchÃƒÂ©)
- Facts Cache (faits marchÃƒÂ©)
- MÃƒÂ©tiers Cache (rÃƒÂ©fÃƒÂ©rentiel ROME)
- Tags Cache (tags extraits)


## Ã°Å¸Â¤â€“ IntÃƒÂ©gration LLM

L'application supporte plusieurs fournisseurs LLM :

### OpenAI
- **GPT-5.4 / GPT-5.4-pro / GPT-5.2 / GPT-5.2-pro / GPT-5.1 / GPT-5** : famille de raisonnement principale (Responses API)
- **GPT-5-mini / GPT-5-nano** : variantes plus lÃƒÂ©gÃƒÂ¨res pour tÃƒÂ¢ches rapides ou ÃƒÂ  coÃƒÂ»t rÃƒÂ©duit
- **GPT-4.1 / GPT-4.1-mini / GPT-4.1-nano** : famille non-reasoning ÃƒÂ  grande fenÃƒÂªtre de contexte
- **GPT-4o / GPT-4o-mini** : alternatives rapides et polyvalentes

### Anthropic
- **Claude Opus 4.1 / Opus 4** : qualitÃƒÂ© maximale
- **Claude Sonnet 4** : meilleur compromis performance / coÃƒÂ»t
- **Claude 3.7 Sonnet** : gÃƒÂ©nÃƒÂ©ration longue avec sortie ÃƒÂ©levÃƒÂ©e
- **Claude 3.5 Sonnet / Haiku** : modÃƒÂ¨les plus compacts et ÃƒÂ©conomiques

### DeepSeek
- **DeepSeek-V3.2 - Standard** : appelÃƒÂ© via l'identifiant API `deepseek-chat`
- **DeepSeek-V3.2 - Raisonnement** : appelÃƒÂ© via l'identifiant API `deepseek-reasoner`, avec sanitation serveur du `reasoning_content`

### GLM (Z.AI)
- **GLM-5.1** : modÃƒÂ¨le par dÃƒÂ©faut de la famille GLM dans l'application
- **GLM-5** : variante compatible OpenAI-compatible via l'API Z.AI
- Endpoint serveur : `GLM_BASE_URL` (par dÃƒÂ©faut `https://api.z.ai/api/paas/v4`)

### MiniMax
- **MiniMax-M2.7 / MiniMax-M2.7-highspeed** : modÃƒÂ¨les principaux cÃƒÂ´tÃƒÂ© MiniMax
- **MiniMax-M2.5 / MiniMax-M2.5-highspeed** : alternatives orientÃƒÂ©es performance / latence
- **MiniMax-M2.1 / MiniMax-M2.1-highspeed / MiniMax-M2 / M2-her** : variantes compatibles selon le cas d'usage

### Ollama (distant)
- Instance Ollama distante uniquement
- URL configurable dans les paramÃƒÂ¨tres LLM
- `keep_alive` et `num_ctx` pilotables via les paramÃƒÂ¨tres stockÃƒÂ©s

Configuration via les paramÃƒÂ¨tres de l'application ou variables d'environnement. L'orchestration serveur passe par un gateway LLM unique avec retries, circuit breakers, sanitation du contenu et mÃƒÂ©triques bornÃƒÂ©es. Les providers distants (`openai`, `anthropic`, `deepseek`, `glm`, `minimax`) utilisent retry + circuit breaker, tandis que `ollama` utilise uniquement un retry rÃƒÂ©seau lÃƒÂ©ger, sans circuit breaker.

## Ã°Å¸ÂÂ³ Docker

L'application peut ÃƒÂªtre dÃƒÂ©ployÃƒÂ©e via Docker avec tous les services intÃƒÂ©grÃƒÂ©s (PostgreSQL 18, Node.js, Google Chrome pour PDF).

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

**AccÃƒÂ¨s** : https://localhost:3443  
**Identifiants** : `admin@resumeconverter.local` / `admin123`

Voir le dossier `docker/` et `docker/README.md` pour les configurations dÃƒÂ©taillÃƒÂ©es.

## Ã°Å¸â€œÅ¡ Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Architecture technique dÃƒÂ©taillÃƒÂ©e
- [USER_GUIDE.md](./USER_GUIDE.md) - Guide utilisateur complet
- [SECURITY.md](./SECURITY.md) - Politique de sÃƒÂ©curitÃƒÂ©
- [MEMORY_AUDIT.md](./MEMORY_AUDIT.md) - Audit mÃƒÂ©moire et optimisations
- [docs/ANALYSE_ALTERNATIVES_LLM.md](./docs/ANALYSE_ALTERNATIVES_LLM.md) - Analyse des alternatives LLM

## Ã°Å¸â€â€ž Changelog

Voir [CHANGELOG.md](./CHANGELOG.md) pour l'historique des versions.

## Ã°Å¸â€œÂ Licence

Voir [LICENSE](./LICENSE) pour les dÃƒÂ©tails.

## Ã°Å¸â€˜Â¥ Contributeurs

- Ãƒâ€°quipe Resume Converter



Le mode hors Docker utilise le mÃƒÂªme bootstrap canonique : `npm run migrate` applique `docker/schema.sql` sur une base vide, puis les migrations incrÃƒÂ©mentales restantes.

