# ResumeConverter - Guide d'Installation et de Lancement

Ce guide détaille les procédures d'installation et de lancement de ResumeConverter, que ce soit en mode développement local (hors Docker) ou en mode conteneurisé (Docker).

---

## Table des matières

1. [Prérequis](#prérequis)
2. [Installation hors Docker (Développement)](#installation-hors-docker-développement)
3. [Installation avec Docker (Production)](#installation-avec-docker-production)
4. [Configuration](#configuration)
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
| PostgreSQL | 14.x ou supérieur | `psql --version` |

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

Copiez le fichier d'exemple et modifiez-le :

```bash
cp .env.example .env
```

#### 3.2 Variables d'environnement requises

Éditez le fichier `.env` avec vos paramètres :

```env
# ============================================
# BASE DE DONNÉES POSTGRESQL
# ============================================
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=resumeconverter
POSTGRES_USER=votre_utilisateur
POSTGRES_PASSWORD=votre_mot_de_passe

# ============================================
# SÉCURITÉ (générez des secrets uniques !)
# ============================================
JWT_SECRET=votre_secret_jwt_minimum_32_caracteres
JWT_REFRESH_SECRET=votre_secret_refresh_minimum_32_caracteres
REFRESH_TOKEN_SECRET=votre_secret_token_minimum_32_caracteres
CSRF_SECRET=votre_secret_csrf_minimum_32_caracteres

# ============================================
# CLÉS API (optionnel mais recommandé)
# ============================================
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# ============================================
# SERVEUR
# ============================================
NODE_ENV=development
PORT=3001
PDF_SERVER_PORT=3002
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
docker run -d \
    --name resumeconverter-app \
    -p 3443:3443 \
    -e OPENAI_API_KEY="votre-clé" \
    -e ANTHROPIC_API_KEY="votre-clé" \
    -e JWT_SECRET="secret-jwt-production-minimum-32-caracteres" \
    -e JWT_REFRESH_SECRET="secret-refresh-production-minimum-32-caracteres" \
    -v ./uploads:/app/uploads \
    -v ./logs:/app/logs \
    --restart unless-stopped \
    resumeconverter:latest
```

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

| Chemin hôte | Chemin conteneur | Description |
|-------------|------------------|-------------|
| `./uploads` | `/app/uploads` | Fichiers CV uploadés |
| `./logs` | `/app/logs` | Logs applicatifs |

⚠️ **Note importante :** Les données PostgreSQL sont stockées à l'intérieur du conteneur. Pour la production, envisagez :
- Utiliser un service PostgreSQL externe
- Monter un volume pour `/var/lib/postgresql/14/main`

### Système de migrations automatiques

Le conteneur Docker gère automatiquement les migrations de base de données :

| Scénario | Comportement |
|----------|--------------|
| **Premier lancement** | Exécute le schéma complet + marque toutes les migrations comme appliquées |
| **Lancements suivants** | Vérifie et applique uniquement les nouvelles migrations |
| **Mise à jour de l'image** | Applique automatiquement les migrations manquantes |

Les migrations sont trackées dans la table `schema_migrations`.

---

## Configuration

### Variables d'environnement

#### Base de données

| Variable | Description | Défaut |
|----------|-------------|--------|
| `POSTGRES_HOST` | Hôte PostgreSQL | `127.0.0.1` |
| `POSTGRES_PORT` | Port PostgreSQL | `5432` |
| `POSTGRES_DB` | Nom de la base | `resumeconverter` |
| `POSTGRES_USER` | Utilisateur | `resumeconverter` |
| `POSTGRES_PASSWORD` | Mot de passe | `resumeconverter` |

#### Sécurité

| Variable | Description | Requis |
|----------|-------------|--------|
| `JWT_SECRET` | Secret pour les tokens JWT (min 32 car.) | ✅ |
| `JWT_REFRESH_SECRET` | Secret pour les refresh tokens | ✅ |
| `REFRESH_TOKEN_SECRET` | Secret additionnel | ✅ |
| `CSRF_SECRET` | Secret CSRF | ✅ |

#### API externes

| Variable | Description | Requis |
|----------|-------------|--------|
| `OPENAI_API_KEY` | Clé API OpenAI | Optionnel |
| `ANTHROPIC_API_KEY` | Clé API Anthropic (Claude) | Optionnel |

#### Serveur

| Variable | Description | Défaut |
|----------|-------------|--------|
| `NODE_ENV` | Environnement (`development`/`production`) | `development` |
| `PORT` | Port du serveur proxy | `3001` |
| `HTTPS_PORT` | Port HTTPS | `3443` |
| `PDF_SERVER_PORT` | Port du serveur PDF | `3002` |

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

Vérifiez que Chromium/Puppeteer est correctement installé :
```bash
# Hors Docker
npx puppeteer browsers install chrome

# Docker - Vérifier dans le conteneur
docker exec -it resumeconverter-app chromium-browser --version
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
