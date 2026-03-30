### 📈 Métriques Système

| Métrique | Description |
|----------|-------------|
| **Mémoire** | Heap used/total, RSS, external |
| **Requêtes** | Count par endpoint, temps moyen |
| **LLM** | Tokens consommés, coûts estimés |
| **Profile Matching** | Recherches lancées, profils demandés/scorés, batches démarrés/retriés/en échec |
| **Cache** | Hit/miss ratio, taille |
| **Rate Limit** | Hits par type de limite |

### Configuration du profile matching

- `PROFILE_MATCHING_LLM_MAX_CONCURRENCY`
  - `0` : concurrence par défaut selon le provider
  - `1..100` : plafond global des appels batch LLM simultanés
- `PROFILE_MATCHING_LLM_BATCH_SIZE`
  - `0` : taille de batch par défaut selon le provider
  - `1..100` : taille de batch forcée pour le scoring de profils
- Valeurs par défaut actuellement utilisées :
  - MiniMax : batch `6`, concurrence `3`
  - DeepSeek : batch `4`, concurrence `2` pour `deepseek-reasoner`
  - autres providers : batch `12`, concurrence `5`

### Ranking local administrable

Le `profile matching` utilise un pré-ranking local avant le scoring LLM. Cette couche est maintenant pilotable à deux niveaux :

- valeurs par défaut via l'environnement
- override persistant via `llm_settings`

Poids disponibles :

- `Profile Matching Local Skill Weight`
- `Profile Matching Local Tool Weight`
- `Profile Matching Local Industry Weight`
- `Profile Matching Local Soft Skill Weight`
- `Profile Matching Local Title Exact Weight`
- `Profile Matching Local Title Token Weight`
- `Profile Matching Local Coverage Multiplier`

Variables d'environnement associées :

- `PROFILE_MATCHING_LOCAL_SKILL_WEIGHT`
- `PROFILE_MATCHING_LOCAL_TOOL_WEIGHT`
- `PROFILE_MATCHING_LOCAL_INDUSTRY_WEIGHT`
- `PROFILE_MATCHING_LOCAL_SOFTSKILL_WEIGHT`
- `PROFILE_MATCHING_LOCAL_TITLE_EXACT_WEIGHT`
- `PROFILE_MATCHING_LOCAL_TITLE_TOKEN_WEIGHT`
- `PROFILE_MATCHING_LOCAL_COVERAGE_MULTIPLIER`

Règle de priorité :

- valeur persistée en base via `Settings`
- sinon fallback sur l'environnement
- sinon fallback sur les constantes serveur

### Expiration des indisponibilités runtime

La couche `llmAvailability.service.js` persiste les refus runtime provider/modèle avec une expiration.

Structure persistée :

- `model`
- `reason`
- `fallbackModel`
- `markedAt`
- `expiresAt`

TTL global :

- `LLM_RUNTIME_UNAVAILABLE_TTL_MS`
- défaut : `6h`

Comportement :

- les entrées expirées sont ignorées au chargement
- les entrées expirées sont ignorées lors de `resolveAvailableModel(...)`
- cela évite de masquer un modèle de façon permanente après un incident transitoire ou un refus temporaire


## 📋 Table des Matières

1. [Vue d'Ensemble](#vue-densemble)
2. [Architecture Globale](#architecture-globale)
3. [Frontend (React 19/TypeScript)](#frontend-react-19--typescript)
4. [Backend (Node.js/Express)](#backend-nodejsexpress)
5. [Base de Données (PostgreSQL)](#base-de-données-postgresql)
6. [Intégrations LLM](#intégrations-llm)
7. [Intégrations Externes](#intégrations-externes)
8. [Sécurité](#sécurité)
9. [Optimisations](#optimisations)
10. [Gestion des Fichiers Temporaires](#gestion-des-fichiers-temporaires)
11. [Internationalisation (i18n)](#internationalisation-i18n)
12. [Qualité du Code](#qualité-du-code)
13. [Points Forts](#-points-forts)
14. [Points Faibles et Axes d'Amélioration](#-points-faibles-et-axes-damélioration)
15. [Déploiement Docker](#déploiement-docker)
16. [Sauvegardes et Planification](#sauvegardes-et-planification)

---

## Vue d'Ensemble

**ResumeConverter** est une application web full-stack de gestion et d'optimisation de CV assistée par intelligence artificielle. Elle permet aux entreprises (ESN) de gérer une CVthèque, d'analyser et améliorer les CV, et de les adapter à des missions spécifiques.

### Stack Technique

| Couche | Technologies |
|--------|-------------|
| **Frontend** | React 19, TypeScript, Vite 8 (Rolldown), TailwindCSS 4, Framer Motion |
| **Backend** | Node.js, Express.js |
| **Base de données** | PostgreSQL 18 avec pg (node-postgres) |
| **IA/LLM** | OpenAI (GPT-4/5), Anthropic (Claude), DeepSeek, GLM, MiniMax, Ollama distant |
| **APIs Externes** | France Travail, Adzuna, ROME 4.0, ESCO |
| **Génération PDF** | Puppeteer (html-pdf-node) |
| **Éditeur WYSIWYG** | Tiptap 3.x (ProseMirror) |
| **Cartographie** | MapLibre GL JS |
| **Calendrier** | Google Calendar API (OAuth2) |
| **Authentification** | JWT (Access + Refresh Tokens) |
| **Sécurité** | Helmet, CSRF (Double Submit), Rate Limiting, SQL Injection Protection |

---

## Architecture Globale

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                             │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                React SPA (Vite 8 / Rolldown)                  │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │    │
│  │  │  Pages   │  │Components│  │ Contexts │  │  Hooks   │    │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS (API Calls)
                                    â–¼
┌─────────────────────────────────────────────────────────────────────┐
│                      PROXY SERVER (Express)                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │Middleware│  │  Routes  │  │ Services │  │  Utils   │            │
│  │ - Auth   │  │ - /auth  │  │ - JWT    │  │ - Logger │            │
│  │ - CSRF   │  │ - /api/* │  │ - LLM    │  │ - Valid. │            │
│  │ - Rate   │  │ - /llm   │  │ - Cache  │  │ - Sanit. │            │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │
└─────────────────────────────────────────────────────────────────────┘
                    │                           │
                    │                           │
                    â–¼                           â–¼
        ┌──────────────────┐        ┌──────────────────┐
        │    PostgreSQL    │        │   LLM Providers  │
        │   (Database)     │        │ OpenAI/Anthropic │
        └──────────────────┘        └──────────────────┘
```

### Flux de Données

1. **Requête utilisateur** → Frontend React
2. **Appel API** → Proxy Server (avec JWT + CSRF token)
3. **Validation & Auth** → Middleware chain
4. **Création de job** → Route backend persistante (`batch_jobs`, `batch_job_items`)
5. **Exécution asynchrone** → Worker batch → Services métier → PostgreSQL / API LLM
6. **Suivi d'avancement** → Polling frontend sur `GET /api/batch-jobs/:id`
7. **Hydratation finale** → JSON → Frontend → UI Update

---

## Frontend (React 19 / TypeScript)

### Build Tooling (Vite 8)

Vite 8 remplace **Rollup** et **esbuild** par **Rolldown** (bundler Rust) et **OXC** (minificateur) :

| Composant | Avant (Vite 5) | Après (Vite 8) |
|-----------|----------------|-----------------|
| **Bundler** | Rollup | Rolldown |
| **Dependency optimizer** | esbuild | Rolldown |
| **Minificateur** | esbuild | OXC (`minify: true`) |
| **CommonJS** | `@rollup/plugin-commonjs` | Natif Rolldown |
| **Config optimizeDeps** | `esbuildOptions` | `rolldownOptions` |
| **Treeshake** | `tryCatchDeoptimization` | Supprimé (inutile) |

### TailwindCSS 4 (CSS-first)

TailwindCSS 4 utilise une configuration **CSS-first** via `@theme`, `@plugin` et `@variant` directement dans le CSS. Les fichiers `tailwind.config.js` et `postcss.config.js` sont supprimés.

```css
/* src/styles/index.css */
@import "tailwindcss";
@plugin "@tailwindcss/typography";

@theme {
  --color-primary-500: #6366f1;
  --color-primary-600: #4f46e5;
  /* ... tokens de design */
}
```

| Changement | Avant (v3) | Après (v4) |
|------------|------------|------------|
| **Config** | `tailwind.config.js` + `postcss.config.js` | CSS-first (`@theme`, `@plugin`) |
| **Plugin Vite** | `postcss` pipeline | `@tailwindcss/vite` (natif) |
| **Ring** | `ring` = 3px | `ring` = 1px (expliciter `ring-3`) |
| **Couleurs** | `bg-opacity-50` | `bg-primary-500/50` |
| **Autoprefixer** | Requis | Intégré |

### Structure des Dossiers

```
src/
├── components/          # Composants réutilisables (80+ fichiers)
│   ├── ChatBot.tsx      # Assistant IA avec Markdown
│   ├── Layout.tsx       # Layout principal avec sidebar
│   ├── ResumeAnalysis/  # Composants d'analyse de CV (8 sous-composants)
│   ├── HealthIndicator.tsx # Monitoring santé serveur (admin)
│   ├── Pagination.tsx   # Pagination réutilisable
│   ├── WebGLBackground.tsx # Animation 3D page d'accueil
│   ├── ProcessingScreen.tsx # Animation des étapes d'upload/analyse
│   ├── ImprovementAnimation.tsx # Animation des étapes d'amélioration
│   ├── TiptapEditor.tsx # Éditeur WYSIWYG Tiptap
│   ├── market/          # Composants Market Radar (carte France)
│   ├── ui/              # Composants UI réutilisables (Skeleton, etc.)
│   └── ...
├── pages/               # Pages de l'application (33 fichiers)
│   ├── ResumesPage.tsx  # CVthèque avec pagination serveur
│   ├── ResumeAnalysisPage.tsx # Analyse de CV détaillée
│   ├── ResumeImprovePage.tsx  # Amélioration de CV
│   ├── ResumeExportPage.tsx   # Export de CV
│   ├── ResumeAdaptPage.tsx    # Adaptation CV/Mission
│   ├── MissionsPage.tsx # Gestion des missions
│   ├── AdaptationsPage.tsx # Adaptations CV/Mission
│   ├── ClientsPage.tsx  # Gestion CRM clients
│   ├── BatchUploadPage.tsx  # Import batch de CV
│   ├── BatchJobsPage.tsx    # Suivi des jobs batch
│   ├── ProfileMatchingPage.tsx # Matching profils/missions
│   ├── FactsPage.tsx    # Market Radar - Données marché
│   ├── MetiersPage.tsx  # Référentiel ROME 4.0
│   ├── GdprAuditPage.tsx # Journal RGPD
│   ├── BackupPage.tsx   # Configuration sauvegardes (admin)
│   ├── MetricsPage.tsx  # Métriques système (admin)
│   ├── admin/EmailTemplatesPage.tsx # Templates email (admin)
│   └── ...
├── context/             # Contextes React (3 fichiers)
│   ├── AuthContext.tsx  # Authentification globale
│   ├── ResumeContext.tsx # État des CV
│   └── ChatbotContext.tsx
├── hooks/               # Hooks personnalisés
│   ├── useAuthFetch.ts  # Fetch avec auth + CSRF retry
│   └── useDebounce.ts   # Debounce pour recherche
├── services/            # Services frontend
│   └── authService.ts   # Gestion authentification
├── utils/               # Utilitaires (30+ fichiers)
│   ├── apiInterceptor.ts # Interception des requêtes
│   ├── validation.ts    # Validation Zod
│   ├── templateService.ts # Gestion templates export
│   ├── resumeService.ts   # Service CV (CRUD, export)
│   └── sanitizer.frontend.ts
├── i18n/                # Internationalisation (FR/EN)
├── types/               # Types TypeScript
└── styles/              # Styles CSS (TailwindCSS 4 CSS-first config)
```

### Composants Clés

| Composant | Rôle |
|-----------|------|
| `AuthContext` | Gestion de l'état d'authentification, tokens, user |
| `ResumeContext` | État global des CV, sélection, opérations CRUD |
| `ChatBot` | Assistant IA avec rendu Markdown, redimensionnable |
| `Layout` | Structure de page avec sidebar, header, navigation |
| `apiInterceptor` | Interception des requêtes, gestion CSRF, retry automatique |
| `Pagination` | Composant de pagination réutilisable avec navigation |
| `HealthIndicator` | Monitoring mémoire et santé serveur (admin) |
| `ProcessingScreen` | Animation des étapes d'analyse CV |

### Gestion de l'État

- **Contextes React** : État global (Auth, Resume, Chatbot)
- **useState/useEffect** : État local des composants
- **Pas de Redux** : Simplicité privilégiée pour cette taille de projet

### Routing (React Router 7)

```typescript
// Routes protégées par authentification
<ProtectedRoute>
  <Route path="resumes" element={<ResumesPage />} />
  <Route path="missions" element={<MissionsPage />} />
</ProtectedRoute>

// Routes admin uniquement
<AdminRoute>
  <Route path="settings" element={<SettingsPage />} />
  <Route path="dashboard/users" element={<UsersManagement />} />
</AdminRoute>
```

---

## Backend (Node.js/Express)

### Architecture du Serveur Proxy

Le backend est un **serveur proxy** (`proxy-server.js`) qui :
- Sécurise les clés API (OpenAI, Anthropic)
- Centralise l'authentification et l'autorisation
- Applique les politiques de sécurité (CORS, CSP, Rate Limiting)
- Gère les connexions PostgreSQL avec pooling et retry automatique

### Structure des Routes

```
server/routes/
├── auth/                    # Authentification (modulaire)
│   ├── signin.routes.js     # Login, 2FA, password
│   ├── google.routes.js     # Google OAuth SSO
│   └── users.routes.js      # Gestion utilisateurs (admin)
├── resumes/                 # CV (modulaire)
│   ├── crud.routes.js       # CRUD CV, pagination, filtres
│   ├── upload.routes.js     # Upload fichier + RGPD
│   ├── llm.handlers.js      # Analyse, amélioration, adaptation
│   ├── versions.routes.js   # Historique des versions
│   └── stats.routes.js      # Statistiques CV
├── adaptations.routes.js    # Adaptations CV/Mission
├── missions.routes.js       # CRUD missions
├── clients.routes.js        # CRM clients/prospects
├── resumeComments.routes.js # Commentaires sur CV
├── resumeSubmissions.routes.js # Envoi de CV à des clients
├── pipeline.routes.js       # Pipeline de recrutement
├── deals.routes.js          # Affaires commerciales
├── batchJobs.routes.js      # Jobs backend (import, amélioration, matching, adaptation, missions)
├── batchExport.routes.js    # Export batch (ZIP)
├── templates/crud.routes.js # Templates d'export PDF
├── llm.routes.js            # Proxy LLM (OpenAI/Anthropic)
├── chatbot.routes.js        # Assistant IA contextuel
├── settings.routes.js       # Configuration application
├── firms.routes.js          # Gestion des cabinets
├── tags.routes.js           # Gestion des tags avec cache
├── consent.routes.js        # Consentement RGPD candidats
├── gdprAudit.routes.js      # Journal d'audit RGPD
├── gdprMail.routes.js       # Envoi emails RGPD
├── mail.routes.js           # Envoi emails (Gmail/SMTP)
├── emailTemplates.routes.js # Templates email MJML
├── calendar.routes.js       # Google Calendar (entretiens)
├── share.routes.js          # Partage public de CV (QR code)
├── backup.routes.js         # Sauvegarde/restauration
├── marketRadar/             # Données marché (modulaire)
│   ├── facts.routes.js      # Statistiques marché
│   ├── trends.routes.js     # Tendances salariales
│   ├── search.routes.js     # Recherche offres
│   ├── collection.routes.js # Collecte données
│   └── reference.routes.js  # Référentiels ROME/ESCO
├── rome.routes.js           # Référentiel ROME 4.0 métiers
├── metrics.routes.js        # Métriques et monitoring
├── health.routes.js         # Health check + memory stats
├── admin.routes.js          # Routes administration (security logs)
└── docs.routes.js           # Documentation Swagger
```

### Services Backend

| Service | Rôle |
|---------|------|
| `jwt.service.js` | Génération/vérification JWT, révocation |
| `llm.service.js` | Orchestration LLM métier indépendante du provider |
| `cache.service.js` | Cache en mémoire avec TTL et cleanup |
| `database.service.js` | Pool PostgreSQL avec retry |
| `tokenBlacklist.service.js` | Révocation tokens, blacklist users |
| `googleAuth.service.js` | Google OAuth SSO |
| `consent.service.js` | Consentement RGPD candidats |
| `gdprAudit.service.js` | Journal d'audit RGPD |
| `mail/mailService.js` | Envoi emails (Gmail OAuth / SMTP) |
| `mail/gdprMailService.js` | Emails RGPD automatiques |
| `emailTemplates.service.js` | Templates email MJML |
| `calendar.service.js` | Google Calendar (entretiens) |
| `deals.service.js` | Affaires commerciales |
| `candidatePipeline.service.js` | Pipeline de recrutement |
| `batchJobs.service.js` | Gestion des jobs backend persistés et de leurs items |
| `batchJobsWorker/` | Worker d'exécution batch (import, extraction, LLM, matching, adaptation, export) |
| `llmAvailability.service.js` | Disponibilité runtime/persistée des modèles selon entitlement et fallback |
| `llmModelCapabilities.service.js` | Registre central des capacités et limites par modèle |
| `llmPayloadCapabilities.service.js` | Construction/sanitation des payloads LLM par capacités |
| `profileMatching.service.js` | Matching mission/profils avec batch scoring LLM, retries par sous-batches et concurrence configurable |
| `backup.service.js` | Sauvegarde/restauration PostgreSQL |
| `backup-scheduler.service.js` | Planification sauvegardes automatiques |
| `industry.service.js` | Gestion des secteurs d'activité |
| `franceTravail.service.js` | API France Travail (offres, stats) |
| `adzuna.service.js` | API Adzuna (offres emploi) |
| `marketFacts.service.js` | Agrégation données marché |
| `marketTrends/` | Tendances salariales (collector, cache, API) |
| `escoService.js` | Classification ESCO compétences |
| `resumeVersions.service.js` | Historique des versions de CV |

### Middleware Chain

```javascript
// Ordre d'exécution des middlewares
app.use(helmet());           // 1. Headers sécurité
app.use(cors());             // 2. CORS
app.use(compression());      // 3. Compression gzip
app.use(cookieParser());     // 4. Parsing cookies
app.use(metricsMiddleware);  // 5. Tracking métriques
app.use(csrfProtection);     // 6. Protection CSRF
app.use(rateLimiter);        // 7. Rate limiting
app.use(authenticateToken);  // 8. Auth JWT (par route)
```

---

## Base de Données (PostgreSQL)

### Choix de PostgreSQL

PostgreSQL est utilisé comme base de données relationnelle :
- **Performance** : Requêtes optimisées avec indexes
- **Scalabilité** : Support de volumes de données importants
- **Intégrité** : Contraintes, transactions ACID, UUIDs
- **Sécurité** : Protection SQL injection via requêtes paramétrées

### Schéma Principal

#### Tables Principales

| Table | Contenu |
|-------|---------|
| `firms` | Cabinets/organisations, statut, logo |
| `users` | Utilisateurs, rôles, statuts, mots de passe hashés, 2FA (TOTP) |
| `resumes` | CV, analyses, scores, tags (JSON), consentement RGPD |
| `resume_versions` | Historique des versions de CV améliorés |
| `resume_comments` | Commentaires sur les CV (privés/publics) |
| `missions` | Offres d'emploi, descriptions, compétences requises |
| `resume_adaptations` | CV adaptés pour missions, score de matching |
| `templates` | Templates d'export PDF (HTML/CSS) |

#### Tables CRM

| Table | Contenu |
|-------|---------|
| `clients` | Clients/prospects (type, statut, secteur) |
| `client_contacts` | Contacts des clients (email, téléphone) |
| `resume_submissions` | Historique d'envoi de CV aux clients |
| `candidate_pipeline` | Pipeline de recrutement (stages) |
| `pipeline_history` | Historique des changements de stage |
| `pipeline_interviews` | Entretiens planifiés (Google Calendar) |

#### Tables Market Data

| Table | Contenu |
|-------|---------|
| `rome_metiers` | Référentiel ROME 4.0 des métiers IT |
| `market_facts` | Données marché (France Travail, Adzuna) |
| `market_trends` | Tendances salariales par région/métier |
| `industry_aliases` | Alias de secteurs d'activité |

#### Tables Configuration & Sécurité

| Table | Contenu |
|-------|---------|
| `llm_settings` | Configuration LLM, prompts, mode CV, DPO |
| `email_templates` | Templates email MJML par cabinet |
| `backup_settings` | Configuration sauvegarde FTP/SFTP |
| `backup_history` | Historique des sauvegardes |
| `token_blacklist` | Tokens JWT révoqués |
| `user_blacklist` | Utilisateurs bloqués |
| `user_mail_tokens` | Tokens OAuth Gmail/Outlook |
| `user_calendar_tokens` | Tokens OAuth Google Calendar |
| `firm_gdpr_mail_tokens` | Tokens email RGPD par cabinet |
| `global_gdpr_mail_token` | Token email RGPD global |
| `gdpr_audit_log` | Journal d'audit RGPD |
| `schema_migrations` | Suivi des migrations de schéma |

### Configuration PostgreSQL

```javascript
// src/config/database.js
import pg from 'pg';

const pool = new pg.Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  max: 20,                    // Connection pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});
```

### Helpers PostgreSQL

```javascript
// src/utils/postgresHelpers.js

// Requête avec timeout et retry automatique
export async function queryWithTimeout(sql, params, timeout = 30000);

// Select sécurisé avec whitelist de tables
export async function selectWithTimeout(table, options);

// Insert/Update/Delete avec validation
export async function insertRecord(table, data);
export async function updateRecord(table, id, data);
export async function deleteRecord(table, id);
```

### Triggers de Dénormalisation

```sql
-- Synchronisation automatique customer_name dans les tables liées
CREATE TRIGGER sync_customer_name_to_users
AFTER UPDATE OF name ON customers
FOR EACH ROW
EXECUTE FUNCTION sync_customer_name();
```

---

## Intégrations LLM

### Providers Supportés

| Provider | Modèles | Usage |
|----------|---------|-------|
| **OpenAI** | GPT-5.4 / GPT-5.4-pro / GPT-5.2 / GPT-5.1 / GPT-5, GPT-4.1, GPT-4o | Analyse, amélioration, adaptation |
| **Anthropic** | Claude Opus 4.x, Claude Sonnet 4, Claude 3.7, Claude 3.5 | Alternative à OpenAI |
| **DeepSeek** | DeepSeek-V3.2 via `deepseek-chat` et `deepseek-reasoner` | Alternative OpenAI-compatible avec deux modes d'appel : standard et raisonnement |
| **GLM (Z.AI)** | `glm-5.1`, `glm-5` | Alternative OpenAI-compatible via l'API Z.AI |
| **MiniMax** | MiniMax-M2.7, MiniMax-M2.5, MiniMax-M2.1, MiniMax-M2, M2-her, variantes `highspeed` conditionnelles | Alternative API-compatible pour analyse, amélioration, adaptation avec filtrage selon disponibilité de plan |
| **Ollama (distant)** | Modèles exposés par une instance Ollama externe | Exécution via une URL Ollama distante, sans moteur Ollama embarqué dans le conteneur |

### Gateway LLM Unifié

```javascript
// server/services/llmGateway.service.js
export async function callLLM(messages, options) {
  const settings = await getLLMSettings(); // Config depuis PostgreSQL
  const runtime = resolveLLMRuntimeConfig(settings);
  return providerHandlers[runtime.provider](messages, runtime.model, options);
}
```



### Compatibilité Modèles

Le service gère automatiquement les différences entre modèles :
- `max_tokens` vs `max_completion_tokens` (GPT-5+)
- support ou suppression de `temperature` / `top_p` selon les capacités du modèle
- suppression automatique de `response_format` quand un modèle ne le supporte pas (ex. famille MiniMax M2.x)
- clamp centralisé des plafonds de sortie connus par modèle/provider
- support OpenAI-compatible DeepSeek
- support OpenAI-compatible GLM (Z.AI)
- APIs compatibles OpenAI et Anthropic pour MiniMax
- connexion HTTP vers une instance Ollama distante configurée dans les paramètres
- cas Ollama sans `llmModel` obligatoire côté application lorsque le modèle est piloté par l'instance distante

La compatibilité de payload est pilotée par deux couches distinctes :
- `llmModelCapabilities.service.js` : capacités techniques d'un modèle/provider (tokens, paramètres supportés, plafonds, etc.)
- `llmPayloadCapabilities.service.js` : construction et sanitation du payload réellement envoyé à l'API upstream

La disponibilité métier d'un modèle est traitée séparément de ses capacités techniques :
- `llmAvailability.service.js` : disponibilité runtime selon la configuration de l'instance
- exemple actuel : les modèles MiniMax `*-highspeed` sont masqués et normalisés vers leur variante standard tant que `MINIMAX_ENABLE_HIGHSPEED_MODELS=true` n'est pas activé

### Services LLM

Les responsabilités sont maintenant séparées :
- `llmConfiguration.service.js` : résolution runtime provider / modèle
- `llmGateway.service.js` : gateway unique, agnostique du provider hors configuration
- `openaiChat.service.js`, `anthropic.service.js`, `deepseek.service.js`, `glm.service.js`, `minimax.service.js`, `ollama.service.js` : implémentations provider
- `llmContent.service.js` : normalisation/sanitation des sorties
- `llmProviderCommon.service.js` : règles communes de payloads/réponses compatibles

### Résilience et observabilité

- Retry et circuit breaker pour `openai`, `anthropic`, `deepseek`, `glm` et `minimax`
- Retry réseau léger pour `ollama` sur les appels data plane et control plane, sans circuit breaker
- L'indicateur `ollama` dans `/api/llm/circuit-breakers` reste volontairement `NOT_APPLICABLE` pour refléter ce choix d'architecture
- Indicateur d'état par famille via `/api/llm/circuit-breakers`
- Health checks profonds via `/api/health?deep=true`
- Métriques LLM normalisées et bornées pour éviter la cardinalité non contrôlée en mémoire

---

## Intégrations Externes

### France Travail API

| Endpoint | Usage |
|----------|-------|
| `/offres` | Récupération des offres d'emploi IT |
| `/stats` | Statistiques marché par région/métier |
| `/rome` | Référentiel ROME 4.0 des métiers |

### Adzuna API

| Endpoint | Usage |
|----------|-------|
| `/jobs` | Offres d'emploi complémentaires |
| `/salary` | Données salariales par région |

### ESCO (European Skills Classification)

- Classification européenne des compétences
- Mapping automatique des skills extraits des CV
- Normalisation des tags pour le matching

### Market Radar

```
┌─────────────────────────────────────────────────────────────┐
│                    Market Radar Flow                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Sélection région sur carte France (MapLibre)            │
│  2. Sélection métier (référentiel ROME 4.0)                 │
│  3. Appel APIs France Travail + Adzuna                      │
│  4. Agrégation données marché (offres, salaires, tension)   │
│  5. Affichage tendances et statistiques                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Génération PDF

```javascript
// pdf-server/server.cjs - Serveur dédié Puppeteer
const htmlPdf = require('html-pdf-node');

// Génération PDF depuis HTML avec templates personnalisables
app.post('/generate-pdf', async (req, res) => {
  const { html, options } = req.body;
  const pdfBuffer = await htmlPdf.generatePdf({ content: html }, options);
  res.send(pdfBuffer);
});
```

---

## Sécurité

### 🔐 Authentification JWT

```
┌─────────────────────────────────────────────────────────────┐
│                    JWT Authentication Flow                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Login → Credentials validation                          │
│  2. Generate Access Token (1h) + Refresh Token (7d)         │
│  3. Tokens stored in httpOnly cookies (not localStorage!)   │
│  4. Each request: Access Token verified                     │
│  5. Token expired? → Automatic refresh with Refresh Token   │
│  6. Logout → Tokens blacklisted                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Caractéristiques :**
- Algorithme HS256 explicite (prévention attaque algorithm confusion)
- Secrets séparés pour Access et Refresh tokens
- JTI unique pour chaque token (support blacklist)
- Vérification statut utilisateur dans le token

### 🛡️ Protection CSRF (Double Submit Cookie)

```javascript
// Configuration CSRF
const csrfProtection = doubleCsrf({
  cookieName: 'x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'strict',
    secure: true // Production only
  },
  getTokenFromRequest: (req) => req.headers['x-csrf-token']
});
```

**Mécanisme :**
1. Token CSRF généré côté serveur
2. Stocké dans cookie httpOnly + envoyé au client
3. Client renvoie le token dans header `x-csrf-token`
4. Serveur compare cookie et header

**Retry automatique :**
```typescript
// Frontend: apiInterceptor.ts
export const fetchWithCsrfRetry = async (url, options) => {
  let response = await fetchWithAuth(url, options);
  
  // Si erreur CSRF, refresh token et retry
  if (response.status === 403 && errorData.error.includes('csrf')) {
    const newToken = await refreshCsrfToken();
    response = await fetchWithAuth(url, { ...options, headers: { 'x-csrf-token': newToken }});
  }
  
  return response;
};
```

### 🚦 Rate Limiting Multi-Niveaux

| Type | Limite | Fenêtre | Cible |
|------|--------|---------|-------|
| **Global** | 1000 req | 15 min | Par IP |
| **Auth** | 20 req | 15 min | Tentatives login |
| **User** | 50 req | 15 min | Par utilisateur authentifié |
| **Upload** | 50 req | 15 min | Upload fichiers |
| **LLM** | 100 req | 1 heure | Appels IA |
| **Combined** | 30 req | 1 min | IP + User (anti-bypass) |

### 🔒 Content Security Policy (CSP)

**Score Mozilla HTTP Observatory : A+** ✅

L'application implémente une CSP stricte avec `default-src 'none'`, ce qui garantit que toutes les ressources doivent être explicitement autorisées.

```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],                    // Strict: tout bloqué par défaut
      scriptSrc: ["'self'", "https://basemaps.cartocdn.com", "https://*.basemaps.cartocdn.com"],
      scriptSrcAttr: ["'none'"],                 // Bloque les event handlers inline
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com", "https://basemaps.cartocdn.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "blob:", "https://api.openai.com", "https://api.anthropic.com", "https://basemaps.cartocdn.com"],
      workerSrc: ["'self'", "blob:"],
      childSrc: ["'self'", "blob:"],
      frameSrc: ["'self'"],
      frameAncestors: ["'self'"],                // Protection clickjacking
      objectSrc: ["'none'"],                     // Bloque Flash, Java, etc.
      mediaSrc: ["'self'"],
      manifestSrc: ["'self'"],
      baseUri: ["'self'"],                       // Prévient base tag hijacking
      formAction: ["'self'"],
      upgradeInsecureRequests: []                // Force HTTPS
    }
  }
}));
```

#### Directives de sécurité

| Directive | Valeur | Sécurité |
|-----------|--------|----------|
| `default-src` | `'none'` | ✅ Strict - tout bloqué par défaut |
| `script-src` | `'self'` | ✅ Pas de `'unsafe-inline'` ni `'unsafe-eval'` |
| `script-src-attr` | `'none'` | ✅ Bloque les event handlers inline |
| `style-src` | `'self' 'unsafe-inline'` | ⚠️ Requis par Tiptap/ProseMirror (voir note) |
| `object-src` | `'none'` | ✅ Bloque plugins dangereux |
| `frame-ancestors` | `'self'` | ✅ Protection clickjacking |
| `base-uri` | `'self'` | ✅ Prévient base tag hijacking |

#### Extraction PDF côté serveur

Pour éliminer `'unsafe-eval'` de la CSP, l'extraction de texte PDF a été migrée du client vers le serveur :

```
Client (avant)                    Serveur (après)
┌─────────────────┐              ┌─────────────────┐
│  pdfjs-dist     │    ──►       │  pdfjs-dist     │
│  (unsafe-eval)  │              │  /legacy        │
│  Tesseract.js   │              │  Tesseract.js   │
│  (OCR client)   │              │  (OCR serveur)  │
└─────────────────┘              └─────────────────┘
```

**Endpoint** : `POST /api/resumes/extract-pdf`
- Extraction texte via `pdfjs-dist/legacy`
- OCR automatique pour PDFs scannés (Tesseract.js)
- Support français + anglais

#### Note sur `'unsafe-inline'` dans `style-src`

Tiptap/ProseMirror nécessite `'unsafe-inline'` dans `style-src` pour le formatage inline (gras, couleurs, alignement, etc.) car l'éditeur applique des styles directement sur les éléments DOM.

**Mitigations :**
- Sanitization côté client avec DOMPurify
- Sanitization côté serveur avec sanitize-html
- Validation stricte des entrées utilisateur

### 🧹 Sanitization

**Backend :**
```javascript
// src/utils/sanitizer.backend.js
import sanitizeHtml from 'sanitize-html';

export function sanitizeInput(input) {
  return sanitizeHtml(input, {
    allowedTags: [], // Strip all HTML
    allowedAttributes: {}
  });
}
```

**Frontend :**
```typescript
// src/utils/sanitizer.frontend.ts
import DOMPurify from 'dompurify';

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}
```

### 📝 Token Blacklist

```javascript
// Révocation immédiate des tokens
export function blacklistToken(tokenId, expiresAt, reason, userId) {
  blacklistedTokens.set(tokenId, { expiresAt, reason, userId, blacklistedAt: Date.now() });
}

// Blacklist tous les tokens d'un utilisateur (désactivation compte)
export function blacklistUser(userId, reason) {
  blacklistedUsers.set(userId, { blacklistedAt: Date.now(), reason });
}
```

### 📊 Security Logging

```javascript
// Événements de sécurité loggés
SECURITY_EVENTS = {
  AUTH_SUCCESS, AUTH_FAILURE, AUTH_BLOCKED,
  RATE_LIMIT_HIT, INVALID_TOKEN, TOKEN_EXPIRED,
  SUSPICIOUS_ACTIVITY, FILE_UPLOAD_REJECTED
};

// Persistance fichier avec rotation (10MB max, 5 fichiers)
```

---

## Monitoring & APM

### 📊 APM Interne

L'application intègre un middleware APM (`apm.middleware.js`) pour le suivi des performances :

```javascript
// Configuration APM
const APM_CONFIG = {
    slowRequestThreshold: 1000,      // 1s = requête lente
    verySlowRequestThreshold: 5000,  // 5s = très lente
    criticalRequestThreshold: 30000, // 30s = critique
    traceSamplingRate: 1.0,          // 100% des requêtes tracées
    maxSlowRequests: 100             // Buffer circulaire
};
```

**Fonctionnalités :**
- Détection automatique des requêtes lentes
- Classification par sévérité (slow, very_slow, critical)
- Breakdown timing détaillé avec `req.apmMark()`
- Normalisation des endpoints pour agrégation
- Buffer circulaire des 100 dernières requêtes lentes
- Statistiques par endpoint (count, avg, max)

**API :**
- `GET /api/metrics/apm` - Statistiques APM
- `GET /api/metrics/apm/slow-requests` - Liste des requêtes lentes
- `DELETE /api/metrics/apm/slow-requests` - Vider le buffer
### 📈 Métriques Système

| Métrique | Description |
|----------|-------------|
| **Mémoire** | Heap used/total, RSS, external |
| **Requêtes** | Count par endpoint, temps moyen |
| **LLM** | Tokens consommés, coûts estimés |
| **Profile Matching** | Recherches lancées, profils demandés/scorés, batches démarrés/retriés/en échec |
| **Cache** | Hit/miss ratio, taille |
| **Rate Limit** | Hits par type de limite |

### Configuration du profile matching

- `PROFILE_MATCHING_LLM_MAX_CONCURRENCY`
  - `0` : concurrence par défaut selon le provider
  - `1..100` : plafond global des appels batch LLM simultanés
- `PROFILE_MATCHING_LLM_BATCH_SIZE`
  - `0` : taille de batch par défaut selon le provider
  - `1..100` : taille de batch forcée pour le scoring de profils
- Valeurs par défaut actuellement utilisées :
  - MiniMax : batch `6`, concurrence `3`
  - DeepSeek : batch `4`, concurrence `2` pour `deepseek-reasoner`
  - autres providers : batch `12`, concurrence `5`

### 🔮 Améliorations Futures (APM Externe)

Pour une mise en production à grande échelle, un APM externe apporterait :

| Fonctionnalité | APM Interne | APM Externe (Datadog, New Relic) |
|----------------|-------------|----------------------------------|
| Requêtes lentes | ✅ | ✅ |
| Tracing distribué | ❌ | ✅ |
| Alerting avancé | ❌ | ✅ |
| Dashboards historiques | ❌ | ✅ |
| Corrélation logs/traces | ❌ | ✅ |
| Profiling code | ❌ | ✅ |

---

## Optimisations

### Cache applicatif

```javascript
// server/services/cache.service.js
await cache.get(key);
await cache.set(key, value);
await cache.invalidate(key);

// Backends disponibles:
// - memory (défaut)
// - redis   (si CACHE_BACKEND=redis)
```

Variables d'environnement:
- `CACHE_BACKEND=memory|redis`
- `CACHE_REDIS_URL=redis://127.0.0.1:6379`
- `CACHE_KEY_PREFIX=resumeconverter`

Caches déjà migrés:
- `settings`
- `templates`
- `firms`
- état de disponibilité runtime LLM

Diagnostic runtime:
- `/health` expose `checks.cache.backend`
- `/health` expose `checks.cache.connected`
- `/health` expose `checks.cache.fallbackReason`
- `/api/admin/cache-stats` remonte aussi ce diagnostic de manière consolidée

Déploiement Docker:
- mode historique: Redis embarqué dans le conteneur principal
- mode recommandé pour préparer le multi-instance: `docker-compose.redis.yml` avec Redis séparé

### 📦 Compression

```javascript
// Backend: compression middleware Express
app.use(compression()); // Gzip automatique des réponses API

// Frontend Dev: compression middleware Vite
server.middlewares.use((req, res, next) => {
  // Brotli ou Gzip selon Accept-Encoding
  const useBrotli = acceptEncoding.includes('br');
  const compressed = useBrotli ? zlib.brotliCompressSync(body) : zlib.gzipSync(body);
  res.setHeader('Content-Encoding', useBrotli ? 'br' : 'gzip');
});

// Frontend Prod: fichiers pré-compressés (.br, .gz) servis par Express
app.use((req, res, next) => {
  // Sert automatiquement les fichiers .br ou .gz si disponibles
  if (acceptEncoding.includes('br') && fs.existsSync(filePath + '.br')) {
    res.set('Content-Encoding', 'br');
    req.url = req.url + '.br';
  }
});
```

### 🗂️ Cache Assets Statiques

```javascript
// Cache agressif pour assets hashés (1 an, immutable)
app.use(express.static(distPath, {
  setHeaders: (res, filePath) => {
    if (filePath.match(/\.[a-f0-9]{8,}\.(js|css|woff2?)$/i)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));
```

### 🔄 Connection Pooling (Axios)

```javascript
// src/config/axios.js
export const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });
export const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });
```

### 📄 Lazy Loading

```javascript
// Chargement différé des librairies lourdes via React.lazy() et dynamic imports
// Les libs PDF (pdfjs-dist) et OCR (Tesseract) sont extraites côté serveur uniquement
// Les composants lourds (TiptapEditor, MapLibre, Three.js) sont lazy-loaded via React.lazy()
```

### 🧹 Cleanup Automatique

- **Rate Limit Stores** : Nettoyage toutes les heures
- **Token Blacklist** : Suppression tokens expirés
- **Cache** : Éviction entrées expirées + limite taille
- **Fichiers temporaires** : Nettoyage multi-répertoires (voir section dédiée)

---

## Gestion des Fichiers Temporaires

### Architecture de Nettoyage

Le système gère automatiquement les fichiers temporaires générés côté serveur pour éviter l'accumulation sur le disque.

```
┌─────────────────────────────────────────────────────────────────────┐
│                      FileCleanupManager                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │    uploads/      │  │  batch-exports/  │  │     shared/      │   │
│  │    TTL: 1h       │  │    TTL: 24h      │  │    TTL: 30j      │   │
│  │  Fichiers upload │  │  ZIPs d'export   │  │  PDFs partagés   │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘   │
│  ┌──────────────────┐                                               │
│  │   server/temp/   │                                               │
│  │    TTL: 1h       │                                               │
│  │ Fichiers backup  │                                               │
│  └──────────────────┘                                               │
└─────────────────────────────────────────────────────────────────────┘
```

### Répertoires Gérés

| Répertoire | TTL | Contenu | Nettoyage |
|------------|-----|---------|-----------|
| `./uploads/` | 1 heure | Fichiers uploadés (CVs) | Périodique |
| `os.tmpdir()/batch-exports/` | 24 heures | ZIPs d'export batch | Périodique + après téléchargement |
| `./uploads/shared/` | 30 jours | PDFs partagés publiquement | Périodique |
| `./server/temp/` | 1 heure | Fichiers temporaires backup | Périodique |
| `./uploads/logos/` | ∞ | Logos des firms | Persistants (non nettoyés) |

### Mécanismes de Nettoyage

```javascript
// server/utils/fileCleanup.js

// Configuration des répertoires avec TTL
const CLEANUP_DIRS = {
    uploads: { path: UPLOAD_DIR, maxAgeMs: 60 * 60 * 1000 },        // 1h
    batchExports: { path: BATCH_EXPORTS_DIR, maxAgeMs: 24 * 60 * 60 * 1000 }, // 24h
    serverTemp: { path: TEMP_DIR, maxAgeMs: 60 * 60 * 1000 },       // 1h
    sharedPdfs: { path: SHARED_DIR, maxAgeMs: 30 * 24 * 60 * 60 * 1000 }  // 30j
};

// Nettoyage périodique (toutes les heures)
startPeriodicCleanup(60 * 60 * 1000);
```

### Suppression Après Téléchargement

Les fichiers ZIP d'export batch sont automatiquement supprimés après téléchargement :

```javascript
// server/routes/batchJobs.routes.js
res.on('finish', () => {
    fs.unlink(job.export_file_path, (err) => {
        if (!err) safeLog('debug', 'Export file deleted after download');
    });
});
```

### Endpoint de Monitoring (Admin)

```
GET /api/health/storage
Authorization: Bearer <admin_token>

Response:
{
  "summary": {
    "totalFiles": 12,
    "totalSizeMB": 45.2,
    "cleanupTimerActive": true,
    "lastCleanupTime": "2026-03-12T03:00:00.000Z",
    "totalFilesDeleted": 156
  },
  "directories": {
    "uploads": { "fileCount": 5, "totalSizeMB": 2.1, "maxAgeHours": 1 },
    "batchExports": { "fileCount": 2, "totalSizeMB": 35.8, "maxAgeHours": 24 },
    "sharedPdfs": { "fileCount": 5, "totalSizeMB": 7.3, "maxAgeHours": 720 }
  }
}
```

### Fonctions Exportées

| Fonction | Description |
|----------|-------------|
| `startPeriodicCleanup(intervalMs)` | Démarre le nettoyage périodique |
| `stopPeriodicCleanup()` | Arrête le timer de nettoyage |
| `cleanupOldFiles(dir, maxAgeMs)` | Nettoie un répertoire spécifique |
| `getStorageStats()` | Retourne les statistiques d'espace disque |
| `getFileCleanupStats()` | Retourne les statistiques de nettoyage |

---

## Internationalisation (i18n)

### Configuration

```javascript
// client/src/i18n/index.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: enTranslations }, fr: { translation: frTranslations } },
    fallbackLng: 'en',
    initImmediate: false, // Synchronous initialization
  });
```

### Langues Supportées

| Langue | Fichier | Clés |
|--------|---------|------|
| **Français** | `locales/fr.json` | ~1000 clés |
| **Anglais** | `locales/en.json` | ~1000 clés |

### Structure des Traductions

```json
{
  "common": { "save": "Enregistrer", "cancel": "Annuler" },
  "resumes": { "title": "CVthèque", "filters": { "skills": "Compétences" } },
  "resume": { "analysis": { "categories": { "technicalskills": "Compétences techniques" } } },
  "navigation": { "home": "Accueil", "resumes": "CVthèque" },
  "processing": { "steps": { "upload": { "title": "...", "steps": ["..."] } } }
}
```

### Utilisation

```typescript
// Dans les composants React
import { useTranslation } from 'react-i18next';

const Component = () => {
  const { t } = useTranslation();
  return <h1>{t('resumes.title')}</h1>;
};
```

### Audit des Traductions

```bash
# Script d'audit pour détecter les clés manquantes/inutilisées
node scripts/audit-translations.js
node scripts/audit-translations.js --fix  # Ajoute les clés manquantes
```

---

## Qualité du Code

### TypeScript

- Frontend majoritairement en TypeScript
- Types stricts pour les interfaces API
- Validation avec Zod

```typescript
// src/utils/validation.ts
import { z } from 'zod';

export const resumeSchema = z.object({
  name: z.string().min(1).max(255),
  content: z.string().max(50000),
  // ...
});
```

### Tests

```bash
npm run test        # Vitest 4 (892 tests, 45 fichiers)
npm run test:watch  # Mode watch
npm run test:coverage # Couverture v8
```

### Linting

```bash
npm run lint        # ESLint
npm run typecheck   # TypeScript check
```

### Logging Structuré

```javascript
// Backend: Winston avec rotation
import winston from 'winston';
import 'winston-daily-rotate-file';

// Frontend: Logger conditionnel (dev only)
const logger = {
  log: (...args) => isDev && console.log('[App]', ...args),
  error: (...args) => console.error('[App Error]', ...args)
};
```

### Documentation API

- **Swagger/OpenAPI** : Documentation interactive à `/api/docs/ui`
- **Schémas** : Tous les endpoints documentés

---

## ✅ Points Forts

### Architecture

| Point Fort | Description |
|------------|-------------|
| **Séparation claire** | Frontend/Backend bien découplés via API REST |
| **Proxy sécurisé** | Clés API jamais exposées côté client |
| **TypeScript** | Typage fort réduisant les bugs runtime |
| **Modularité** | Services, routes, composants bien organisés |

### Sécurité

| Point Fort | Description |
|------------|-------------|
| **Defense in Depth** | Multiples couches de sécurité (JWT, CSRF, Rate Limit, CSP) |
| **Tokens httpOnly** | Protection XSS des tokens d'authentification |
| **Blacklist tokens** | Révocation immédiate possible |
| **2FA TOTP** | Authentification à deux facteurs avec codes temporels (speakeasy) |
| **Sanitization** | Double sanitization (frontend + backend) |
| **Logging sécurité** | Traçabilité des événements critiques |

### Expérience Développeur

| Point Fort | Description |
|------------|-------------|
| **Hot Reload** | Vite pour développement rapide |
| **Proxy dev** | Configuration proxy intégrée |
| **i18n** | Internationalisation FR/EN complète |
| **Documentation** | Guide utilisateur, changelog, architecture |

### Fonctionnalités

| Point Fort | Description |
|------------|-------------|
| **Multi-LLM** | Support OpenAI et Anthropic interchangeables |
| **Chatbot IA** | Assistant contextuel avec guide utilisateur |
| **Export multi-format** | Word, PDF avec templates personnalisables |
| **Métriques** | Dashboard de monitoring intégré |

---

## ⚠️ Points Faibles et Axes d'Amélioration

### Architecture

| Point Faible | Impact | Amélioration Suggérée |
|--------------|--------|----------------------|
| **Cache en mémoire** | Perdu au redémarrage, non partagé multi-instances | Redis pour cache distribué |
| **Token blacklist en mémoire** | Idem | Redis ou table DB pour persistance |
| **Monolithe** | Tout dans un seul serveur | Microservices si besoin de scaling indépendant |

### Sécurité

| Point Faible | Impact | Amélioration Suggérée |
|--------------|--------|----------------------|
| **CSP permissive** | `unsafe-inline` dans style-src pour Tiptap | Évaluer nonce-based CSP pour les styles inline |
| **Secrets en .env** | Gestion manuelle | Vault (HashiCorp) ou AWS Secrets Manager |

### Performance

| Point Faible | Impact | Amélioration Suggérée |
|--------------|--------|----------------------|
| **Bundle size** | ~2.5MB JS (gzip ~665KB) | Code splitting plus agressif, lazy loading |
| **Pas de CDN** | Assets servis par le serveur | CloudFront/Cloudflare pour assets statiques |
| **Pas de SSR** | SEO limité (SPA) | Next.js si SEO critique |

### Qualité

| Point Faible | Impact | Amélioration Suggérée |
|--------------|--------|----------------------|
| **Couverture tests** | Tests limités | Augmenter couverture (unit + integration + e2e) |
| **Pas de CI/CD documenté** | Déploiement manuel | GitHub Actions / GitLab CI |
| **APM interne uniquement** | Pas de tracing distribué | APM externe (Datadog, New Relic) pour tracing cross-service, alerting avancé, dashboards historiques |

### Fonctionnel

| Point Faible | Impact | Amélioration Suggérée |
|--------------|--------|----------------------|
| **Pas de mode offline** | Dépendance réseau | Service Worker + IndexedDB |
| **Pas de notifications push** | UX limitée | Web Push API |
| **Export PDF basique** | Qualité variable | Puppeteer headless pour rendu fidèle |

---

## Déploiement Docker

### Architecture du Conteneur

L'application peut être déployée via un conteneur Docker tout-en-un qui inclut tous les composants nécessaires :

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Conteneur Docker                                │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                     Supervisor                               │    │
│  │  ┌──────────────────┐  ┌──────────────────┐                 │    │
│  │  │   Proxy Server   │  │    PDF Server    │                 │    │
│  │  │   (Express.js)   │  │   (Puppeteer)    │                 │    │
│  │  │   Port: 3443     │  │   Port: 3002     │                 │    │
│  │  └──────────────────┘  └──────────────────┘                 │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                   PostgreSQL 18                              │    │
│  │                   Port: 5432 (interne)                       │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
└─────────────────────────────┼───────────────────────────────────────┘
                              │
              ┌───────────────▼───────────────┐
              │     Volume Docker             │
              │   resumeconverter-pgdata      │
              │   (données persistantes)      │
              └───────────────────────────────┘
```

### Composants Docker

| Fichier | Rôle |
|---------|------|
| `Dockerfile` | Image Ubuntu 22.04 avec Node.js 20, PostgreSQL 18, Google Chrome |
| `docker/entrypoint.sh` | Script de démarrage avec init DB et migrations automatiques |
| `docker/supervisord.conf` | Gestionnaire de processus (proxy + PDF servers) |
| `docker/init-db.sql` | Schéma complet de la base de données |
| `docker/migrations/` | Scripts de migration incrémentaux |

### Persistance des Données

Les données sont stockées dans des **répertoires locaux** (pas des volumes Docker) pour une meilleure portabilité :

| Chemin local | Chemin conteneur | Description |
|--------------|------------------|-------------|
| `./data/postgresql` | `/var/lib/postgresql/18/main` | Base de données PostgreSQL |
| `./uploads` | `/app/uploads` | Fichiers CV uploadés |
| `./logs` | `/app/logs` | Logs applicatifs |

✅ Les données survivent aux rebuilds d'image et aux suppressions de conteneur.

### Système de Migrations

Le conteneur gère automatiquement les migrations de base de données :

1. **Premier lancement** : Exécute `init-db.sql` complet, marque toutes les migrations comme appliquées
2. **Lancements suivants** : Vérifie la table `schema_migrations`, applique uniquement les nouvelles migrations
3. **Mise à jour d'image** : Applique automatiquement les migrations manquantes

```sql
-- Table de suivi des migrations
CREATE TABLE schema_migrations (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

### Variables d'Environnement Docker

| Variable | Requis | Description |
|----------|--------|-------------|
| `JWT_SECRET` | ✅ | Secret JWT (min 32 caractères) |
| `JWT_REFRESH_SECRET` | ✅ | Secret refresh token |
| `REFRESH_TOKEN_SECRET` | ✅ | Secret token additionnel |
| `CSRF_SECRET` | ✅ | Secret CSRF |
| `OPENAI_API_KEY` | Optionnel | Clé API OpenAI |
| `ANTHROPIC_API_KEY` | Optionnel | Clé API Anthropic |
| `ANTHROPIC_MODEL` | Optionnel | Modèle Anthropic par défaut |
| `DEEPSEEK_API_KEY` | Optionnel | Clé API DeepSeek |
| `DEEPSEEK_BASE_URL` | Optionnel | URL base DeepSeek |
| `GLM_API_KEY` | Optionnel | Clé API GLM / Z.AI |
| `GLM_BASE_URL` | Optionnel | URL base OpenAI-compatible GLM (`https://api.z.ai/api/paas/v4`) |
| `MINIMAX_API_KEY` | Optionnel | Clé API MiniMax |
| `MINIMAX_OPENAI_BASE_URL` | Optionnel | URL base OpenAI-compatible MiniMax |
| `MINIMAX_ANTHROPIC_BASE_URL` | Optionnel | URL base Anthropic-compatible MiniMax |
| `MINIMAX_ENABLE_HIGHSPEED_MODELS` | Optionnel | Active l'exposition et l'utilisation des modèles MiniMax `highspeed` sur les instances disposant du plan adapté |
| `OLLAMA_BASE_URL` | Optionnel | URL de l'instance Ollama distante |
| `OLLAMA_AUTO_PULL` | Optionnel | Auto-pull du modèle Ollama si nécessaire |
| `OLLAMA_REQUEST_TIMEOUT_MS` | Optionnel | Timeout global des appels Ollama |
| `GOOGLE_CLIENT_ID` | Optionnel | Client ID Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Optionnel | Secret Google OAuth |
| `MAIL_TOKEN_ENCRYPTION_KEY` | Optionnel | Clé de chiffrement tokens mail |

### Identifiants PostgreSQL Docker

| Variable | Valeur |
|----------|--------|
| `POSTGRES_HOST` | `127.0.0.1` (interne) |
| `POSTGRES_PORT` | `5432` (interne) / `5433` (externe) |
| `POSTGRES_DB` | `resumeconverter` |
| `POSTGRES_USER` | `resumeconverter` |
| `POSTGRES_PASSWORD` | Voir `Dockerfile` |

### Commandes Docker

#### Windows - Scripts .bat (simples)

| Script | Description |
|--------|-------------|
| `docker-build.bat` | Construire l'image Docker |
| `docker-run.bat` | Démarrer le conteneur |
| `docker-stop.bat` | Arrêter et supprimer le conteneur |
| `docker-logs.bat` | Voir les logs en temps réel |
| `docker-shell.bat` | Ouvrir un shell dans le conteneur |

#### Linux/Mac

```bash
# Construction
./docker/docker-build.sh build

# Lancement
./docker/docker-build.sh run

# Logs
./docker/docker-build.sh logs

# Shell
./docker/docker-build.sh shell

# Arrêt
./docker/docker-build.sh stop
```

---

## Sauvegardes et Planification

### Architecture des Sauvegardes

L'application intègre un système complet de sauvegarde automatique de la base de données avec support FTP/SFTP et stockage local.

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Backup Scheduler Service                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              setInterval (toutes les 30 secondes)             │   │
│  │                                                               │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │   │
│  │  │   Daily     │  │   Weekly    │  │   Monthly   │          │   │
│  │  │  Backup     │  │   Backup    │  │   Backup    │          │   │
│  │  │  (HH:MM)    │  │ (Jour+HH:MM)│  │(Jour+HH:MM) │          │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │   │
│  └─────────┼────────────────┼────────────────┼──────────────────┘   │
│            │                │                │                       │
│            ▼                ▼                ▼                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                     Backup Service                            │   │
│  │  1. pg_dump → SQL                                            │   │
│  │  2. gzip compression                                         │   │
│  │  3. Upload FTP/SFTP ou stockage local                        │   │
│  │  4. Cleanup anciens backups (rétention configurable)         │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Planification des Sauvegardes

Le scheduler utilise `setInterval` avec vérification toutes les 30 secondes pour déclencher les sauvegardes à l'heure configurée (timezone Europe/Paris).

| Type | Fréquence | Configuration |
|------|-----------|---------------|
| **Daily** | Tous les jours | Heure (HH:MM) |
| **Weekly** | Une fois par semaine | Jour de la semaine + Heure |
| **Monthly** | Une fois par mois | Jour du mois + Heure |

**Mécanisme de déclenchement :**
```javascript
// server/services/backup-scheduler.service.js
function checkAndExecuteBackups() {
    const { hours, minutes, dayOfWeek, dayOfMonth } = getParisTime();
    
    // Daily: vérifie heure + évite double exécution le même jour
    if (settings.daily_enabled && timeMatches(settings.daily_time, hours, minutes)) {
        if (lastExecuted.daily !== todayKey) {
            lastExecuted.daily = todayKey;
            executeBackup('daily');
        }
    }
    // Weekly: vérifie jour de semaine + heure
    // Monthly: vérifie jour du mois + heure
}
```

### Cibles de Sauvegarde

| Cible | Protocole | Configuration |
|-------|-----------|---------------|
| **FTP** | FTP avec TLS explicite | Host, port, user, password |
| **FTPS** | FTP over TLS | Host, port, user, password, tls_mode |
| **SFTP** | SSH File Transfer | Host, port, user, password |
| **Local** | Système de fichiers | Répertoire `/app/server/backups` |

### Politique de Rétention

Chaque type de sauvegarde a sa propre politique de rétention configurable :

| Type | Rétention par défaut | Description |
|------|---------------------|-------------|
| **Daily** | 7 jours | Conserve les 7 dernières sauvegardes quotidiennes |
| **Weekly** | 4 semaines | Conserve les 4 dernières sauvegardes hebdomadaires |
| **Monthly** | 12 mois | Conserve les 12 dernières sauvegardes mensuelles |
| **Manual** | 30 jours | Sauvegardes manuelles déclenchées via l'interface |

Le nettoyage s'applique automatiquement après chaque sauvegarde, tant sur le serveur distant (FTP/SFTP) que localement.

### Format des Fichiers de Sauvegarde

```
backup-{type}-resumeconverter-{timestamp}.sql.gz

Exemples:
- backup-daily-resumeconverter-2026-03-12T07-30-29.sql.gz
- backup-weekly-resumeconverter-2026-03-10T03-00-00.sql.gz
- backup-monthly-resumeconverter-2026-03-01T04-00-00.sql.gz
- backup-manual-resumeconverter-2026-03-12T14-25-00.sql.gz
```

### Historique des Sauvegardes

Chaque sauvegarde est enregistrée dans la table `backup_history` :

```sql
CREATE TABLE backup_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) NOT NULL,           -- daily, weekly, monthly, manual
    filename VARCHAR(255) NOT NULL,
    file_size BIGINT,
    status VARCHAR(20) NOT NULL,         -- running, success, failed
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    uploaded BOOLEAN DEFAULT FALSE
);
```

### Configuration via Interface

L'écran de configuration des sauvegardes (`/dashboard/backup`) permet de :

- **Configurer la cible** : Local, FTP, FTPS ou SFTP
- **Tester la connexion** : Vérification avant sauvegarde
- **Planifier les sauvegardes** : Daily, Weekly, Monthly avec horaires
- **Définir la rétention** : Nombre de sauvegardes à conserver par type
- **Déclencher manuellement** : Sauvegarde immédiate
- **Consulter l'historique** : Liste des sauvegardes avec statut
- **Restaurer** : Téléchargement et restauration d'une sauvegarde

### Gestion des Erreurs

Le système garantit qu'aucune erreur ne passe silencieusement :

```javascript
// Logging détaillé en cas d'erreur
safeLog('error', 'BACKUP FAILED - Scheduled daily backup failed', {
    type,
    error: error.message,
    stack: error.stack,
    code: error.code,
    durationSeconds: duration
});
console.error(`[BackupScheduler] BACKUP FAILED: ${type} - ${error.message}`);
```

| Niveau | Événement | Action |
|--------|-----------|--------|
| **INFO** | Démarrage backup | Log avec timestamp et type |
| **INFO** | Backup réussi | Log avec filename, taille, durée |
| **ERROR** | Connexion FTP échouée | Log avec host, port, code erreur |
| **ERROR** | Upload échoué | Log + conservation locale du fichier |
| **ERROR** | Backup échoué | Log complet avec stack trace |

### Services et Fichiers

| Fichier | Rôle |
|---------|------|
| `backup-scheduler.service.js` | Planification avec setInterval |
| `backup.service.js` | Création, upload, restauration, nettoyage |
| `backup.routes.js` | API REST pour configuration et actions |

### API Backup

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/backup/settings` | GET | Récupérer la configuration |
| `/api/backup/settings` | PUT | Mettre à jour la configuration |
| `/api/backup/test-connection` | POST | Tester la connexion FTP/SFTP |
| `/api/backup/create` | POST | Déclencher une sauvegarde manuelle |
| `/api/backup/history` | GET | Historique des sauvegardes |
| `/api/backup/restore/:filename` | POST | Restaurer une sauvegarde |
| `/api/backup/download/:filename` | GET | Télécharger une sauvegarde |

---

## Conclusion

ResumeConverter est une application **bien architecturée** avec une attention particulière portée à la **sécurité** (authentification JWT robuste, protection CSRF, rate limiting multi-niveaux, protection SQL injection). L'utilisation de **PostgreSQL** comme base de données offre performance, scalabilité et intégrité des données.

Pour une mise en production à grande échelle, les priorités seraient :
1. Cache distribué (Redis)
2. CDN pour les assets
3. Monitoring APM
4. CI/CD automatisé
5. Réplication PostgreSQL pour haute disponibilité

L'architecture actuelle est **adaptée pour un usage PME/ESN** et peut supporter des volumes importants grâce à PostgreSQL.

---

*Document mis à jour le 17 mars 2026*
*Version: 1.8.6*

### Changelog technique récent

| Package | Avant | Après | Notes |
|---------|-------|-------|-------|
| Vite | 5.x | 8.0 | Rolldown remplace Rollup/esbuild, OXC pour minification |
| @vitejs/plugin-react | 4.x | 6.0 | |
| TailwindCSS | 3.x | 4.2 | CSS-first config (@theme, @plugin, @variant), suppression tailwind.config.js et postcss.config.js, nouveau plugin @tailwindcss/vite |
| React Router | 6.x | 7.13 | Suppression des future flags v7 |
| Vitest | 2.x | 4.1 | |
| @vitest/coverage-v8 | 2.x | 4.1 | |
| pdfjs-dist | 4.x | 5.5 | |
| multer | 1.x | 2.1 | |
| jsdom | 28.x | 29.0 | |
| three | 0.182 | 0.183 | |
| dotenv | 16.x | 17.3 | |
| autoprefixer | 10.x | — | Supprimé (intégré dans TailwindCSS 4) |
| @rollup/plugin-commonjs | 28.x | — | Supprimé (Rolldown gère CJS nativement) |
