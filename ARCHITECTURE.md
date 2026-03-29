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


## ðŸ“‹ Table des MatiÃ¨res

1. [Vue d'Ensemble](#vue-densemble)
2. [Architecture Globale](#architecture-globale)
3. [Frontend (React 19/TypeScript)](#frontend-react-19--typescript)
4. [Backend (Node.js/Express)](#backend-nodejsexpress)
5. [Base de DonnÃ©es (PostgreSQL)](#base-de-donnÃ©es-postgresql)
6. [IntÃ©grations LLM](#intÃ©grations-llm)
7. [IntÃ©grations Externes](#intÃ©grations-externes)
8. [SÃ©curitÃ©](#sÃ©curitÃ©)
9. [Optimisations](#optimisations)
10. [Gestion des Fichiers Temporaires](#gestion-des-fichiers-temporaires)
11. [Internationalisation (i18n)](#internationalisation-i18n)
12. [QualitÃ© du Code](#qualitÃ©-du-code)
13. [Points Forts](#-points-forts)
14. [Points Faibles et Axes d'AmÃ©lioration](#-points-faibles-et-axes-damÃ©lioration)
15. [DÃ©ploiement Docker](#dÃ©ploiement-docker)
16. [Sauvegardes et Planification](#sauvegardes-et-planification)

---

## Vue d'Ensemble

**ResumeConverter** est une application web full-stack de gestion et d'optimisation de CV assistÃ©e par intelligence artificielle. Elle permet aux entreprises (ESN) de gÃ©rer une CVthÃ¨que, d'analyser et amÃ©liorer les CV, et de les adapter Ã  des missions spÃ©cifiques.

### Stack Technique

| Couche | Technologies |
|--------|-------------|
| **Frontend** | React 19, TypeScript, Vite 8 (Rolldown), TailwindCSS 4, Framer Motion |
| **Backend** | Node.js, Express.js |
| **Base de donnÃ©es** | PostgreSQL 18 avec pg (node-postgres) |
| **IA/LLM** | OpenAI (GPT-4/5), Anthropic (Claude), DeepSeek, GLM, MiniMax, Ollama distant |
| **APIs Externes** | France Travail, Adzuna, ROME 4.0, ESCO |
| **GÃ©nÃ©ration PDF** | Puppeteer (html-pdf-node) |
| **Ã‰diteur WYSIWYG** | Tiptap 3.x (ProseMirror) |
| **Cartographie** | MapLibre GL JS |
| **Calendrier** | Google Calendar API (OAuth2) |
| **Authentification** | JWT (Access + Refresh Tokens) |
| **SÃ©curitÃ©** | Helmet, CSRF (Double Submit), Rate Limiting, SQL Injection Protection |

---

## Architecture Globale

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                         CLIENT (Browser)                             â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”    â”‚
â”‚  â”‚                React SPA (Vite 8 / Rolldown)                  â”‚    â”‚
â”‚  â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”    â”‚    â”‚
â”‚  â”‚  â”‚  Pages   â”‚  â”‚Componentsâ”‚  â”‚ Contexts â”‚  â”‚  Hooks   â”‚    â”‚    â”‚
â”‚  â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜    â”‚    â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜    â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                    â”‚
                                    â”‚ HTTPS (API Calls)
                                    â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                      PROXY SERVER (Express)                          â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”            â”‚
â”‚  â”‚Middlewareâ”‚  â”‚  Routes  â”‚  â”‚ Services â”‚  â”‚  Utils   â”‚            â”‚
â”‚  â”‚ - Auth   â”‚  â”‚ - /auth  â”‚  â”‚ - JWT    â”‚  â”‚ - Logger â”‚            â”‚
â”‚  â”‚ - CSRF   â”‚  â”‚ - /api/* â”‚  â”‚ - LLM    â”‚  â”‚ - Valid. â”‚            â”‚
â”‚  â”‚ - Rate   â”‚  â”‚ - /llm   â”‚  â”‚ - Cache  â”‚  â”‚ - Sanit. â”‚            â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜            â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                    â”‚                           â”‚
                    â”‚                           â”‚
                    â–¼                           â–¼
        â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”        â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
        â”‚    PostgreSQL    â”‚        â”‚   LLM Providers  â”‚
        â”‚   (Database)     â”‚        â”‚ OpenAI/Anthropic â”‚
        â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜        â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Flux de DonnÃ©es

1. **RequÃªte utilisateur** â†’ Frontend React
2. **Appel API** â†’ Proxy Server (avec JWT + CSRF token)
3. **Validation & Auth** â†’ Middleware chain
4. **CrÃ©ation de job** â†’ Route backend persistante (`batch_jobs`, `batch_job_items`)
5. **ExÃ©cution asynchrone** â†’ Worker batch â†’ Services mÃ©tier â†’ PostgreSQL / API LLM
6. **Suivi d'avancement** â†’ Polling frontend sur `GET /api/batch-jobs/:id`
7. **Hydratation finale** â†’ JSON â†’ Frontend â†’ UI Update

---

## Frontend (React 19 / TypeScript)

### Build Tooling (Vite 8)

Vite 8 remplace **Rollup** et **esbuild** par **Rolldown** (bundler Rust) et **OXC** (minificateur) :

| Composant | Avant (Vite 5) | AprÃ¨s (Vite 8) |
|-----------|----------------|-----------------|
| **Bundler** | Rollup | Rolldown |
| **Dependency optimizer** | esbuild | Rolldown |
| **Minificateur** | esbuild | OXC (`minify: true`) |
| **CommonJS** | `@rollup/plugin-commonjs` | Natif Rolldown |
| **Config optimizeDeps** | `esbuildOptions` | `rolldownOptions` |
| **Treeshake** | `tryCatchDeoptimization` | SupprimÃ© (inutile) |

### TailwindCSS 4 (CSS-first)

TailwindCSS 4 utilise une configuration **CSS-first** via `@theme`, `@plugin` et `@variant` directement dans le CSS. Les fichiers `tailwind.config.js` et `postcss.config.js` sont supprimÃ©s.

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

| Changement | Avant (v3) | AprÃ¨s (v4) |
|------------|------------|------------|
| **Config** | `tailwind.config.js` + `postcss.config.js` | CSS-first (`@theme`, `@plugin`) |
| **Plugin Vite** | `postcss` pipeline | `@tailwindcss/vite` (natif) |
| **Ring** | `ring` = 3px | `ring` = 1px (expliciter `ring-3`) |
| **Couleurs** | `bg-opacity-50` | `bg-primary-500/50` |
| **Autoprefixer** | Requis | IntÃ©grÃ© |

### Structure des Dossiers

```
src/
â”œâ”€â”€ components/          # Composants rÃ©utilisables (80+ fichiers)
â”‚   â”œâ”€â”€ ChatBot.tsx      # Assistant IA avec Markdown
â”‚   â”œâ”€â”€ Layout.tsx       # Layout principal avec sidebar
â”‚   â”œâ”€â”€ ResumeAnalysis/  # Composants d'analyse de CV (8 sous-composants)
â”‚   â”œâ”€â”€ HealthIndicator.tsx # Monitoring santÃ© serveur (admin)
â”‚   â”œâ”€â”€ Pagination.tsx   # Pagination rÃ©utilisable
â”‚   â”œâ”€â”€ WebGLBackground.tsx # Animation 3D page d'accueil
â”‚   â”œâ”€â”€ ProcessingScreen.tsx # Animation des Ã©tapes d'upload/analyse
â”‚   â”œâ”€â”€ ImprovementAnimation.tsx # Animation des Ã©tapes d'amÃ©lioration
â”‚   â”œâ”€â”€ TiptapEditor.tsx # Ã‰diteur WYSIWYG Tiptap
â”‚   â”œâ”€â”€ market/          # Composants Market Radar (carte France)
â”‚   â”œâ”€â”€ ui/              # Composants UI rÃ©utilisables (Skeleton, etc.)
â”‚   â””â”€â”€ ...
â”œâ”€â”€ pages/               # Pages de l'application (33 fichiers)
â”‚   â”œâ”€â”€ ResumesPage.tsx  # CVthÃ¨que avec pagination serveur
â”‚   â”œâ”€â”€ ResumeAnalysisPage.tsx # Analyse de CV dÃ©taillÃ©e
â”‚   â”œâ”€â”€ ResumeImprovePage.tsx  # AmÃ©lioration de CV
â”‚   â”œâ”€â”€ ResumeExportPage.tsx   # Export de CV
â”‚   â”œâ”€â”€ ResumeAdaptPage.tsx    # Adaptation CV/Mission
â”‚   â”œâ”€â”€ MissionsPage.tsx # Gestion des missions
â”‚   â”œâ”€â”€ AdaptationsPage.tsx # Adaptations CV/Mission
â”‚   â”œâ”€â”€ ClientsPage.tsx  # Gestion CRM clients
â”‚   â”œâ”€â”€ BatchUploadPage.tsx  # Import batch de CV
â”‚   â”œâ”€â”€ BatchJobsPage.tsx    # Suivi des jobs batch
â”‚   â”œâ”€â”€ ProfileMatchingPage.tsx # Matching profils/missions
â”‚   â”œâ”€â”€ FactsPage.tsx    # Market Radar - DonnÃ©es marchÃ©
â”‚   â”œâ”€â”€ MetiersPage.tsx  # RÃ©fÃ©rentiel ROME 4.0
â”‚   â”œâ”€â”€ GdprAuditPage.tsx # Journal RGPD
â”‚   â”œâ”€â”€ BackupPage.tsx   # Configuration sauvegardes (admin)
â”‚   â”œâ”€â”€ MetricsPage.tsx  # MÃ©triques systÃ¨me (admin)
â”‚   â”œâ”€â”€ admin/EmailTemplatesPage.tsx # Templates email (admin)
â”‚   â””â”€â”€ ...
â”œâ”€â”€ context/             # Contextes React (3 fichiers)
â”‚   â”œâ”€â”€ AuthContext.tsx  # Authentification globale
â”‚   â”œâ”€â”€ ResumeContext.tsx # Ã‰tat des CV
â”‚   â””â”€â”€ ChatbotContext.tsx
â”œâ”€â”€ hooks/               # Hooks personnalisÃ©s
â”‚   â”œâ”€â”€ useAuthFetch.ts  # Fetch avec auth + CSRF retry
â”‚   â””â”€â”€ useDebounce.ts   # Debounce pour recherche
â”œâ”€â”€ services/            # Services frontend
â”‚   â””â”€â”€ authService.ts   # Gestion authentification
â”œâ”€â”€ utils/               # Utilitaires (30+ fichiers)
â”‚   â”œâ”€â”€ apiInterceptor.ts # Interception des requÃªtes
â”‚   â”œâ”€â”€ validation.ts    # Validation Zod
â”‚   â”œâ”€â”€ templateService.ts # Gestion templates export
â”‚   â”œâ”€â”€ resumeService.ts   # Service CV (CRUD, export)
â”‚   â””â”€â”€ sanitizer.frontend.ts
â”œâ”€â”€ i18n/                # Internationalisation (FR/EN)
â”œâ”€â”€ types/               # Types TypeScript
â””â”€â”€ styles/              # Styles CSS (TailwindCSS 4 CSS-first config)
```

### Composants ClÃ©s

| Composant | RÃ´le |
|-----------|------|
| `AuthContext` | Gestion de l'Ã©tat d'authentification, tokens, user |
| `ResumeContext` | Ã‰tat global des CV, sÃ©lection, opÃ©rations CRUD |
| `ChatBot` | Assistant IA avec rendu Markdown, redimensionnable |
| `Layout` | Structure de page avec sidebar, header, navigation |
| `apiInterceptor` | Interception des requÃªtes, gestion CSRF, retry automatique |
| `Pagination` | Composant de pagination rÃ©utilisable avec navigation |
| `HealthIndicator` | Monitoring mÃ©moire et santÃ© serveur (admin) |
| `ProcessingScreen` | Animation des Ã©tapes d'analyse CV |

### Gestion de l'Ã‰tat

- **Contextes React** : Ã‰tat global (Auth, Resume, Chatbot)
- **useState/useEffect** : Ã‰tat local des composants
- **Pas de Redux** : SimplicitÃ© privilÃ©giÃ©e pour cette taille de projet

### Routing (React Router 7)

```typescript
// Routes protÃ©gÃ©es par authentification
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
- SÃ©curise les clÃ©s API (OpenAI, Anthropic)
- Centralise l'authentification et l'autorisation
- Applique les politiques de sÃ©curitÃ© (CORS, CSP, Rate Limiting)
- GÃ¨re les connexions PostgreSQL avec pooling et retry automatique

### Structure des Routes

```
server/routes/
â”œâ”€â”€ auth/                    # Authentification (modulaire)
â”‚   â”œâ”€â”€ signin.routes.js     # Login, 2FA, password
â”‚   â”œâ”€â”€ google.routes.js     # Google OAuth SSO
â”‚   â””â”€â”€ users.routes.js      # Gestion utilisateurs (admin)
â”œâ”€â”€ resumes/                 # CV (modulaire)
â”‚   â”œâ”€â”€ crud.routes.js       # CRUD CV, pagination, filtres
â”‚   â”œâ”€â”€ upload.routes.js     # Upload fichier + RGPD
â”‚   â”œâ”€â”€ llm.handlers.js      # Analyse, amÃ©lioration, adaptation
â”‚   â”œâ”€â”€ versions.routes.js   # Historique des versions
â”‚   â””â”€â”€ stats.routes.js      # Statistiques CV
â”œâ”€â”€ adaptations.routes.js    # Adaptations CV/Mission
â”œâ”€â”€ missions.routes.js       # CRUD missions
â”œâ”€â”€ clients.routes.js        # CRM clients/prospects
â”œâ”€â”€ resumeComments.routes.js # Commentaires sur CV
â”œâ”€â”€ resumeSubmissions.routes.js # Envoi de CV Ã  des clients
â”œâ”€â”€ pipeline.routes.js       # Pipeline de recrutement
â”œâ”€â”€ deals.routes.js          # Affaires commerciales
â”œâ”€â”€ batchJobs.routes.js      # Jobs backend (import, amÃ©lioration, matching, adaptation, missions)
â”œâ”€â”€ batchExport.routes.js    # Export batch (ZIP)
â”œâ”€â”€ templates/crud.routes.js # Templates d'export PDF
â”œâ”€â”€ llm.routes.js            # Proxy LLM (OpenAI/Anthropic)
â”œâ”€â”€ chatbot.routes.js        # Assistant IA contextuel
â”œâ”€â”€ settings.routes.js       # Configuration application
â”œâ”€â”€ firms.routes.js          # Gestion des cabinets
â”œâ”€â”€ tags.routes.js           # Gestion des tags avec cache
â”œâ”€â”€ consent.routes.js        # Consentement RGPD candidats
â”œâ”€â”€ gdprAudit.routes.js      # Journal d'audit RGPD
â”œâ”€â”€ gdprMail.routes.js       # Envoi emails RGPD
â”œâ”€â”€ mail.routes.js           # Envoi emails (Gmail/SMTP)
â”œâ”€â”€ emailTemplates.routes.js # Templates email MJML
â”œâ”€â”€ calendar.routes.js       # Google Calendar (entretiens)
â”œâ”€â”€ share.routes.js          # Partage public de CV (QR code)
â”œâ”€â”€ backup.routes.js         # Sauvegarde/restauration
â”œâ”€â”€ marketRadar/             # DonnÃ©es marchÃ© (modulaire)
â”‚   â”œâ”€â”€ facts.routes.js      # Statistiques marchÃ©
â”‚   â”œâ”€â”€ trends.routes.js     # Tendances salariales
â”‚   â”œâ”€â”€ search.routes.js     # Recherche offres
â”‚   â”œâ”€â”€ collection.routes.js # Collecte donnÃ©es
â”‚   â””â”€â”€ reference.routes.js  # RÃ©fÃ©rentiels ROME/ESCO
â”œâ”€â”€ rome.routes.js           # RÃ©fÃ©rentiel ROME 4.0 mÃ©tiers
â”œâ”€â”€ metrics.routes.js        # MÃ©triques et monitoring
â”œâ”€â”€ health.routes.js         # Health check + memory stats
â”œâ”€â”€ admin.routes.js          # Routes administration (security logs)
â””â”€â”€ docs.routes.js           # Documentation Swagger
```

### Services Backend

| Service | RÃ´le |
|---------|------|
| `jwt.service.js` | GÃ©nÃ©ration/vÃ©rification JWT, rÃ©vocation |
| `llm.service.js` | Orchestration LLM mÃ©tier indÃ©pendante du provider |
| `cache.service.js` | Cache en mÃ©moire avec TTL et cleanup |
| `database.service.js` | Pool PostgreSQL avec retry |
| `tokenBlacklist.service.js` | RÃ©vocation tokens, blacklist users |
| `googleAuth.service.js` | Google OAuth SSO |
| `consent.service.js` | Consentement RGPD candidats |
| `gdprAudit.service.js` | Journal d'audit RGPD |
| `mail/mailService.js` | Envoi emails (Gmail OAuth / SMTP) |
| `mail/gdprMailService.js` | Emails RGPD automatiques |
| `emailTemplates.service.js` | Templates email MJML |
| `calendar.service.js` | Google Calendar (entretiens) |
| `deals.service.js` | Affaires commerciales |
| `candidatePipeline.service.js` | Pipeline de recrutement |
| `batchJobs.service.js` | Gestion des jobs backend persistÃ©s et de leurs items |
| `batchJobsWorker/` | Worker d'exÃ©cution batch (import, extraction, LLM, matching, adaptation, export) |
| `llmAvailability.service.js` | DisponibilitÃ© runtime/persistÃ©e des modÃ¨les selon entitlement et fallback |
| `llmModelCapabilities.service.js` | Registre central des capacitÃ©s et limites par modÃ¨le |
| `llmPayloadCapabilities.service.js` | Construction/sanitation des payloads LLM par capacités |
| `profileMatching.service.js` | Matching mission/profils avec batch scoring LLM, retries par sous-batches et concurrence configurable |
| `backup.service.js` | Sauvegarde/restauration PostgreSQL |
| `backup-scheduler.service.js` | Planification sauvegardes automatiques |
| `industry.service.js` | Gestion des secteurs d'activitÃ© |
| `franceTravail.service.js` | API France Travail (offres, stats) |
| `adzuna.service.js` | API Adzuna (offres emploi) |
| `marketFacts.service.js` | AgrÃ©gation donnÃ©es marchÃ© |
| `marketTrends/` | Tendances salariales (collector, cache, API) |
| `escoService.js` | Classification ESCO compÃ©tences |
| `resumeVersions.service.js` | Historique des versions de CV |

### Middleware Chain

```javascript
// Ordre d'exÃ©cution des middlewares
app.use(helmet());           // 1. Headers sÃ©curitÃ©
app.use(cors());             // 2. CORS
app.use(compression());      // 3. Compression gzip
app.use(cookieParser());     // 4. Parsing cookies
app.use(metricsMiddleware);  // 5. Tracking mÃ©triques
app.use(csrfProtection);     // 6. Protection CSRF
app.use(rateLimiter);        // 7. Rate limiting
app.use(authenticateToken);  // 8. Auth JWT (par route)
```

---

## Base de DonnÃ©es (PostgreSQL)

### Choix de PostgreSQL

PostgreSQL est utilisÃ© comme base de donnÃ©es relationnelle :
- **Performance** : RequÃªtes optimisÃ©es avec indexes
- **ScalabilitÃ©** : Support de volumes de donnÃ©es importants
- **IntÃ©gritÃ©** : Contraintes, transactions ACID, UUIDs
- **SÃ©curitÃ©** : Protection SQL injection via requÃªtes paramÃ©trÃ©es

### SchÃ©ma Principal

#### Tables Principales

| Table | Contenu |
|-------|---------|
| `firms` | Cabinets/organisations, statut, logo |
| `users` | Utilisateurs, rÃ´les, statuts, mots de passe hashÃ©s, 2FA (TOTP) |
| `resumes` | CV, analyses, scores, tags (JSON), consentement RGPD |
| `resume_versions` | Historique des versions de CV amÃ©liorÃ©s |
| `resume_comments` | Commentaires sur les CV (privÃ©s/publics) |
| `missions` | Offres d'emploi, descriptions, compÃ©tences requises |
| `resume_adaptations` | CV adaptÃ©s pour missions, score de matching |
| `templates` | Templates d'export PDF (HTML/CSS) |

#### Tables CRM

| Table | Contenu |
|-------|---------|
| `clients` | Clients/prospects (type, statut, secteur) |
| `client_contacts` | Contacts des clients (email, tÃ©lÃ©phone) |
| `resume_submissions` | Historique d'envoi de CV aux clients |
| `candidate_pipeline` | Pipeline de recrutement (stages) |
| `pipeline_history` | Historique des changements de stage |
| `pipeline_interviews` | Entretiens planifiÃ©s (Google Calendar) |

#### Tables Market Data

| Table | Contenu |
|-------|---------|
| `rome_metiers` | RÃ©fÃ©rentiel ROME 4.0 des mÃ©tiers IT |
| `market_facts` | DonnÃ©es marchÃ© (France Travail, Adzuna) |
| `market_trends` | Tendances salariales par rÃ©gion/mÃ©tier |
| `industry_aliases` | Alias de secteurs d'activitÃ© |

#### Tables Configuration & SÃ©curitÃ©

| Table | Contenu |
|-------|---------|
| `llm_settings` | Configuration LLM, prompts, mode CV, DPO |
| `email_templates` | Templates email MJML par cabinet |
| `backup_settings` | Configuration sauvegarde FTP/SFTP |
| `backup_history` | Historique des sauvegardes |
| `token_blacklist` | Tokens JWT rÃ©voquÃ©s |
| `user_blacklist` | Utilisateurs bloquÃ©s |
| `user_mail_tokens` | Tokens OAuth Gmail/Outlook |
| `user_calendar_tokens` | Tokens OAuth Google Calendar |
| `firm_gdpr_mail_tokens` | Tokens email RGPD par cabinet |
| `global_gdpr_mail_token` | Token email RGPD global |
| `gdpr_audit_log` | Journal d'audit RGPD |
| `schema_migrations` | Suivi des migrations de schÃ©ma |

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

// RequÃªte avec timeout et retry automatique
export async function queryWithTimeout(sql, params, timeout = 30000);

// Select sÃ©curisÃ© avec whitelist de tables
export async function selectWithTimeout(table, options);

// Insert/Update/Delete avec validation
export async function insertRecord(table, data);
export async function updateRecord(table, id, data);
export async function deleteRecord(table, id);
```

### Triggers de DÃ©normalisation

```sql
-- Synchronisation automatique customer_name dans les tables liÃ©es
CREATE TRIGGER sync_customer_name_to_users
AFTER UPDATE OF name ON customers
FOR EACH ROW
EXECUTE FUNCTION sync_customer_name();
```

---

## IntÃ©grations LLM

### Providers SupportÃ©s

| Provider | ModÃ¨les | Usage |
|----------|---------|-------|
| **OpenAI** | GPT-5.4 / GPT-5.4-pro / GPT-5.2 / GPT-5.1 / GPT-5, GPT-4.1, GPT-4o | Analyse, amÃ©lioration, adaptation |
| **Anthropic** | Claude Opus 4.x, Claude Sonnet 4, Claude 3.7, Claude 3.5 | Alternative Ã  OpenAI |
| **DeepSeek** | DeepSeek-V3.2 via `deepseek-chat` et `deepseek-reasoner` | Alternative OpenAI-compatible avec deux modes d'appel : standard et raisonnement |
| **GLM (Z.AI)** | `glm-5.1`, `glm-5` | Alternative OpenAI-compatible via l'API Z.AI |
| **MiniMax** | MiniMax-M2.7, MiniMax-M2.5, MiniMax-M2.1, MiniMax-M2, M2-her, variantes `highspeed` conditionnelles | Alternative API-compatible pour analyse, amÃ©lioration, adaptation avec filtrage selon disponibilitÃ© de plan |
| **Ollama (distant)** | ModÃ¨les exposÃ©s par une instance Ollama externe | ExÃ©cution via une URL Ollama distante, sans moteur Ollama embarquÃ© dans le conteneur |

### Gateway LLM UnifiÃ©

```javascript
// server/services/llmGateway.service.js
export async function callLLM(messages, options) {
  const settings = await getLLMSettings(); // Config depuis PostgreSQL
  const runtime = resolveLLMRuntimeConfig(settings);
  return providerHandlers[runtime.provider](messages, runtime.model, options);
}
```



### CompatibilitÃ© ModÃ¨les

Le service gÃ¨re automatiquement les diffÃ©rences entre modÃ¨les :
- `max_tokens` vs `max_completion_tokens` (GPT-5+)
- support ou suppression de `temperature` / `top_p` selon les capacitÃ©s du modÃ¨le
- suppression automatique de `response_format` quand un modÃ¨le ne le supporte pas (ex. famille MiniMax M2.x)
- clamp centralisÃ© des plafonds de sortie connus par modÃ¨le/provider
- support OpenAI-compatible DeepSeek
- support OpenAI-compatible GLM (Z.AI)
- APIs compatibles OpenAI et Anthropic pour MiniMax
- connexion HTTP vers une instance Ollama distante configurÃ©e dans les paramÃ¨tres
- cas Ollama sans `llmModel` obligatoire cÃ´tÃ© application lorsque le modÃ¨le est pilotÃ© par l'instance distante

La compatibilitÃ© de payload est pilotÃ©e par deux couches distinctes :
- `llmModelCapabilities.service.js` : capacitÃ©s techniques d'un modÃ¨le/provider (tokens, paramÃ¨tres supportÃ©s, plafonds, etc.)
- `llmPayloadCapabilities.service.js` : construction et sanitation du payload rÃ©ellement envoyÃ© Ã  l'API upstream

La disponibilitÃ© mÃ©tier d'un modÃ¨le est traitÃ©e sÃ©parÃ©ment de ses capacitÃ©s techniques :
- `llmAvailability.service.js` : disponibilitÃ© runtime selon la configuration de l'instance
- exemple actuel : les modÃ¨les MiniMax `*-highspeed` sont masquÃ©s et normalisÃ©s vers leur variante standard tant que `MINIMAX_ENABLE_HIGHSPEED_MODELS=true` n'est pas activÃ©

### Services LLM

Les responsabilitÃ©s sont maintenant sÃ©parÃ©es :
- `llmConfiguration.service.js` : rÃ©solution runtime provider / modÃ¨le
- `llmGateway.service.js` : gateway unique, agnostique du provider hors configuration
- `openaiChat.service.js`, `anthropic.service.js`, `deepseek.service.js`, `glm.service.js`, `minimax.service.js`, `ollama.service.js` : implÃ©mentations provider
- `llmContent.service.js` : normalisation/sanitation des sorties
- `llmProviderCommon.service.js` : rÃ¨gles communes de payloads/rÃ©ponses compatibles

### RÃ©silience et observabilitÃ©

- Retry et circuit breaker pour `openai`, `anthropic`, `deepseek`, `glm` et `minimax`
- Retry rÃ©seau lÃ©ger pour `ollama` sur les appels data plane et control plane, sans circuit breaker
- L'indicateur `ollama` dans `/api/llm/circuit-breakers` reste volontairement `NOT_APPLICABLE` pour reflÃ©ter ce choix d'architecture
- Indicateur d'Ã©tat par famille via `/api/llm/circuit-breakers`
- Health checks profonds via `/api/health?deep=true`
- MÃ©triques LLM normalisÃ©es et bornÃ©es pour Ã©viter la cardinalitÃ© non contrÃ´lÃ©e en mÃ©moire

---

## IntÃ©grations Externes

### France Travail API

| Endpoint | Usage |
|----------|-------|
| `/offres` | RÃ©cupÃ©ration des offres d'emploi IT |
| `/stats` | Statistiques marchÃ© par rÃ©gion/mÃ©tier |
| `/rome` | RÃ©fÃ©rentiel ROME 4.0 des mÃ©tiers |

### Adzuna API

| Endpoint | Usage |
|----------|-------|
| `/jobs` | Offres d'emploi complÃ©mentaires |
| `/salary` | DonnÃ©es salariales par rÃ©gion |

### ESCO (European Skills Classification)

- Classification europÃ©enne des compÃ©tences
- Mapping automatique des skills extraits des CV
- Normalisation des tags pour le matching

### Market Radar

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    Market Radar Flow                         â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                              â”‚
â”‚  1. SÃ©lection rÃ©gion sur carte France (MapLibre)            â”‚
â”‚  2. SÃ©lection mÃ©tier (rÃ©fÃ©rentiel ROME 4.0)                 â”‚
â”‚  3. Appel APIs France Travail + Adzuna                      â”‚
â”‚  4. AgrÃ©gation donnÃ©es marchÃ© (offres, salaires, tension)   â”‚
â”‚  5. Affichage tendances et statistiques                     â”‚
â”‚                                                              â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### GÃ©nÃ©ration PDF

```javascript
// pdf-server/server.cjs - Serveur dÃ©diÃ© Puppeteer
const htmlPdf = require('html-pdf-node');

// GÃ©nÃ©ration PDF depuis HTML avec templates personnalisables
app.post('/generate-pdf', async (req, res) => {
  const { html, options } = req.body;
  const pdfBuffer = await htmlPdf.generatePdf({ content: html }, options);
  res.send(pdfBuffer);
});
```

---

## SÃ©curitÃ©

### ðŸ” Authentification JWT

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    JWT Authentication Flow                   â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                              â”‚
â”‚  1. Login â†’ Credentials validation                          â”‚
â”‚  2. Generate Access Token (1h) + Refresh Token (7d)         â”‚
â”‚  3. Tokens stored in httpOnly cookies (not localStorage!)   â”‚
â”‚  4. Each request: Access Token verified                     â”‚
â”‚  5. Token expired? â†’ Automatic refresh with Refresh Token   â”‚
â”‚  6. Logout â†’ Tokens blacklisted                             â”‚
â”‚                                                              â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

**CaractÃ©ristiques :**
- Algorithme HS256 explicite (prÃ©vention attaque algorithm confusion)
- Secrets sÃ©parÃ©s pour Access et Refresh tokens
- JTI unique pour chaque token (support blacklist)
- VÃ©rification statut utilisateur dans le token

### ðŸ›¡ï¸ Protection CSRF (Double Submit Cookie)

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

**MÃ©canisme :**
1. Token CSRF gÃ©nÃ©rÃ© cÃ´tÃ© serveur
2. StockÃ© dans cookie httpOnly + envoyÃ© au client
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

### ðŸš¦ Rate Limiting Multi-Niveaux

| Type | Limite | FenÃªtre | Cible |
|------|--------|---------|-------|
| **Global** | 1000 req | 15 min | Par IP |
| **Auth** | 20 req | 15 min | Tentatives login |
| **User** | 50 req | 15 min | Par utilisateur authentifiÃ© |
| **Upload** | 50 req | 15 min | Upload fichiers |
| **LLM** | 100 req | 1 heure | Appels IA |
| **Combined** | 30 req | 1 min | IP + User (anti-bypass) |

### ðŸ”’ Content Security Policy (CSP)

**Score Mozilla HTTP Observatory : A+** âœ…

L'application implÃ©mente une CSP stricte avec `default-src 'none'`, ce qui garantit que toutes les ressources doivent Ãªtre explicitement autorisÃ©es.

```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],                    // Strict: tout bloquÃ© par dÃ©faut
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
      baseUri: ["'self'"],                       // PrÃ©vient base tag hijacking
      formAction: ["'self'"],
      upgradeInsecureRequests: []                // Force HTTPS
    }
  }
}));
```

#### Directives de sÃ©curitÃ©

| Directive | Valeur | SÃ©curitÃ© |
|-----------|--------|----------|
| `default-src` | `'none'` | âœ… Strict - tout bloquÃ© par dÃ©faut |
| `script-src` | `'self'` | âœ… Pas de `'unsafe-inline'` ni `'unsafe-eval'` |
| `script-src-attr` | `'none'` | âœ… Bloque les event handlers inline |
| `style-src` | `'self' 'unsafe-inline'` | âš ï¸ Requis par Tiptap/ProseMirror (voir note) |
| `object-src` | `'none'` | âœ… Bloque plugins dangereux |
| `frame-ancestors` | `'self'` | âœ… Protection clickjacking |
| `base-uri` | `'self'` | âœ… PrÃ©vient base tag hijacking |

#### Extraction PDF cÃ´tÃ© serveur

Pour Ã©liminer `'unsafe-eval'` de la CSP, l'extraction de texte PDF a Ã©tÃ© migrÃ©e du client vers le serveur :

```
Client (avant)                    Serveur (aprÃ¨s)
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”              â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  pdfjs-dist     â”‚    â”€â”€â–º       â”‚  pdfjs-dist     â”‚
â”‚  (unsafe-eval)  â”‚              â”‚  /legacy        â”‚
â”‚  Tesseract.js   â”‚              â”‚  Tesseract.js   â”‚
â”‚  (OCR client)   â”‚              â”‚  (OCR serveur)  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜              â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

**Endpoint** : `POST /api/resumes/extract-pdf`
- Extraction texte via `pdfjs-dist/legacy`
- OCR automatique pour PDFs scannÃ©s (Tesseract.js)
- Support franÃ§ais + anglais

#### Note sur `'unsafe-inline'` dans `style-src`

Tiptap/ProseMirror nÃ©cessite `'unsafe-inline'` dans `style-src` pour le formatage inline (gras, couleurs, alignement, etc.) car l'Ã©diteur applique des styles directement sur les Ã©lÃ©ments DOM.

**Mitigations :**
- Sanitization cÃ´tÃ© client avec DOMPurify
- Sanitization cÃ´tÃ© serveur avec sanitize-html
- Validation stricte des entrÃ©es utilisateur

### ðŸ§¹ Sanitization

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

### ðŸ“ Token Blacklist

```javascript
// RÃ©vocation immÃ©diate des tokens
export function blacklistToken(tokenId, expiresAt, reason, userId) {
  blacklistedTokens.set(tokenId, { expiresAt, reason, userId, blacklistedAt: Date.now() });
}

// Blacklist tous les tokens d'un utilisateur (dÃ©sactivation compte)
export function blacklistUser(userId, reason) {
  blacklistedUsers.set(userId, { blacklistedAt: Date.now(), reason });
}
```

### ðŸ“Š Security Logging

```javascript
// Ã‰vÃ©nements de sÃ©curitÃ© loggÃ©s
SECURITY_EVENTS = {
  AUTH_SUCCESS, AUTH_FAILURE, AUTH_BLOCKED,
  RATE_LIMIT_HIT, INVALID_TOKEN, TOKEN_EXPIRED,
  SUSPICIOUS_ACTIVITY, FILE_UPLOAD_REJECTED
};

// Persistance fichier avec rotation (10MB max, 5 fichiers)
```

---

## Monitoring & APM

### ðŸ“Š APM Interne

L'application intÃ¨gre un middleware APM (`apm.middleware.js`) pour le suivi des performances :

```javascript
// Configuration APM
const APM_CONFIG = {
    slowRequestThreshold: 1000,      // 1s = requÃªte lente
    verySlowRequestThreshold: 5000,  // 5s = trÃ¨s lente
    criticalRequestThreshold: 30000, // 30s = critique
    traceSamplingRate: 1.0,          // 100% des requÃªtes tracÃ©es
    maxSlowRequests: 100             // Buffer circulaire
};
```

**FonctionnalitÃ©s :**
- DÃ©tection automatique des requÃªtes lentes
- Classification par sÃ©vÃ©ritÃ© (slow, very_slow, critical)
- Breakdown timing dÃ©taillÃ© avec `req.apmMark()`
- Normalisation des endpoints pour agrÃ©gation
- Buffer circulaire des 100 derniÃ¨res requÃªtes lentes
- Statistiques par endpoint (count, avg, max)

**API :**
- `GET /api/metrics/apm` - Statistiques APM
- `GET /api/metrics/apm/slow-requests` - Liste des requÃªtes lentes
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

### ðŸ”® AmÃ©liorations Futures (APM Externe)

Pour une mise en production Ã  grande Ã©chelle, un APM externe apporterait :

| FonctionnalitÃ© | APM Interne | APM Externe (Datadog, New Relic) |
|----------------|-------------|----------------------------------|
| RequÃªtes lentes | âœ… | âœ… |
| Tracing distribuÃ© | âŒ | âœ… |
| Alerting avancÃ© | âŒ | âœ… |
| Dashboards historiques | âŒ | âœ… |
| CorrÃ©lation logs/traces | âŒ | âœ… |
| Profiling code | âŒ | âœ… |

---

## Optimisations

### âš¡ Cache en MÃ©moire

```javascript
// src/services/cache.service.js
class SimpleCache {
  constructor(ttl = 600000, maxSize = 1000) {
    this.cache = new Map();
    this.ttl = ttl;
    this.maxSize = maxSize;
    
    // Cleanup automatique toutes les 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }
}

// Instances de cache
export const settingsCache = new SimpleCache(10 * 60 * 1000);  // 10 min
export const templatesCache = new SimpleCache(10 * 60 * 1000); // 10 min
export const customersCache = new SimpleCache(15 * 60 * 1000); // 15 min
```

### ðŸ“¦ Compression

```javascript
// Backend: compression middleware Express
app.use(compression()); // Gzip automatique des rÃ©ponses API

// Frontend Dev: compression middleware Vite
server.middlewares.use((req, res, next) => {
  // Brotli ou Gzip selon Accept-Encoding
  const useBrotli = acceptEncoding.includes('br');
  const compressed = useBrotli ? zlib.brotliCompressSync(body) : zlib.gzipSync(body);
  res.setHeader('Content-Encoding', useBrotli ? 'br' : 'gzip');
});

// Frontend Prod: fichiers prÃ©-compressÃ©s (.br, .gz) servis par Express
app.use((req, res, next) => {
  // Sert automatiquement les fichiers .br ou .gz si disponibles
  if (acceptEncoding.includes('br') && fs.existsSync(filePath + '.br')) {
    res.set('Content-Encoding', 'br');
    req.url = req.url + '.br';
  }
});
```

### ðŸ—‚ï¸ Cache Assets Statiques

```javascript
// Cache agressif pour assets hashÃ©s (1 an, immutable)
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

### ðŸ”„ Connection Pooling (Axios)

```javascript
// src/config/axios.js
export const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });
export const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });
```

### ðŸ“„ Lazy Loading

```javascript
// Chargement diffÃ©rÃ© des librairies lourdes via React.lazy() et dynamic imports
// Les libs PDF (pdfjs-dist) et OCR (Tesseract) sont extraites cÃ´tÃ© serveur uniquement
// Les composants lourds (TiptapEditor, MapLibre, Three.js) sont lazy-loaded via React.lazy()
```

### ðŸ§¹ Cleanup Automatique

- **Rate Limit Stores** : Nettoyage toutes les heures
- **Token Blacklist** : Suppression tokens expirÃ©s
- **Cache** : Ã‰viction entrÃ©es expirÃ©es + limite taille
- **Fichiers temporaires** : Nettoyage multi-rÃ©pertoires (voir section dÃ©diÃ©e)

---

## Gestion des Fichiers Temporaires

### Architecture de Nettoyage

Le systÃ¨me gÃ¨re automatiquement les fichiers temporaires gÃ©nÃ©rÃ©s cÃ´tÃ© serveur pour Ã©viter l'accumulation sur le disque.

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                      FileCleanupManager                              â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚    uploads/      â”‚  â”‚  batch-exports/  â”‚  â”‚     shared/      â”‚   â”‚
â”‚  â”‚    TTL: 1h       â”‚  â”‚    TTL: 24h      â”‚  â”‚    TTL: 30j      â”‚   â”‚
â”‚  â”‚  Fichiers upload â”‚  â”‚  ZIPs d'export   â”‚  â”‚  PDFs partagÃ©s   â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                                               â”‚
â”‚  â”‚   server/temp/   â”‚                                               â”‚
â”‚  â”‚    TTL: 1h       â”‚                                               â”‚
â”‚  â”‚ Fichiers backup  â”‚                                               â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                                               â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### RÃ©pertoires GÃ©rÃ©s

| RÃ©pertoire | TTL | Contenu | Nettoyage |
|------------|-----|---------|-----------|
| `./uploads/` | 1 heure | Fichiers uploadÃ©s (CVs) | PÃ©riodique |
| `os.tmpdir()/batch-exports/` | 24 heures | ZIPs d'export batch | PÃ©riodique + aprÃ¨s tÃ©lÃ©chargement |
| `./uploads/shared/` | 30 jours | PDFs partagÃ©s publiquement | PÃ©riodique |
| `./server/temp/` | 1 heure | Fichiers temporaires backup | PÃ©riodique |
| `./uploads/logos/` | âˆž | Logos des firms | Persistants (non nettoyÃ©s) |

### MÃ©canismes de Nettoyage

```javascript
// server/utils/fileCleanup.js

// Configuration des rÃ©pertoires avec TTL
const CLEANUP_DIRS = {
    uploads: { path: UPLOAD_DIR, maxAgeMs: 60 * 60 * 1000 },        // 1h
    batchExports: { path: BATCH_EXPORTS_DIR, maxAgeMs: 24 * 60 * 60 * 1000 }, // 24h
    serverTemp: { path: TEMP_DIR, maxAgeMs: 60 * 60 * 1000 },       // 1h
    sharedPdfs: { path: SHARED_DIR, maxAgeMs: 30 * 24 * 60 * 60 * 1000 }  // 30j
};

// Nettoyage pÃ©riodique (toutes les heures)
startPeriodicCleanup(60 * 60 * 1000);
```

### Suppression AprÃ¨s TÃ©lÃ©chargement

Les fichiers ZIP d'export batch sont automatiquement supprimÃ©s aprÃ¨s tÃ©lÃ©chargement :

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

### Fonctions ExportÃ©es

| Fonction | Description |
|----------|-------------|
| `startPeriodicCleanup(intervalMs)` | DÃ©marre le nettoyage pÃ©riodique |
| `stopPeriodicCleanup()` | ArrÃªte le timer de nettoyage |
| `cleanupOldFiles(dir, maxAgeMs)` | Nettoie un rÃ©pertoire spÃ©cifique |
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

### Langues SupportÃ©es

| Langue | Fichier | ClÃ©s |
|--------|---------|------|
| **FranÃ§ais** | `locales/fr.json` | ~1000 clÃ©s |
| **Anglais** | `locales/en.json` | ~1000 clÃ©s |

### Structure des Traductions

```json
{
  "common": { "save": "Enregistrer", "cancel": "Annuler" },
  "resumes": { "title": "CVthÃ¨que", "filters": { "skills": "CompÃ©tences" } },
  "resume": { "analysis": { "categories": { "technicalskills": "CompÃ©tences techniques" } } },
  "navigation": { "home": "Accueil", "resumes": "CVthÃ¨que" },
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
# Script d'audit pour dÃ©tecter les clÃ©s manquantes/inutilisÃ©es
node scripts/audit-translations.js
node scripts/audit-translations.js --fix  # Ajoute les clÃ©s manquantes
```

---

## QualitÃ© du Code

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

### Logging StructurÃ©

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

- **Swagger/OpenAPI** : Documentation interactive Ã  `/api/docs/ui`
- **SchÃ©mas** : Tous les endpoints documentÃ©s

---

## âœ… Points Forts

### Architecture

| Point Fort | Description |
|------------|-------------|
| **SÃ©paration claire** | Frontend/Backend bien dÃ©couplÃ©s via API REST |
| **Proxy sÃ©curisÃ©** | ClÃ©s API jamais exposÃ©es cÃ´tÃ© client |
| **TypeScript** | Typage fort rÃ©duisant les bugs runtime |
| **ModularitÃ©** | Services, routes, composants bien organisÃ©s |

### SÃ©curitÃ©

| Point Fort | Description |
|------------|-------------|
| **Defense in Depth** | Multiples couches de sÃ©curitÃ© (JWT, CSRF, Rate Limit, CSP) |
| **Tokens httpOnly** | Protection XSS des tokens d'authentification |
| **Blacklist tokens** | RÃ©vocation immÃ©diate possible |
| **2FA TOTP** | Authentification Ã  deux facteurs avec codes temporels (speakeasy) |
| **Sanitization** | Double sanitization (frontend + backend) |
| **Logging sÃ©curitÃ©** | TraÃ§abilitÃ© des Ã©vÃ©nements critiques |

### ExpÃ©rience DÃ©veloppeur

| Point Fort | Description |
|------------|-------------|
| **Hot Reload** | Vite pour dÃ©veloppement rapide |
| **Proxy dev** | Configuration proxy intÃ©grÃ©e |
| **i18n** | Internationalisation FR/EN complÃ¨te |
| **Documentation** | Guide utilisateur, changelog, architecture |

### FonctionnalitÃ©s

| Point Fort | Description |
|------------|-------------|
| **Multi-LLM** | Support OpenAI et Anthropic interchangeables |
| **Chatbot IA** | Assistant contextuel avec guide utilisateur |
| **Export multi-format** | Word, PDF avec templates personnalisables |
| **MÃ©triques** | Dashboard de monitoring intÃ©grÃ© |

---

## âš ï¸ Points Faibles et Axes d'AmÃ©lioration

### Architecture

| Point Faible | Impact | AmÃ©lioration SuggÃ©rÃ©e |
|--------------|--------|----------------------|
| **Cache en mÃ©moire** | Perdu au redÃ©marrage, non partagÃ© multi-instances | Redis pour cache distribuÃ© |
| **Token blacklist en mÃ©moire** | Idem | Redis ou table DB pour persistance |
| **Monolithe** | Tout dans un seul serveur | Microservices si besoin de scaling indÃ©pendant |

### SÃ©curitÃ©

| Point Faible | Impact | AmÃ©lioration SuggÃ©rÃ©e |
|--------------|--------|----------------------|
| **CSP permissive** | `unsafe-inline` dans style-src pour Tiptap | Ã‰valuer nonce-based CSP pour les styles inline |
| **Secrets en .env** | Gestion manuelle | Vault (HashiCorp) ou AWS Secrets Manager |

### Performance

| Point Faible | Impact | AmÃ©lioration SuggÃ©rÃ©e |
|--------------|--------|----------------------|
| **Bundle size** | ~2.5MB JS (gzip ~665KB) | Code splitting plus agressif, lazy loading |
| **Pas de CDN** | Assets servis par le serveur | CloudFront/Cloudflare pour assets statiques |
| **Pas de SSR** | SEO limitÃ© (SPA) | Next.js si SEO critique |

### QualitÃ©

| Point Faible | Impact | AmÃ©lioration SuggÃ©rÃ©e |
|--------------|--------|----------------------|
| **Couverture tests** | Tests limitÃ©s | Augmenter couverture (unit + integration + e2e) |
| **Pas de CI/CD documentÃ©** | DÃ©ploiement manuel | GitHub Actions / GitLab CI |
| **APM interne uniquement** | Pas de tracing distribuÃ© | APM externe (Datadog, New Relic) pour tracing cross-service, alerting avancÃ©, dashboards historiques |

### Fonctionnel

| Point Faible | Impact | AmÃ©lioration SuggÃ©rÃ©e |
|--------------|--------|----------------------|
| **Pas de mode offline** | DÃ©pendance rÃ©seau | Service Worker + IndexedDB |
| **Pas de notifications push** | UX limitÃ©e | Web Push API |
| **Export PDF basique** | QualitÃ© variable | Puppeteer headless pour rendu fidÃ¨le |

---

## DÃ©ploiement Docker

### Architecture du Conteneur

L'application peut Ãªtre dÃ©ployÃ©e via un conteneur Docker tout-en-un qui inclut tous les composants nÃ©cessaires :

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                      Conteneur Docker                                â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”    â”‚
â”‚  â”‚                     Supervisor                               â”‚    â”‚
â”‚  â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                 â”‚    â”‚
â”‚  â”‚  â”‚   Proxy Server   â”‚  â”‚    PDF Server    â”‚                 â”‚    â”‚
â”‚  â”‚  â”‚   (Express.js)   â”‚  â”‚   (Puppeteer)    â”‚                 â”‚    â”‚
â”‚  â”‚  â”‚   Port: 3443     â”‚  â”‚   Port: 3002     â”‚                 â”‚    â”‚
â”‚  â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                 â”‚    â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜    â”‚
â”‚                              â”‚                                       â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”    â”‚
â”‚  â”‚                   PostgreSQL 18                              â”‚    â”‚
â”‚  â”‚                   Port: 5432 (interne)                       â”‚    â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜    â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                              â”‚
              â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
              â”‚     Volume Docker             â”‚
              â”‚   resumeconverter-pgdata      â”‚
              â”‚   (donnÃ©es persistantes)      â”‚
              â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Composants Docker

| Fichier | RÃ´le |
|---------|------|
| `Dockerfile` | Image Ubuntu 22.04 avec Node.js 20, PostgreSQL 18, Google Chrome |
| `docker/entrypoint.sh` | Script de dÃ©marrage avec init DB et migrations automatiques |
| `docker/supervisord.conf` | Gestionnaire de processus (proxy + PDF servers) |
| `docker/init-db.sql` | SchÃ©ma complet de la base de donnÃ©es |
| `docker/migrations/` | Scripts de migration incrÃ©mentaux |

### Persistance des DonnÃ©es

Les donnÃ©es sont stockÃ©es dans des **rÃ©pertoires locaux** (pas des volumes Docker) pour une meilleure portabilitÃ© :

| Chemin local | Chemin conteneur | Description |
|--------------|------------------|-------------|
| `./data/postgresql` | `/var/lib/postgresql/18/main` | Base de donnÃ©es PostgreSQL |
| `./uploads` | `/app/uploads` | Fichiers CV uploadÃ©s |
| `./logs` | `/app/logs` | Logs applicatifs |

âœ… Les donnÃ©es survivent aux rebuilds d'image et aux suppressions de conteneur.

### SystÃ¨me de Migrations

Le conteneur gÃ¨re automatiquement les migrations de base de donnÃ©es :

1. **Premier lancement** : ExÃ©cute `init-db.sql` complet, marque toutes les migrations comme appliquÃ©es
2. **Lancements suivants** : VÃ©rifie la table `schema_migrations`, applique uniquement les nouvelles migrations
3. **Mise Ã  jour d'image** : Applique automatiquement les migrations manquantes

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
| `JWT_SECRET` | âœ… | Secret JWT (min 32 caractÃ¨res) |
| `JWT_REFRESH_SECRET` | âœ… | Secret refresh token |
| `REFRESH_TOKEN_SECRET` | âœ… | Secret token additionnel |
| `CSRF_SECRET` | âœ… | Secret CSRF |
| `OPENAI_API_KEY` | Optionnel | ClÃ© API OpenAI |
| `ANTHROPIC_API_KEY` | Optionnel | ClÃ© API Anthropic |
| `ANTHROPIC_MODEL` | Optionnel | ModÃ¨le Anthropic par dÃ©faut |
| `DEEPSEEK_API_KEY` | Optionnel | ClÃ© API DeepSeek |
| `DEEPSEEK_BASE_URL` | Optionnel | URL base DeepSeek |
| `GLM_API_KEY` | Optionnel | ClÃ© API GLM / Z.AI |
| `GLM_BASE_URL` | Optionnel | URL base OpenAI-compatible GLM (`https://api.z.ai/api/paas/v4`) |
| `MINIMAX_API_KEY` | Optionnel | ClÃ© API MiniMax |
| `MINIMAX_OPENAI_BASE_URL` | Optionnel | URL base OpenAI-compatible MiniMax |
| `MINIMAX_ANTHROPIC_BASE_URL` | Optionnel | URL base Anthropic-compatible MiniMax |
| `MINIMAX_ENABLE_HIGHSPEED_MODELS` | Optionnel | Active l'exposition et l'utilisation des modÃ¨les MiniMax `highspeed` sur les instances disposant du plan adaptÃ© |
| `OLLAMA_BASE_URL` | Optionnel | URL de l'instance Ollama distante |
| `OLLAMA_AUTO_PULL` | Optionnel | Auto-pull du modÃ¨le Ollama si nÃ©cessaire |
| `OLLAMA_REQUEST_TIMEOUT_MS` | Optionnel | Timeout global des appels Ollama |
| `GOOGLE_CLIENT_ID` | Optionnel | Client ID Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Optionnel | Secret Google OAuth |
| `MAIL_TOKEN_ENCRYPTION_KEY` | Optionnel | ClÃ© de chiffrement tokens mail |

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
| `docker-run.bat` | DÃ©marrer le conteneur |
| `docker-stop.bat` | ArrÃªter et supprimer le conteneur |
| `docker-logs.bat` | Voir les logs en temps rÃ©el |
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

# ArrÃªt
./docker/docker-build.sh stop
```

---

## Sauvegardes et Planification

### Architecture des Sauvegardes

L'application intÃ¨gre un systÃ¨me complet de sauvegarde automatique de la base de donnÃ©es avec support FTP/SFTP et stockage local.

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                      Backup Scheduler Service                        â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚              setInterval (toutes les 30 secondes)             â”‚   â”‚
â”‚  â”‚                                                               â”‚   â”‚
â”‚  â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”          â”‚   â”‚
â”‚  â”‚  â”‚   Daily     â”‚  â”‚   Weekly    â”‚  â”‚   Monthly   â”‚          â”‚   â”‚
â”‚  â”‚  â”‚  Backup     â”‚  â”‚   Backup    â”‚  â”‚   Backup    â”‚          â”‚   â”‚
â”‚  â”‚  â”‚  (HH:MM)    â”‚  â”‚ (Jour+HH:MM)â”‚  â”‚(Jour+HH:MM) â”‚          â”‚   â”‚
â”‚  â”‚  â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”˜          â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â”‚            â”‚                â”‚                â”‚                       â”‚
â”‚            â–¼                â–¼                â–¼                       â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚                     Backup Service                            â”‚   â”‚
â”‚  â”‚  1. pg_dump â†’ SQL                                            â”‚   â”‚
â”‚  â”‚  2. gzip compression                                         â”‚   â”‚
â”‚  â”‚  3. Upload FTP/SFTP ou stockage local                        â”‚   â”‚
â”‚  â”‚  4. Cleanup anciens backups (rÃ©tention configurable)         â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Planification des Sauvegardes

Le scheduler utilise `setInterval` avec vÃ©rification toutes les 30 secondes pour dÃ©clencher les sauvegardes Ã  l'heure configurÃ©e (timezone Europe/Paris).

| Type | FrÃ©quence | Configuration |
|------|-----------|---------------|
| **Daily** | Tous les jours | Heure (HH:MM) |
| **Weekly** | Une fois par semaine | Jour de la semaine + Heure |
| **Monthly** | Une fois par mois | Jour du mois + Heure |

**MÃ©canisme de dÃ©clenchement :**
```javascript
// server/services/backup-scheduler.service.js
function checkAndExecuteBackups() {
    const { hours, minutes, dayOfWeek, dayOfMonth } = getParisTime();
    
    // Daily: vÃ©rifie heure + Ã©vite double exÃ©cution le mÃªme jour
    if (settings.daily_enabled && timeMatches(settings.daily_time, hours, minutes)) {
        if (lastExecuted.daily !== todayKey) {
            lastExecuted.daily = todayKey;
            executeBackup('daily');
        }
    }
    // Weekly: vÃ©rifie jour de semaine + heure
    // Monthly: vÃ©rifie jour du mois + heure
}
```

### Cibles de Sauvegarde

| Cible | Protocole | Configuration |
|-------|-----------|---------------|
| **FTP** | FTP avec TLS explicite | Host, port, user, password |
| **FTPS** | FTP over TLS | Host, port, user, password, tls_mode |
| **SFTP** | SSH File Transfer | Host, port, user, password |
| **Local** | SystÃ¨me de fichiers | RÃ©pertoire `/app/server/backups` |

### Politique de RÃ©tention

Chaque type de sauvegarde a sa propre politique de rÃ©tention configurable :

| Type | RÃ©tention par dÃ©faut | Description |
|------|---------------------|-------------|
| **Daily** | 7 jours | Conserve les 7 derniÃ¨res sauvegardes quotidiennes |
| **Weekly** | 4 semaines | Conserve les 4 derniÃ¨res sauvegardes hebdomadaires |
| **Monthly** | 12 mois | Conserve les 12 derniÃ¨res sauvegardes mensuelles |
| **Manual** | 30 jours | Sauvegardes manuelles dÃ©clenchÃ©es via l'interface |

Le nettoyage s'applique automatiquement aprÃ¨s chaque sauvegarde, tant sur le serveur distant (FTP/SFTP) que localement.

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

Chaque sauvegarde est enregistrÃ©e dans la table `backup_history` :

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

L'Ã©cran de configuration des sauvegardes (`/dashboard/backup`) permet de :

- **Configurer la cible** : Local, FTP, FTPS ou SFTP
- **Tester la connexion** : VÃ©rification avant sauvegarde
- **Planifier les sauvegardes** : Daily, Weekly, Monthly avec horaires
- **DÃ©finir la rÃ©tention** : Nombre de sauvegardes Ã  conserver par type
- **DÃ©clencher manuellement** : Sauvegarde immÃ©diate
- **Consulter l'historique** : Liste des sauvegardes avec statut
- **Restaurer** : TÃ©lÃ©chargement et restauration d'une sauvegarde

### Gestion des Erreurs

Le systÃ¨me garantit qu'aucune erreur ne passe silencieusement :

```javascript
// Logging dÃ©taillÃ© en cas d'erreur
safeLog('error', 'BACKUP FAILED - Scheduled daily backup failed', {
    type,
    error: error.message,
    stack: error.stack,
    code: error.code,
    durationSeconds: duration
});
console.error(`[BackupScheduler] BACKUP FAILED: ${type} - ${error.message}`);
```

| Niveau | Ã‰vÃ©nement | Action |
|--------|-----------|--------|
| **INFO** | DÃ©marrage backup | Log avec timestamp et type |
| **INFO** | Backup rÃ©ussi | Log avec filename, taille, durÃ©e |
| **ERROR** | Connexion FTP Ã©chouÃ©e | Log avec host, port, code erreur |
| **ERROR** | Upload Ã©chouÃ© | Log + conservation locale du fichier |
| **ERROR** | Backup Ã©chouÃ© | Log complet avec stack trace |

### Services et Fichiers

| Fichier | RÃ´le |
|---------|------|
| `backup-scheduler.service.js` | Planification avec setInterval |
| `backup.service.js` | CrÃ©ation, upload, restauration, nettoyage |
| `backup.routes.js` | API REST pour configuration et actions |

### API Backup

| Endpoint | MÃ©thode | Description |
|----------|---------|-------------|
| `/api/backup/settings` | GET | RÃ©cupÃ©rer la configuration |
| `/api/backup/settings` | PUT | Mettre Ã  jour la configuration |
| `/api/backup/test-connection` | POST | Tester la connexion FTP/SFTP |
| `/api/backup/create` | POST | DÃ©clencher une sauvegarde manuelle |
| `/api/backup/history` | GET | Historique des sauvegardes |
| `/api/backup/restore/:filename` | POST | Restaurer une sauvegarde |
| `/api/backup/download/:filename` | GET | TÃ©lÃ©charger une sauvegarde |

---

## Conclusion

ResumeConverter est une application **bien architecturÃ©e** avec une attention particuliÃ¨re portÃ©e Ã  la **sÃ©curitÃ©** (authentification JWT robuste, protection CSRF, rate limiting multi-niveaux, protection SQL injection). L'utilisation de **PostgreSQL** comme base de donnÃ©es offre performance, scalabilitÃ© et intÃ©gritÃ© des donnÃ©es.

Pour une mise en production Ã  grande Ã©chelle, les prioritÃ©s seraient :
1. Cache distribuÃ© (Redis)
2. CDN pour les assets
3. Monitoring APM
4. CI/CD automatisÃ©
5. RÃ©plication PostgreSQL pour haute disponibilitÃ©

L'architecture actuelle est **adaptÃ©e pour un usage PME/ESN** et peut supporter des volumes importants grÃ¢ce Ã  PostgreSQL.

---

*Document mis Ã  jour le 17 mars 2026*
*Version: 1.8.6*

### Changelog technique rÃ©cent

| Package | Avant | AprÃ¨s | Notes |
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
| autoprefixer | 10.x | â€” | SupprimÃ© (intÃ©grÃ© dans TailwindCSS 4) |
| @rollup/plugin-commonjs | 28.x | â€” | SupprimÃ© (Rolldown gÃ¨re CJS nativement) |
