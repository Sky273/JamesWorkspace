# ResumeConverter - Guide d'Installation et de Lancement

Ce guide détaille les procédures d'installation et de lancement de ResumeConverter, que ce soit en mode développement local (hors Docker) ou en mode conteneurisé (Docker).

---

## Table des matières

1. [Prérequis](#prérequis)
2. [Installation hors Docker (Développement)](#installation-hors-docker-développement)
3. [Installation avec Docker (Production)](#installation-avec-docker-production)
4. [Configuration complète](#configuration-complète)
5. [Dépannage](#dépannage)

---

## Prérequis

### Prérequis communs

| Composant | Version minimale | Vérification |
|-----------|------------------|--------------|
| Git | 2.x | `git --version` |

### Prérequis hors Docker

| Composant | Version minimale | Vérification |
|-----------|------------------|--------------|
| Node.js | 18.x ou supérieur | `node --version` |
| npm | 9.x ou supérieur | `npm --version` |
| PostgreSQL | 18.x | `psql --version` |

### Prérequis Docker

| Composant | Version minimale | Vérification |
|-----------|------------------|--------------|
| Docker | 20.x ou supérieur | `docker --version` |

---

## Installation hors Docker (Développement)

### Étape 1 : Cloner le dépôt

```bash
git clone https://github.com/votre-repo/ResumeConverter.git
cd ResumeConverter
```

### Étape 2 : Installer les dépendances

```bash
npm install
```

Cette commande installe toutes les dépendances du projet (serveur, client, PDF server).

### Étape 3 : Configurer l'environnement

#### 3.1 Créer le fichier `.env`

Créez un fichier `.env` à la racine du projet :

```bash
# Windows
copy NUL .env

# Linux/Mac
touch .env
```

#### 3.2 Configuration complète du fichier `.env`

Copiez et adaptez la configuration suivante dans votre fichier `.env` :

```env
# ==============================================================================
# RESUMECONVERTER - CONFIGURATION ENVIRONNEMENT
# ==============================================================================
# Ce fichier contient toutes les variables d'environnement nécessaires.
# Les variables marquées [REQUIS] sont obligatoires.
# Les variables marquées [OPTIONNEL] peuvent être omises.
# ==============================================================================

# ==============================================================================
# BASE DE DONNÉES POSTGRESQL [REQUIS]
# ==============================================================================
# Connexion à la base de données PostgreSQL

POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=resumeconverter
POSTGRES_USER=resumeconverter
POSTGRES_PASSWORD=votre_mot_de_passe_securise

# Pool de connexions (optionnel)
POSTGRES_MAX_CONNECTIONS=10

# SSL pour PostgreSQL (production)
# Valeurs: true (SSL strict), relaxed (SSL sans validation cert), false (pas de SSL)
POSTGRES_SSL=false

# Retry configuration (optionnel)
POSTGRES_MAX_RETRIES=5
POSTGRES_RETRY_DELAY=1000

# ==============================================================================
# SÉCURITÉ - SECRETS JWT ET CSRF [REQUIS]
# ==============================================================================
# IMPORTANT: Générez des secrets uniques et sécurisés (minimum 32 caractères)
# Commande pour générer un secret:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

JWT_SECRET=REMPLACEZ_PAR_UN_SECRET_DE_64_CARACTERES_HEXADECIMAUX
JWT_REFRESH_SECRET=REMPLACEZ_PAR_UN_AUTRE_SECRET_DE_64_CARACTERES
REFRESH_TOKEN_SECRET=REMPLACEZ_PAR_ENCORE_UN_AUTRE_SECRET_64_CHARS
CSRF_SECRET=REMPLACEZ_PAR_UN_SECRET_CSRF_DE_64_CARACTERES_HEX

# ==============================================================================
# SERVEUR [OPTIONNEL]
# ==============================================================================
# Configuration des ports et mode d'exécution

NODE_ENV=development
# Valeurs: development, production

PROXY_PORT=3001
PDF_SERVER_PORT=3002
HTTPS_PORT=3443
HTTPS_ENABLED=false

# Répertoire des uploads (relatif à la racine du projet)
UPLOAD_DIR=./uploads

# ==============================================================================
# CORS - ORIGINES AUTORISÉES [OPTIONNEL]
# ==============================================================================
# Liste des origines autorisées, séparées par des virgules
# Par défaut: localhost sur les ports de développement

ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3001,https://localhost:3443

# ==============================================================================
# INTELLIGENCE ARTIFICIELLE - CLÉS API [OPTIONNEL]
# ==============================================================================
# Au moins une clé API est nécessaire pour l'analyse et l'amélioration des CV

# OpenAI (GPT-4, GPT-4o)
# Obtenir une clé: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-votre-cle-openai

# Anthropic (Claude)
# Obtenir une clé: https://console.anthropic.com/
ANTHROPIC_API_KEY=sk-ant-votre-cle-anthropic

# ==============================================================================
# GOOGLE OAUTH - AUTHENTIFICATION SSO [OPTIONNEL]
# ==============================================================================
# Pour activer "Se connecter avec Google" et l'envoi d'emails via Gmail
# Configurer dans: https://console.cloud.google.com/

GOOGLE_CLIENT_ID=votre-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=votre-client-secret

# URIs de redirection OAuth (adapter selon votre domaine)
GOOGLE_AUTH_REDIRECT_URI=http://localhost:3001/api/auth/google/callback
GOOGLE_REDIRECT_URI=http://localhost:3001/api/mail/callback/gmail
GOOGLE_GDPR_REDIRECT_URI=http://localhost:3001/api/gdpr/mail/callback

# Clé de chiffrement pour les tokens OAuth stockés (64 caractères hex)
# Générer avec: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
MAIL_TOKEN_ENCRYPTION_KEY=REMPLACEZ_PAR_64_CARACTERES_HEXADECIMAUX

# ==============================================================================
# SMTP - ENVOI D'EMAILS GDPR [OPTIONNEL]
# ==============================================================================
# Configuration SMTP pour l'envoi automatique des emails de consentement GDPR
# Alternative à Gmail OAuth pour les emails GDPR

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=votre-email@example.com
SMTP_PASSWORD=votre-mot-de-passe-smtp
SMTP_FROM_NAME=ResumeConverter
SMTP_FROM_EMAIL=noreply@example.com

# ==============================================================================
# MARKET RADAR - FRANCE TRAVAIL API [OPTIONNEL]
# ==============================================================================
# Pour les statistiques du marché de l'emploi français
# S'inscrire sur: https://francetravail.io/

FRANCE_TRAVAIL_CLIENT_ID=votre-client-id
FRANCE_TRAVAIL_CLIENT_SECRET=votre-client-secret
FRANCE_TRAVAIL_API_URL=https://api.francetravail.io/partenaire/offresdemploi/v2

# ==============================================================================
# MARKET RADAR - ADZUNA API [OPTIONNEL]
# ==============================================================================
# Pour les statistiques du marché de l'emploi international
# S'inscrire sur: https://developer.adzuna.com/signup

ADZUNA_APP_ID=votre-app-id
ADZUNA_APP_KEY=votre-app-key

# ==============================================================================
# FIN DE LA CONFIGURATION
# ==============================================================================
```

### Étape 4 : Configurer PostgreSQL

#### 4.1 Créer la base de données

Connectez-vous à PostgreSQL et créez la base :

```sql
-- Se connecter à PostgreSQL
psql -U postgres

-- Créer l'utilisateur (si nécessaire)
CREATE USER resumeconverter WITH PASSWORD 'votre_mot_de_passe';

-- Créer la base de données
CREATE DATABASE resumeconverter OWNER resumeconverter;

-- Accorder les privilèges
GRANT ALL PRIVILEGES ON DATABASE resumeconverter TO resumeconverter;

-- Quitter
\q
```

#### 4.2 Initialiser le schéma

Exécutez le script d'initialisation :

```bash
psql -U resumeconverter -d resumeconverter -f docker/init-db.sql
```

Ou via pgAdmin :
1. Connectez-vous à votre base `resumeconverter`
2. Ouvrez Query Tool
3. Ouvrez et exécutez le fichier `docker/init-db.sql`

### Étape 5 : Lancer l'application

#### Option A : Lancement rapide (recommandé)

```bash
npm run quickstart
```

Cette commande :
- Vérifie les prérequis
- Installe les dépendances si nécessaire
- Vérifie la connexion à la base de données
- Lance tous les serveurs (Proxy, PDF, Vite)

#### Option B : Lancement manuel

Ouvrez 3 terminaux :

**Terminal 1 - Serveur Proxy (API) :**
```bash
npm run start:proxy
```

**Terminal 2 - Serveur PDF :**
```bash
npm run start:pdf
```

**Terminal 3 - Frontend (développement) :**
```bash
npm run dev
```

### Étape 6 : Accéder à l'application

| Service | URL |
|---------|-----|
| Frontend (dev) | http://localhost:5173 |
| API | http://localhost:3001/api |
| Documentation API | http://localhost:3001/api/docs/ui |
| Health Check | http://localhost:3001/health |

**Identifiants par défaut :**
- Email : `admin@resumeconverter.local`
- Mot de passe : `admin123`

⚠️ **Changez ces identifiants immédiatement après la première connexion !**

---

## Installation avec Docker (Production)

### Étape 1 : Cloner le dépôt

```bash
git clone https://github.com/votre-repo/ResumeConverter.git
cd ResumeConverter
```

### Étape 2 : Construire l'image Docker

#### Windows (PowerShell)

```powershell
.\docker\docker-build.ps1 -Build
```

#### Linux/Mac

```bash
chmod +x docker/docker-build.sh
./docker/docker-build.sh build
```

#### Commande Docker directe

```bash
docker build -t resumeconverter:latest .
```

### Étape 3 : Lancer le conteneur

#### Windows (PowerShell)

```powershell
# Avec les clés API (optionnel)
$env:OPENAI_API_KEY = "sk-..."
$env:ANTHROPIC_API_KEY = "sk-ant-..."

.\docker\docker-build.ps1 -Run
```

#### Linux/Mac

```bash
# Avec les clés API (optionnel)
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."

./docker/docker-build.sh run
```

#### Commande Docker directe

```bash
# Créer le volume pour la persistance PostgreSQL
docker volume create resumeconverter-pgdata

# Lancer le conteneur
docker run -d \
    --name resumeconverter-app \
    -p 3443:3443 \
    -e OPENAI_API_KEY="votre-clé-openai" \
    -e ANTHROPIC_API_KEY="votre-clé-anthropic" \
    -e JWT_SECRET="secret-jwt-production-minimum-32-caracteres-hexadecimaux" \
    -e JWT_REFRESH_SECRET="secret-refresh-production-minimum-32-caracteres" \
    -e REFRESH_TOKEN_SECRET="secret-token-production-minimum-32-caracteres" \
    -e CSRF_SECRET="secret-csrf-production-minimum-32-caracteres" \
    -e GOOGLE_CLIENT_ID="votre-client-id.apps.googleusercontent.com" \
    -e GOOGLE_CLIENT_SECRET="votre-client-secret" \
    -e MAIL_TOKEN_ENCRYPTION_KEY="64-caracteres-hexadecimaux-pour-chiffrement" \
    -v resumeconverter-pgdata:/var/lib/postgresql/18/main \
    -v ./uploads:/app/uploads \
    -v ./logs:/app/logs \
    --restart unless-stopped \
    resumeconverter:latest
```

> **Note** : Les variables `GOOGLE_*` et `MAIL_TOKEN_ENCRYPTION_KEY` sont optionnelles (nécessaires uniquement pour SSO Google et envoi d'emails via Gmail).

### Étape 4 : Accéder à l'application

| Service | URL |
|---------|-----|
| Application | https://localhost:3443 |
| Health Check | https://localhost:3443/health |

**Identifiants par défaut :**
- Email : `admin@resumeconverter.local`
- Mot de passe : `admin123`

⚠️ **Changez ces identifiants immédiatement après la première connexion !**

### Commandes Docker utiles

#### Windows (PowerShell)

| Commande | Description |
|----------|-------------|
| `.\docker\docker-build.ps1 -Build` | Construire l'image |
| `.\docker\docker-build.ps1 -Run` | Démarrer le conteneur |
| `.\docker\docker-build.ps1 -Stop` | Arrêter le conteneur |
| `.\docker\docker-build.ps1 -Logs` | Voir les logs |
| `.\docker\docker-build.ps1 -Shell` | Ouvrir un shell dans le conteneur |
| `.\docker\docker-build.ps1 -Clean` | Supprimer conteneur et image |

#### Linux/Mac

| Commande | Description |
|----------|-------------|
| `./docker/docker-build.sh build` | Construire l'image |
| `./docker/docker-build.sh run` | Démarrer le conteneur |
| `./docker/docker-build.sh stop` | Arrêter le conteneur |
| `./docker/docker-build.sh logs` | Voir les logs |
| `./docker/docker-build.sh shell` | Ouvrir un shell dans le conteneur |
| `./docker/docker-build.sh clean` | Supprimer conteneur et image |

### Persistance des données

Les données sont automatiquement persistées via des volumes Docker :

| Volume/Chemin | Chemin conteneur | Description |
|---------------|------------------|-------------|
| `resumeconverter-pgdata` | `/var/lib/postgresql/18/main` | **Base de données PostgreSQL 18** |
| `./uploads` | `/app/uploads` | Fichiers CV uploadés |
| `./logs` | `/app/logs` | Logs applicatifs |

✅ **Les données PostgreSQL sont persistantes** : Elles sont stockées dans un volume Docker nommé `resumeconverter-pgdata`. Vos données sont conservées même si le conteneur est supprimé et recréé.

#### Gestion du volume PostgreSQL

```bash
# Voir les volumes Docker
docker volume ls

# Inspecter le volume de données
docker volume inspect resumeconverter-pgdata

# Sauvegarder les données (exporter la base)
docker exec resumeconverter-app pg_dump -U resumeconverter resumeconverter > backup.sql

# Restaurer les données
docker exec -i resumeconverter-app psql -U resumeconverter resumeconverter < backup.sql

# ⚠️ Supprimer le volume (PERTE DE DONNÉES !)
docker volume rm resumeconverter-pgdata
```

### Système de migrations automatiques

Le conteneur Docker gère automatiquement les migrations de base de données :

| Scénario | Comportement |
|----------|--------------|
| **Premier lancement** | Exécute le schéma complet + marque toutes les migrations comme appliquées |
| **Lancements suivants** | Vérifie et applique uniquement les nouvelles migrations |
| **Mise à jour de l'image** | Applique automatiquement les migrations manquantes |

Les migrations sont trackées dans la table `schema_migrations`.

---

## Configuration complète

### Récapitulatif des variables d'environnement

La configuration complète du fichier `.env` est détaillée dans la section [Installation hors Docker > Étape 3](#étape-3--configurer-lenvironnement).

#### Variables requises (minimum pour démarrer)

| Variable | Description | Comment générer |
|----------|-------------|-----------------|
| `POSTGRES_PASSWORD` | Mot de passe PostgreSQL | Choisir un mot de passe sécurisé |
| `JWT_SECRET` | Secret JWT (min 32 car.) | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `JWT_REFRESH_SECRET` | Secret refresh token | Même commande |
| `REFRESH_TOKEN_SECRET` | Secret token additionnel | Même commande |
| `CSRF_SECRET` | Secret CSRF | Même commande |

#### Variables recommandées (fonctionnalités IA)

| Variable | Description | Où l'obtenir |
|----------|-------------|--------------|
| `OPENAI_API_KEY` | Clé API OpenAI (GPT-4) | https://platform.openai.com/api-keys |
| `ANTHROPIC_API_KEY` | Clé API Anthropic (Claude) | https://console.anthropic.com/ |

#### Variables optionnelles par fonctionnalité

| Fonctionnalité | Variables requises |
|----------------|-------------------|
| **Google SSO** | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_AUTH_REDIRECT_URI` |
| **Envoi email Gmail** | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `MAIL_TOKEN_ENCRYPTION_KEY` |
| **Emails GDPR via SMTP** | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` |
| **Market Radar FR** | `FRANCE_TRAVAIL_CLIENT_ID`, `FRANCE_TRAVAIL_CLIENT_SECRET` |
| **Market Radar INT** | `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` |

### Configuration HTTPS (hors Docker)

Pour activer HTTPS en développement :

1. Générez des certificats SSL :
```bash
mkdir -p certificates
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout certificates/private.key \
    -out certificates/certificate.crt \
    -subj "/C=FR/ST=IDF/L=Paris/O=Dev/CN=localhost"
```

2. Configurez `client/.env` :
```env
VITE_HTTPS_ENABLED=true
```

3. Ajoutez dans `.env` :
```env
HTTPS_ENABLED=true
```

---

## Dépannage

### Problèmes courants

#### Le serveur ne démarre pas

1. Vérifiez que PostgreSQL est en cours d'exécution :
```bash
# Windows
pg_isready -h localhost -p 5432

# Linux/Mac
sudo systemctl status postgresql
```

2. Vérifiez les logs :
```bash
# Hors Docker
npm run start:proxy 2>&1 | tee server.log

# Docker
docker logs resumeconverter-app
```

#### Erreur de connexion à la base de données

1. Vérifiez les credentials dans `.env`
2. Testez la connexion :
```bash
psql -h localhost -U resumeconverter -d resumeconverter -c "SELECT 1;"
```

#### Port déjà utilisé

```bash
# Windows - Trouver le processus
netstat -ano | findstr :3001

# Tuer le processus (remplacez PID)
taskkill /F /PID <PID>

# Linux/Mac
lsof -i :3001
kill -9 <PID>
```

#### Erreur PDF generation

Vérifiez que Google Chrome/Puppeteer est correctement installé :
```bash
# Hors Docker
npx puppeteer browsers install chrome

# Docker - Vérifier dans le conteneur
docker exec -it resumeconverter-app google-chrome-stable --version

# Voir les logs du serveur PDF
docker exec resumeconverter-app cat /var/log/supervisor/pdf-server.err.log
```

### Logs et debugging

#### Hors Docker

Les logs sont affichés dans la console. Pour plus de détails :
```bash
DEBUG=* npm run start:proxy
```

#### Docker

```bash
# Logs en temps réel
docker logs -f resumeconverter-app

# Dernières 100 lignes
docker logs --tail 100 resumeconverter-app

# Accéder au conteneur
docker exec -it resumeconverter-app /bin/bash

# Vérifier PostgreSQL dans le conteneur
docker exec -it resumeconverter-app psql -U resumeconverter -d resumeconverter
```

### Réinitialiser la base de données

#### Hors Docker

```bash
# Supprimer et recréer la base
psql -U postgres -c "DROP DATABASE IF EXISTS resumeconverter;"
psql -U postgres -c "CREATE DATABASE resumeconverter OWNER resumeconverter;"
psql -U resumeconverter -d resumeconverter -f docker/init-db.sql
```

#### Docker

```bash
# Arrêter et supprimer le conteneur (données perdues !)
docker stop resumeconverter-app
docker rm resumeconverter-app

# Reconstruire et relancer
./docker/docker-build.sh build
./docker/docker-build.sh run
```

---

## Ressources

| Ressource | Chemin |
|-----------|--------|
| Guide utilisateur (FR) | `USER_GUIDE.md` |
| Guide utilisateur (EN) | `USER_GUIDE_EN.md` |
| Changelog | `CHANGELOG.md` |
| Documentation Docker | `docker/README.md` |
| Schéma de base de données | `docker/init-db.sql` |

---

## Support

Pour toute question ou problème :
1. Consultez la section [Dépannage](#dépannage)
2. Vérifiez les logs applicatifs
3. Ouvrez une issue sur le dépôt GitHub

---

*Dernière mise à jour : Mars 2026*
