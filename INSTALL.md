# ResumeConverter - Guide d'Installation et de Lancement

Ce guide détaille les procédures d'installation et de lancement de ResumeConverter, que ce soit en mode développement local (hors Docker) ou en mode conteneurisé (Docker).

---

## Table des matières

1. [Prérequis](#prérequis)
2. [Installation hors Docker (Développement)](#installation-hors-docker-développement)
3. [Installation avec Docker (Production)](#installation-avec-docker-production)
4. [Configuration complète](#configuration-complète)
5. [Sauvegarde](#sauvegarde)
6. [Plan de Reprise d'Activité (PRA)](#plan-de-reprise-dactivité-pra)
7. [Dépannage](#dépannage)

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

### Prérequis OCR hors Docker

Pour supporter correctement les **PDFs scannés / image** hors Docker, l'installation locale doit fournir les binaires suivants dans le `PATH` :

| Composant | Rôle | Vérification |
|-----------|------|--------------|
| `tesseract` | OCR principal | `tesseract --version` |
| `pdftoppm` | Rendu PDF vers image avant OCR | `pdftoppm -v` |

Notes :
- sous Windows, installez **Tesseract OCR** et **Poppler for Windows** puis ajoutez leurs dossiers `bin` au `PATH`
- si ces binaires ne sont pas disponibles, l'application bascule sur un fallback `tesseract.js`, moins robuste pour les PDFs image bruités
- le support OCR local est surtout pertinent pour les imports PDF scannés; les fichiers DOCX/DOC n'en ont pas besoin

### Prérequis Docker

| Composant | Version minimale | Vérification |
|-----------|------------------|--------------|
| Docker | 20.x ou supérieur | `docker --version` |

### Chaîne OCR Docker

En Docker, l'image installe automatiquement les dépendances OCR serveur :

- `tesseract-ocr`
- `tesseract-ocr-fra`
- `tesseract-ocr-eng`
- `poppler-utils` (`pdftoppm`)
- pile Python avancée pour les scans difficiles :
  - `python3`
  - `python3-opencv`
  - `python3-numpy`
  - `paddlepaddle`
  - `paddleocr`

Il n'y a donc **pas de prérequis OCR supplémentaires** côté hôte Docker.

---

## Installation hors Docker (Développement)

### Étape 1 : Cloner le dépôt

```bash
git clone https://github.com/votre-repo/ResumeConverter.git
cd ResumeConverter
git checkout develop
```

> **Note** : La branche active de développement est `develop`. Assurez-vous de bien basculer sur cette branche après le clonage.

### Étape 2 : Installer les dépendances

```bash
npm install
```

Cette commande installe toutes les dépendances du projet (serveur, client, PDF server).

### Étape 2 bis : vérifier la chaîne OCR locale

Si vous prévoyez de tester des **CVs PDF scannés** hors Docker :

```bash
# Vérifier le moteur OCR
tesseract --version

# Vérifier le rendu PDF -> image
pdftoppm -v
```

Si une des commandes échoue :
- l'extraction de texte natif PDF continuera de fonctionner
- mais les PDFs image/bruités seront traités avec un fallback moins fiable

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
REFRESH_TOKEN_SECRET=REMPLACEZ_PAR_UN_AUTRE_SECRET_DE_64_CARACTERES
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

# MiniMax
# Obtenir une clé: https://platform.minimax.io/
MINIMAX_API_KEY=sk-api-votre-cle-minimax
# Optionnel: surcharger les endpoints compatibles OpenAI / Anthropic
MINIMAX_OPENAI_BASE_URL=https://api.minimax.io/v1
MINIMAX_ANTHROPIC_BASE_URL=https://api.minimax.io/anthropic

# Ollama distant
# URL de votre instance Ollama externe. Ollama n'est pas embarquée dans le conteneur ResumeConverter.
# Exemples: http://192.168.1.20:11434 ou https://ollama.votre-domaine.tld
OLLAMA_BASE_URL=http://192.168.1.20:11434
# Timeout global de secours pour les appels Ollama (en ms)
OLLAMA_REQUEST_TIMEOUT_MS=300000

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

#### 4.2 Initialiser ou migrer le schéma

Le schéma et les migrations ne sont plus appliqués au démarrage du serveur web. Exécutez la migration explicitement avant le premier lancement et après chaque mise à jour :

```bash
npm run migrate
```

Windows :
```batch
migrate-server.bat
```

Ou via pgAdmin :
1. Connectez-vous a votre base resumeconverter
2. Ouvrez Query Tool
3. Lancez `npm run migrate` ou `migrate-server.bat` : sur une base vide, le script applique automatiquement `docker/schema.sql`, puis les migrations applicatives restantes. `docker/init-db.sql` reste uniquement un relais de compatibilite vers ce schema.

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
git checkout develop
```

> **Note** : La branche active de développement est `develop`. Assurez-vous de bien basculer sur cette branche après le clonage.

### Étape 2 : Placer le fichier `.env.docker`

⚠️ **Étape obligatoire** : Le fichier `.env.docker` doit être présent à la racine du projet **avant** de construire l'image Docker. Ce fichier est utilisé par le `Dockerfile` comme fichier de configuration (`.env`) à l'intérieur du conteneur.

Ce fichier n'est **pas versionné** (il est dans `.gitignore`) car il contient des secrets (clés API, mots de passe). Vous devez le créer manuellement ou le récupérer auprès de l'administrateur du projet.

```bash
# Vérifier que le fichier existe
ls .env.docker    # Linux/Mac
dir .env.docker   # Windows
```

Le fichier `.env.docker` a la même structure que le fichier `.env` décrit dans la section [Installation hors Docker > Étape 3](#étape-3--configurer-lenvironnement), avec les valeurs adaptées à l'environnement Docker :

```env
# Valeurs spécifiques Docker (la base de données est locale au conteneur)
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_DB=resumeconverter
POSTGRES_USER=resumeconverter
POSTGRES_PASSWORD=votre_mot_de_passe

# Sécurité (minimum 32 caractères chacun)
JWT_SECRET=votre-secret-jwt-min-32-caracteres
REFRESH_TOKEN_SECRET=votre-secret-refresh-min-32-caracteres
CSRF_SECRET=votre-secret-csrf-min-32-caracteres

# Mode production
NODE_ENV=production
HTTPS_ENABLED=true
HTTPS_PORT=3443

# APIs LLM (optionnel)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Google OAuth (optionnel)
GOOGLE_CLIENT_ID=votre-client-id
GOOGLE_CLIENT_SECRET=votre-client-secret
MAIL_TOKEN_ENCRYPTION_KEY=votre-cle-64-hex
```

> **Sans ce fichier, la commande `docker-build.bat` échouera** avec une erreur `COPY .env.docker ./.env` car le Dockerfile s'attend à trouver ce fichier.

### Étape 3 : Construire et lancer (méthode simple)

#### Windows - Scripts .bat (recommandé)

Des scripts simples sont disponibles à la racine du projet :

```batch
docker-build.bat   # Construire l'image Docker (⚠️ nécessite .env.docker)
docker-run.bat     # Démarrer le conteneur (⚠️ nécessite un terminal Administrateur)
```

> ⚠️ **Terminal Administrateur requis** : Le script `docker-run.bat` configure automatiquement une règle de redirection de port (`netsh interface portproxy`) pour l'accès externe via Cloudflare (port 443 → localhost:3443). Cette commande `netsh` nécessite les droits Administrateur.
>
> **Pour ouvrir un terminal Administrateur :**
> - Clic droit sur **CMD** ou **PowerShell** → **Exécuter en tant qu'administrateur**
> - Ou : touche Windows → taper `cmd` → `Ctrl+Shift+Entrée`
>
> Si le script est lancé sans droits admin, le conteneur démarrera normalement mais la redirection de port pour l'accès externe (internet/Cloudflare) ne sera pas configurée. L'accès local via `https://localhost:3443` fonctionnera dans tous les cas.

C'est tout ! L'application sera accessible sur https://localhost:3443

#### Windows - PowerShell (options avancées)

```powershell
# Avec les clés API (optionnel)
$env:OPENAI_API_KEY = "sk-..."
$env:ANTHROPIC_API_KEY = "sk-ant-..."

.\docker\docker-build.ps1 -Run
```

#### Linux/Mac

```bash
chmod +x docker/docker-build.sh
./docker/docker-build.sh build
./docker/docker-build.sh run
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

#### Windows - Scripts .bat (simples)

| Script | Description |
|--------|-------------|
| `docker-build.bat` | Construire l'image Docker |
| `docker-run.bat` | Démarrer le conteneur (⚠️ terminal Admin) |
| `docker-migrate.bat` | Lancer les migrations Docker a la demande |
| `docker-stop.bat` | Arrêter et supprimer le conteneur |
| `docker-logs.bat` | Voir les logs en temps reel |
| `docker-shell.bat` | Ouvrir un shell dans le conteneur |
| `migrate-server.bat` | Lancer les migrations hors Docker |

#### Windows - PowerShell (avancé)

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

### Identifiants PostgreSQL Docker

Les identifiants de la base de données intégrée au conteneur sont :

| Variable | Valeur |
|----------|--------|
| `POSTGRES_HOST` | `127.0.0.1` (interne au conteneur) |
| `POSTGRES_PORT` | `5432` (interne) / `5433` (externe) |
| `POSTGRES_DB` | `resumeconverter` |
| `POSTGRES_USER` | `resumeconverter` |
| `POSTGRES_PASSWORD` | Voir `Dockerfile` (variable `POSTGRES_PASSWORD`) |

> **Note** : Ces identifiants sont utilisés en interne par le conteneur. Pour une sécurité maximale en production, vous pouvez les surcharger via des variables d'environnement au lancement.

### Persistance des données

Les données sont automatiquement persistées dans des **répertoires locaux** (pas des volumes Docker) :

| Chemin local | Chemin conteneur | Description |
|--------------|------------------|-------------|
| `./data/postgresql` | `/var/lib/postgresql/18/main` | **Base de données PostgreSQL 18** |
| `./uploads` | `/app/uploads` | Fichiers CV uploadés |
| `./logs` | `/app/logs` | Logs applicatifs |

✅ **Les données PostgreSQL sont persistantes** : Elles sont stockées dans le répertoire `./data/postgresql/`. Vos données sont conservées même si :
- Le conteneur est supprimé et recréé
- L'image Docker est reconstruite
- Docker est redémarré

#### Gestion des données PostgreSQL

```bash
# Sauvegarder les données (exporter la base)
docker exec resumeconverter-app pg_dump -U resumeconverter resumeconverter > backup.sql

# Restaurer les données
docker exec -i resumeconverter-app psql -U resumeconverter resumeconverter < backup.sql

# Voir la taille du répertoire de données
du -sh ./data/postgresql

# ⚠️ Supprimer les données (PERTE DE DONNÉES !)
rm -rf ./data/postgresql
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
| `REFRESH_TOKEN_SECRET` | Secret refresh token (min 32 car.) | Même commande |
| `CSRF_SECRET` | Secret CSRF | Même commande |

#### Variables recommandées (fonctionnalités IA)

| Variable | Description | Où l'obtenir |
|----------|-------------|--------------|
| `OPENAI_API_KEY` | Clé API OpenAI (GPT-4/GPT-5) | https://platform.openai.com/api-keys |
| `ANTHROPIC_API_KEY` | Clé API Anthropic (Claude) | https://console.anthropic.com/ |
| `MINIMAX_API_KEY` | Clé API MiniMax | https://platform.minimax.io/ |
| `OLLAMA_BASE_URL` | URL de l'instance Ollama distante | Votre instance Ollama auto-hébergée |

#### Variables optionnelles par fonctionnalité

| Fonctionnalité | Variables requises |
|----------------|-------------------|
| **Google SSO** | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_AUTH_REDIRECT_URI` |
| **Envoi email Gmail** | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `MAIL_TOKEN_ENCRYPTION_KEY` |
| **Emails GDPR via SMTP** | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` |
| **Market Radar FR** | `FRANCE_TRAVAIL_CLIENT_ID`, `FRANCE_TRAVAIL_CLIENT_SECRET` |
| **Market Radar INT** | `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` |

### Notes LLM supplémentaires

- **MiniMax** : le provider `minimax` utilise `MINIMAX_API_KEY`. Les URLs `MINIMAX_OPENAI_BASE_URL` et `MINIMAX_ANTHROPIC_BASE_URL` sont optionnelles.
- **Ollama** : seule une instance **distante** est supportée. ResumeConverter n'embarque plus de runtime Ollama dans le conteneur.
- Si vous utilisez Ollama, configurez l'URL distante dans `OLLAMA_BASE_URL` et aussi dans les paramètres de l'application (`ollamaBaseUrl`).
- Avec Ollama, l'application peut fonctionner sans `llmModel` explicite si l'instance distante impose déjà son modèle.

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

## Sauvegarde

ResumeConverter intègre un système de sauvegarde automatique de la base de données vers un serveur FTP/SFTP distant.

### Configuration de la sauvegarde

La configuration se fait depuis l'interface d'administration : **Menu > Sauvegarde** (accessible aux administrateurs uniquement).

#### Paramètres de connexion

| Paramètre | Description |
|-----------|-------------|
| **Protocole** | FTP, FTPS (FTP over TLS) ou SFTP (SSH) |
| **Mode TLS** | Explicite (AUTH TLS - recommandé), Implicite (port 990), ou Aucun |
| **Hôte** | Adresse du serveur FTP/SFTP |
| **Port** | Port de connexion (21 pour FTP/FTPS, 22 pour SFTP) |
| **Utilisateur** | Nom d'utilisateur FTP/SFTP |
| **Mot de passe** | Mot de passe (stocké chiffré en base) |
| **Chemin distant** | Répertoire de destination sur le serveur (ex: `/backups`) |

#### Planification des sauvegardes

Trois types de planification sont disponibles :

| Type | Description | Rétention par défaut |
|------|-------------|---------------------|
| **Quotidienne** | Tous les jours à l'heure configurée | 7 jours |
| **Hebdomadaire** | Un jour par semaine | 4 semaines |
| **Mensuelle** | Un jour par mois | 12 mois |

### Sauvegarde manuelle

Depuis l'interface **Sauvegarde > Configuration**, cliquez sur **"Exécuter maintenant"** pour lancer une sauvegarde immédiate.

### Sauvegarde via ligne de commande

```bash
# Hors Docker - Sauvegarde PostgreSQL manuelle
pg_dump -U resumeconverter -d resumeconverter -F c -f backup_$(date +%Y%m%d_%H%M%S).dump

# Docker - Sauvegarde depuis le conteneur
docker exec resumeconverter-app pg_dump -U resumeconverter resumeconverter > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restauration

#### Depuis l'interface

1. Accédez à **Sauvegarde > Restauration**
2. Sélectionnez le fichier de sauvegarde dans la liste
3. Cliquez sur **"Restaurer"**
4. Confirmez l'opération (⚠️ Cette action écrase toutes les données actuelles)

#### Via ligne de commande

```bash
# Hors Docker - Restauration PostgreSQL
pg_restore -U resumeconverter -d resumeconverter -c backup.dump

# Docker - Restauration depuis un fichier SQL
docker exec -i resumeconverter-app psql -U resumeconverter resumeconverter < backup.sql
```

### Bonnes pratiques

- ✅ **Testez régulièrement** la connexion FTP/SFTP depuis l'interface
- ✅ **Vérifiez les sauvegardes** en consultant l'historique
- ✅ **Utilisez FTPS ou SFTP** pour sécuriser les transferts
- ✅ **Configurez plusieurs types** de sauvegarde (quotidienne + hebdomadaire)
- ✅ **Stockez les sauvegardes** sur un serveur distant (pas sur la même machine)
- ⚠️ **Testez la restauration** sur un environnement de test avant la production

---

## Plan de Reprise d'Activité (PRA)

Ce chapitre décrit les procédures de reprise d'activité en cas d'incident majeur.

### Scénarios de sinistre

| Scénario | Impact | Temps de reprise estimé |
|----------|--------|------------------------|
| Panne serveur | Service indisponible | 15-30 min (avec Docker) |
| Corruption base de données | Perte de données | 30-60 min |
| Perte totale du serveur | Perte complète | 1-2 heures |
| Cyberattaque / Ransomware | Données compromises | 2-4 heures |

### Prérequis pour la reprise

1. **Sauvegardes récentes** sur un serveur FTP/SFTP distant
2. **Documentation à jour** (ce guide, credentials)
3. **Accès à un nouveau serveur** avec Docker installé
4. **Fichier `.env`** sauvegardé séparément (contient les secrets)

### Procédure de reprise complète

#### Étape 1 : Préparer le nouveau serveur

```bash
# Installer Docker
curl -fsSL https://get.docker.com | sh

# Cloner le dépôt
git clone https://github.com/votre-repo/ResumeConverter.git
cd ResumeConverter
git checkout develop
```

> **Note** : La branche active est `develop`.

#### Étape 2 : Restaurer la configuration

```bash
# Copier le fichier .env sauvegardé
cp /chemin/vers/backup/.env .

# Vérifier les variables critiques
cat .env | grep -E "(POSTGRES_|JWT_|CSRF_)"
```

#### Étape 3 : Construire et démarrer l'application

```bash
# Windows
.\docker\docker-build.ps1 -Build
.\docker\docker-build.ps1 -Run

# Linux/Mac
./docker/docker-build.sh build
./docker/docker-build.sh run
```

#### Étape 4 : Restaurer la base de données

```bash
# Télécharger la dernière sauvegarde depuis le serveur FTP
# (ou utiliser l'interface si l'application est accessible)

# Restaurer depuis un fichier SQL
docker exec -i resumeconverter-app psql -U resumeconverter resumeconverter < backup.sql

# Ou depuis un dump binaire
docker cp backup.dump resumeconverter-app:/tmp/
docker exec resumeconverter-app pg_restore -U resumeconverter -d resumeconverter -c /tmp/backup.dump
```

#### Étape 5 : Vérifier le fonctionnement

```bash
# Vérifier les logs
docker logs resumeconverter-app --tail 50

# Tester l'accès
curl -k https://localhost:3443/api/health
```

### Checklist de reprise

- [ ] Nouveau serveur opérationnel avec Docker
- [ ] Dépôt Git cloné
- [ ] Fichier `.env` restauré avec les bons secrets
- [ ] Image Docker construite
- [ ] Conteneur démarré
- [ ] Base de données restaurée depuis la sauvegarde
- [ ] Connexion utilisateur testée
- [ ] Fonctionnalités critiques vérifiées
- [ ] DNS/Reverse proxy reconfiguré (si applicable)
- [ ] Certificats SSL installés (si applicable)

### Contacts d'urgence

| Rôle | Contact | Responsabilité |
|------|---------|----------------|
| Administrateur système | À définir | Infrastructure, Docker |
| DBA | À définir | Base de données, restauration |
| Responsable applicatif | À définir | Configuration, tests |

### Tests de PRA recommandés

| Fréquence | Test | Objectif |
|-----------|------|----------|
| Mensuel | Restauration sur environnement de test | Vérifier l'intégrité des sauvegardes |
| Trimestriel | Simulation de panne complète | Mesurer le temps de reprise réel |
| Annuel | Exercice PRA complet | Former l'équipe, identifier les lacunes |

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
psql -U resumeconverter -d resumeconverter -f docker/schema.sql
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
| Schema canonique de base de donnees | `docker/schema.sql` |

---

## Support

Pour toute question ou problème :
1. Consultez la section [Dépannage](#dépannage)
2. Vérifiez les logs applicatifs
3. Ouvrez une issue sur le dépôt GitHub

---

*Dernière mise à jour : 19 Mars 2026*




