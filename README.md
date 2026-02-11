# Resume Converter

[![Version](https://img.shields.io/badge/version-1.5.7-blue.svg)](./CHANGELOG.md)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue.svg)](https://www.postgresql.org/)
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
- **PostgreSQL** >= 15
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
DATABASE_URL=postgresql://user:password@localhost:5432/resume_converter

# Sécurité
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
CSRF_SECRET=your-csrf-secret-key

# APIs LLM (optionnel)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Frontend (Vite)
VITE_API_URL=http://localhost:3001
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
├── src/                      # Code source frontend (React/TypeScript)
│   ├── components/           # Composants React
│   │   ├── market/          # Radar du marché (tendances, carte)
│   │   ├── ResumeAnalysis/  # Analyse de CVs
│   │   └── ...
│   ├── services/            # Services API frontend
│   ├── contexts/            # Contextes React (Auth, Theme)
│   └── locales/             # Traductions i18n
├── database/                 # Scripts SQL PostgreSQL
├── scripts/                  # Scripts utilitaires
├── proxy-server.js          # Serveur API Express
├── server.cjs               # Serveur génération PDF
└── dist/                    # Build de production
```

## 🔧 Scripts disponibles

| Script | Description |
|--------|-------------|
| `npm run dev` | Démarre le frontend en mode développement |
| `npm run start:proxy` | Démarre le serveur API backend |
| `npm run start:pdf` | Démarre le serveur de génération PDF |
| `npm run quickstart` | Démarre tous les services en parallèle |
| `npm run build` | Build de production |
| `npm run test` | Lance les tests |
| `npm run lint` | Vérifie le code avec ESLint |
| `npm run typecheck` | Vérifie les types TypeScript |
| `npm run backup:db` | Sauvegarde la base de données |

## 🗄️ Base de données

### Tables principales

- **users** : Utilisateurs et authentification
- **resumes** : CVs stockés avec métadonnées
- **templates** : Modèles de CV
- **market_trends** : Tendances du marché (tensions, embauches, etc.)
- **market_facts** : Faits du marché (offres d'emploi par région/métier)
- **metiers** : Référentiel des métiers ROME

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

### Radar du Marché
- `GET /api/market-radar/trends` - Tendances paginées
- `GET /api/market-radar/trends/all` - Toutes les tendances (carte)
- `GET /api/market-radar/trends/:id/metadata` - Metadata d'une tendance
- `GET /api/market-radar/facts` - Faits du marché
- `POST /api/market-radar/collect` - Collecter nouvelles données

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

### Caches monitorés
- ESCO Cache (compétences)
- Trends Cache (tendances marché)
- Facts Cache (faits marché)
- Métiers Cache (référentiel ROME)
- Tags Cache (tags extraits)

## 🔄 Changelog

Voir [CHANGELOG.md](./CHANGELOG.md) pour l'historique des versions.

## 📝 Licence

Projet privé - Tous droits réservés.

## 👥 Contributeurs

- Équipe Resume Converter
