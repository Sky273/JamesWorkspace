# Resume Converter

[![Version](https://img.shields.io/badge/version-1.7.7-blue.svg)](./CHANGELOG.md)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18+-blue.svg)](https://www.postgresql.org/)
[![React](https://img.shields.io/badge/React-18.2-61dafb.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)

Application professionnelle de gestion et d'analyse de CVs avec intelligence artificielle, matching de profils et radar du marché de l'emploi intégré.

## 🚀 Fonctionnalités

### Gestion des CVs
- **Upload et parsing** : Support PDF, DOCX, DOC avec OCR (Tesseract.js)
- **Analyse IA** : Extraction automatique des compétences, expériences et formations via GPT-5/Claude
- **Tags ESCO** : Classification automatique selon le référentiel européen des compétences
- **Édition enrichie** : Éditeur TinyMCE intégré pour la mise en forme
- **Export PDF** : Génération de CVs formatés avec templates personnalisables
- **Amélioration IA** : Suggestions d'amélioration automatiques du contenu

### Matching Profil / Mission
- **Analyse de compatibilité** : Score de matching entre CV et offre d'emploi
- **Adaptations de CV** : Génération de versions adaptées à une mission spécifique
- **Comparaison détaillée** : Visualisation des écarts compétences/expériences

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
- **Assistant conversationnel** : Aide à la rédaction et conseils carrière
- **Multi-modèles** : Support OpenAI (GPT-5, GPT-4o) et Anthropic (Claude 4.5/4.6)
- **Contexte CV** : Réponses personnalisées basées sur le profil

### Administration
- **Gestion utilisateurs** : CRUD complet avec rôles (admin, user)
- **Métriques LLM** : Suivi des appels API, tokens consommés, coûts
- **Logs de sécurité** : Audit des actions sensibles
- **Paramètres** : Configuration LLM, collecte de données, etc.

### Sécurité
- **Authentification JWT** : Tokens sécurisés avec refresh automatique
- **Protection CSRF** : Double-submit cookie pattern
- **Rate limiting** : Protection contre les abus par endpoint
- **Helmet** : Headers de sécurité HTTP
- **Blacklist tokens** : Invalidation des tokens à la déconnexion

## 📋 Prérequis

- **Node.js** >= 18.0.0
- **PostgreSQL** >= 18
- **npm** >= 9.0.0

## 🛠️ Installation

### 1. Cloner le projet

```bash
git clone <repository-url>
cd ResumeConverter
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer les variables d'environnement

Créer un fichier `.env` à la racine :

```env
# Base de données PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=resumeconverter
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-password

# Sécurité (minimum 32 caractères chacun)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
REFRESH_TOKEN_SECRET=your-refresh-token-secret-min-32-chars
CSRF_SECRET=your-csrf-secret-key-min-32-chars

# APIs LLM (optionnel)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Serveur
HTTPS_ENABLED=true
HTTPS_PORT=3443
```

### 4. Initialiser la base de données

```bash
# Créer la base de données
psql -U postgres -c "CREATE DATABASE resume_converter;"

# Exécuter le script de création
psql -U postgres -d resume_converter -f database/create_database.sql
```

### 5. Démarrer l'application

```bash
# Démarrage rapide (tous les services)
npm run quickstart

# Ou démarrer les services séparément :
npm run dev          # Frontend Vite (port 5173)
npm run start:proxy  # Backend API (port 3001)
npm run start:pdf    # Serveur PDF (port 3002)
```

## 📁 Structure du projet

```
ResumeConverter/
├── client/                       # Frontend React/TypeScript
│   ├── src/
│   │   ├── components/           # Composants React
│   │   │   ├── market/          # Radar du marché (carte, tendances)
│   │   │   ├── ResumeAnalysis/  # Analyse de CVs
│   │   │   ├── MissionsPage/    # Gestion des missions
│   │   │   ├── ResumesPage/     # Liste et gestion CVs
│   │   │   ├── SettingsPage/    # Paramètres application
│   │   │   ├── UsersManagement/ # Gestion utilisateurs
│   │   │   ├── ChatBot.tsx      # Assistant IA conversationnel
│   │   │   └── ...
│   │   ├── pages/               # Pages principales
│   │   │   ├── HomePage.tsx     # Dashboard accueil
│   │   │   ├── ResumesPage.tsx  # Liste des CVs
│   │   │   ├── MissionsPage.tsx # Gestion missions
│   │   │   ├── AdaptationsPage.tsx # Adaptations CV
│   │   │   ├── ProfileMatchingPage.tsx # Matching profil/mission
│   │   │   ├── FactsPage.tsx    # Faits du marché
│   │   │   ├── MetiersPage.tsx  # Référentiel ROME
│   │   │   ├── MetricsPage.tsx  # Métriques LLM
│   │   │   └── ...
│   │   ├── services/            # Services API frontend
│   │   ├── context/             # Contextes React (Auth)
│   │   ├── hooks/               # Hooks personnalisés
│   │   ├── i18n/                # Traductions (FR/EN)
│   │   ├── types/               # Types TypeScript
│   │   └── utils/               # Utilitaires
│   └── public/                  # Assets statiques
│
├── server/                       # Backend Node.js/Express
│   ├── routes/                  # Routes API
│   │   ├── auth.routes.js       # Authentification
│   │   ├── resumes.routes.js    # Gestion CVs
│   │   ├── missions.routes.js   # Gestion missions
│   │   ├── adaptations.routes.js # Adaptations CV
│   │   ├── marketRadar.routes.js # Radar du marché
│   │   ├── tags.routes.js       # Tags et compétences
│   │   ├── llm.routes.js        # Proxy LLM (OpenAI/Anthropic)
│   │   ├── firms.routes.js      # Gestion cabinets
│   │   ├── rome.routes.js       # Référentiel ROME
│   │   ├── metrics.routes.js    # Métriques
│   │   └── ...
│   ├── services/                # Services métier
│   │   ├── openai.service.js    # Intégration OpenAI
│   │   ├── llm.service.js       # Abstraction LLM
│   │   ├── marketTrends.service.js # Tendances marché
│   │   ├── franceTravail.service.js # API France Travail
│   │   ├── adzuna.service.js    # API Adzuna
│   │   ├── rome.service.js      # Service ROME
│   │   ├── profileMatching.service.js # Matching profils
│   │   ├── escoService.js       # Classification ESCO
│   │   └── ...
│   ├── database/                # Base de données
│   │   ├── migrations/          # Scripts de migration
│   │   └── create_database.sql  # Schéma initial
│   ├── middleware/              # Middlewares Express
│   ├── config/                  # Configuration
│   ├── utils/                   # Utilitaires (validation, etc.)
│   ├── tests/                   # Tests Vitest
│   └── proxy-server.js          # Point d'entrée serveur API
│
├── pdf-server/                   # Serveur génération PDF (Puppeteer)
│   └── server.cjs
│
├── docs/                         # Documentation
│   └── ANALYSE_ALTERNATIVES_LLM.md
│
├── scripts/                      # Scripts utilitaires
│   └── quickstart.js            # Démarrage rapide
│
├── docker/                       # Configuration Docker
└── uploads/                      # Fichiers uploadés
```

## 🔧 Scripts disponibles

| Script | Description |
|--------|-------------|
| `npm run dev` | Démarre le frontend Vite en mode développement (port 5173) |
| `npm run start:proxy` | Démarre le serveur API backend (port 3001) |
| `npm run start:pdf` | Démarre le serveur de génération PDF (port 3002) |
| `npm run quickstart` | Démarre tous les services en parallèle |
| `npm run quickstart:prod` | Démarre en mode production |
| `npm run build` | Build de production |
| `npm run test` | Lance les tests Vitest |
| `npm run test:watch` | Tests en mode watch |
| `npm run test:coverage` | Tests avec couverture |
| `npm run lint` | Vérifie le code avec ESLint |
| `npm run lint:fix` | Corrige automatiquement les erreurs ESLint |
| `npm run typecheck` | Vérifie les types TypeScript |
| `npm run backup:db` | Sauvegarde la base de données |
| `npm run knip` | Détecte le code inutilisé |

## 🗄️ Base de données

### Tables principales

- **users** : Utilisateurs et authentification (rôles admin/user)
- **resumes** : CVs stockés avec métadonnées et contenu analysé
- **missions** : Offres d'emploi et missions de recrutement
- **adaptations** : Versions de CV adaptées à une mission
- **templates** : Modèles de CV personnalisables
- **firms** : Cabinets de recrutement
- **market_trends** : Tendances du marché (tensions, embauches, BMO)
- **market_facts** : Faits du marché (offres d'emploi par région/métier)
- **metiers** : Référentiel des métiers ROME
- **tags** : Tags et compétences extraits des CVs
- **llm_metrics** : Métriques d'utilisation des LLMs
- **security_logs** : Logs d'audit de sécurité
- **settings** : Paramètres de l'application

### Maintenance

```bash
# Sauvegarde
npm run backup:db

# Restauration
psql -U postgres -d resume_converter < backup.sql
```

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
- `POST /api/resumes/upload` - Upload fichier CV
- `POST /api/resumes/:id/analyze` - Analyser un CV avec IA
- `POST /api/resumes/:id/improve` - Améliorer un CV avec IA

### Missions
- `GET /api/missions` - Liste des missions
- `POST /api/missions` - Créer une mission
- `GET /api/missions/:id` - Détails d'une mission
- `PUT /api/missions/:id` - Modifier une mission
- `DELETE /api/missions/:id` - Supprimer une mission

### Adaptations
- `GET /api/adaptations` - Liste des adaptations
- `POST /api/adaptations` - Créer une adaptation CV/Mission
- `GET /api/adaptations/:id` - Détails d'une adaptation

### Matching
- `POST /api/resumes/:id/match` - Analyser le matching CV/Mission

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
- `POST /api/llm/openai` - Proxy OpenAI (GPT-5, GPT-4o)
- `POST /api/llm/anthropic` - Proxy Anthropic (Claude)

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
```

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

### Métriques LLM
- Nombre d'appels par modèle
- Tokens consommés (input/output)
- Coûts estimés
- Temps de réponse moyen
- Taux d'erreur

## 🤖 Intégration LLM

L'application supporte plusieurs fournisseurs LLM :

### OpenAI
- **GPT-5.2** : Modèle principal (Responses API)
- **GPT-4o** : Alternative rapide
- **GPT-4o-mini** : Tâches simples

### Anthropic
- **Claude 4.6 Sonnet** : Qualité maximale
- **Claude 4.5 Sonnet** : Meilleur rapport qualité/prix
- **Claude 3.5 Sonnet** : Fallback économique

Configuration via les paramètres de l'application ou variables d'environnement.

## 🐳 Docker

L'application peut être déployée via Docker avec tous les services intégrés (PostgreSQL 18, Node.js, Google Chrome pour PDF).

```bash
# Build de l'image
docker build -t resumeconverter:latest .

# Lancer le conteneur
docker run -d \
    --name resumeconverter-app \
    -p 443:443 \
    -p 5433:5432 \
    --restart unless-stopped \
    resumeconverter:latest
```

**Accès** : https://localhost  
**Identifiants** : `admin@resumeconverter.local` / `admin123`

Voir le dossier `docker/` et `docker/README.md` pour les configurations détaillées.

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
