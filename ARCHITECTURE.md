# Architecture Technique - ResumeConverter

## 📋 Table des Matières

1. [Vue d'Ensemble](#vue-densemble)
2. [Architecture Globale](#architecture-globale)
3. [Frontend (React/TypeScript)](#frontend-reacttypescript)
4. [Backend (Node.js/Express)](#backend-nodejsexpress)
5. [Base de Données (PostgreSQL)](#base-de-données-postgresql)
6. [Intégrations LLM](#intégrations-llm)
7. [Intégrations Externes](#intégrations-externes)
8. [Sécurité](#sécurité)
9. [Optimisations](#optimisations)
10. [Internationalisation (i18n)](#internationalisation-i18n)
11. [Qualité du Code](#qualité-du-code)
12. [Points Forts](#-points-forts)
13. [Points Faibles et Axes d'Amélioration](#-points-faibles-et-axes-damélioration)

---

## Vue d'Ensemble

**ResumeConverter** est une application web full-stack de gestion et d'optimisation de CV assistée par intelligence artificielle. Elle permet aux entreprises (ESN) de gérer une CVthèque, d'analyser et améliorer les CV, et de les adapter à des missions spécifiques.

### Stack Technique

| Couche | Technologies |
|--------|-------------|
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS, Framer Motion |
| **Backend** | Node.js, Express.js |
| **Base de données** | PostgreSQL 15+ avec pg (node-postgres) |
| **IA/LLM** | OpenAI (GPT-4/5), Anthropic (Claude) |
| **APIs Externes** | France Travail, Adzuna, ROME 4.0, ESCO |
| **Génération PDF** | Puppeteer (html-pdf-node) |
| **Éditeur WYSIWYG** | TinyMCE 7 |
| **Cartographie** | MapLibre GL JS |
| **Authentification** | JWT (Access + Refresh Tokens) |
| **Sécurité** | Helmet, CSRF (Double Submit), Rate Limiting, SQL Injection Protection |

---

## Architecture Globale

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                             │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    React SPA (Vite)                          │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │    │
│  │  │  Pages   │  │Components│  │ Contexts │  │  Hooks   │    │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS (API Calls)
                                    ▼
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
                    ▼                           ▼
        ┌──────────────────┐        ┌──────────────────┐
        │    PostgreSQL    │        │   LLM Providers  │
        │   (Database)     │        │ OpenAI/Anthropic │
        └──────────────────┘        └──────────────────┘
```

### Flux de Données

1. **Requête utilisateur** → Frontend React
2. **Appel API** → Proxy Server (avec JWT + CSRF token)
3. **Validation & Auth** → Middleware chain
4. **Traitement** → Routes → Services
5. **Données** → PostgreSQL ou LLM API
6. **Réponse** → JSON → Frontend → UI Update

---

## Frontend (React/TypeScript)

### Structure des Dossiers

```
src/
├── components/          # Composants réutilisables (60+ fichiers)
│   ├── ChatBot.tsx      # Assistant IA avec Markdown
│   ├── Layout.tsx       # Layout principal avec sidebar
│   ├── ResumeAnalysis/  # Composants d'analyse de CV (8 sous-composants)
│   ├── HealthIndicator.tsx # Monitoring santé serveur (admin)
│   ├── Pagination.tsx   # Pagination réutilisable
│   ├── WebGLBackground.tsx # Animation 3D page d'accueil
│   ├── market/          # Composants Market Radar (carte France)
│   └── ...
├── pages/               # Pages de l'application (21 fichiers)
│   ├── ResumesPage.tsx  # CVthèque avec pagination serveur
│   ├── MissionsPage.tsx # Gestion des missions
│   ├── AdaptationsPage.tsx # Adaptations CV/Mission
│   ├── ProfileMatchingPage.tsx # Matching profils/missions
│   ├── FactsPage.tsx    # Market Radar - Données marché
│   ├── MetiersPage.tsx  # Référentiel ROME 4.0
│   ├── SecurityLogs.tsx # Logs de sécurité (admin)
│   ├── MetricsPage.tsx  # Métriques système (admin)
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
├── utils/               # Utilitaires (25 fichiers)
│   ├── apiInterceptor.ts # Interception des requêtes
│   ├── validation.ts    # Validation Zod
│   └── sanitizer.frontend.ts
├── i18n/                # Internationalisation (FR/EN)
├── types/               # Types TypeScript
└── styles/              # Styles CSS/Tailwind
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

### Routing

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
├── auth.routes.js       # Login, logout, refresh, register
├── resumes.routes.js    # CRUD CV, upload, analyse, pagination
├── missions.routes.js   # CRUD missions
├── adaptations.routes.js # Adaptations CV/Mission
├── llm.routes.js        # Appels LLM (analyse, amélioration)
├── chatbot.routes.js    # Assistant IA contextuel
├── settings.routes.js   # Configuration application
├── templates.routes.js  # Templates d'export Word/PDF
├── users.routes.js      # Gestion utilisateurs (admin)
├── customers.routes.js  # Gestion clients/entreprises
├── tags.routes.js       # Gestion des tags avec cache
├── metrics.routes.js    # Métriques et monitoring
├── health.routes.js     # Health check + memory stats
├── admin.routes.js      # Routes administration (security logs, filters)
├── marketRadar.routes.js # Données marché France Travail/Adzuna
├── rome.routes.js       # Référentiel ROME 4.0 métiers
└── docs.routes.js       # Documentation Swagger
```

### Services Backend

| Service | Rôle |
|---------|------|
| `jwt.service.js` | Génération/vérification JWT, révocation |
| `llm.service.js` | Abstraction OpenAI/Anthropic, gestion modèles |
| `cache.service.js` | Cache en mémoire avec TTL et cleanup |
| `metrics.service.js` | Collecte métriques, persistance fichier |
| `security.service.js` | Logging sécurité, rotation fichiers |
| `tokenBlacklist.service.js` | Révocation tokens, blacklist users |
| `settings.service.js` | Configuration LLM centralisée |
| `retry.service.js` | Retry automatique avec backoff |
| `franceTravail.service.js` | API France Travail (offres, stats) |
| `adzuna.service.js` | API Adzuna (offres emploi) |
| `marketFacts.service.js` | Agrégation données marché |
| `marketTrends.service.js` | Tendances salariales par région |
| `rome.service.js` | Référentiel ROME 4.0 métiers IT |
| `escoService.js` | Classification ESCO compétences |
| `profileMatching.service.js` | Matching CV/Mission par tags |
| `openai.service.js` | Appels OpenAI avec streaming |
| `database.service.js` | Pool PostgreSQL avec retry |
| `shutdown.service.js` | Graceful shutdown |

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

| Table | Contenu |
|-------|---------|
| `users` | Utilisateurs, rôles, statuts, mots de passe hashés |
| `customers` | Entreprises clientes |
| `resumes` | CV, analyses, scores, tags (JSON) |
| `missions` | Offres d'emploi, descriptions |
| `resume_adaptations` | CV adaptés pour missions |
| `templates` | Templates d'export Word/PDF |
| `llm_settings` | Configuration LLM, prompts |
| `market_facts` | Données marché (France Travail, Adzuna) |
| `market_trends` | Tendances salariales par région/métier |
| `metiers` | Référentiel ROME 4.0 des métiers IT |

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
| **OpenAI** | GPT-4, GPT-4o, GPT-5.x | Analyse, amélioration, adaptation |
| **Anthropic** | Claude 3.x | Alternative à OpenAI |

### Service LLM Unifié

```javascript
// src/services/llm.service.js
export async function callLLM(messages, options) {
  const settings = await getLLMSettings(); // Config depuis PostgreSQL
  const provider = settings.llmProvider;   // 'openai' ou 'anthropic'
  
  if (provider === 'anthropic') {
    return await callAnthropic(messages, model, options);
  } else {
    return await callOpenAI(messages, model, options);
  }
}
```

### Compatibilité Modèles

Le service gère automatiquement les différences entre modèles :
- `max_tokens` vs `max_completion_tokens` (GPT-5+)
- Support température (non supporté par GPT-5)
- Format messages (OpenAI vs Anthropic)

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

```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // TinyMCE requirement
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "https://api.openai.com", "https://api.anthropic.com"],
      // ...
    }
  }
}));
```

> ⚠️ **Note** : `unsafe-inline` et `unsafe-eval` sont requis par TinyMCE. Mitigation : sanitization DOMPurify.

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

## Optimisations

### ⚡ Cache en Mémoire

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
// Chargement différé des librairies lourdes
// src/utils/lazyPdfjs.js
export async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist');
  return pdfjs;
}

// src/utils/lazyTesseract.js (OCR)
// src/utils/lazyTinyMCE.js (Éditeur WYSIWYG)
```

### 🧹 Cleanup Automatique

- **Rate Limit Stores** : Nettoyage toutes les heures
- **Token Blacklist** : Suppression tokens expirés
- **Cache** : Éviction entrées expirées + limite taille
- **Fichiers uploadés** : Nettoyage périodique

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
npm run test        # Vitest
npm run test:watch  # Mode watch
npm run test:coverage
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
| **CSP permissive** | `unsafe-inline/eval` pour TinyMCE | Évaluer alternatives à TinyMCE ou nonce-based CSP |
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
| **Monitoring limité** | Métriques basiques | APM (Datadog, New Relic) pour production |

### Fonctionnel

| Point Faible | Impact | Amélioration Suggérée |
|--------------|--------|----------------------|
| **Pas de mode offline** | Dépendance réseau | Service Worker + IndexedDB |
| **Pas de notifications push** | UX limitée | Web Push API |
| **Export PDF basique** | Qualité variable | Puppeteer headless pour rendu fidèle |

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

*Document mis à jour le 1 mars 2026*
*Version: 1.7.0*
