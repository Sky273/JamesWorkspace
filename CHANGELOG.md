## v1.6.6 - 2026-03-01
### 🔧 Corrections & Améliorations

#### Token GDPR Global
- **Architecture corrigée** : Le token Gmail RGPD est maintenant **global** (pas par cabinet)
- **Nouvelle table** : `global_gdpr_mail_token` pour stocker un seul token pour toute l'application
- **Refresh automatique** : Token rafraîchi automatiquement chaque semaine via le scheduler
- **Retry intelligent** : Si Google rejette le token, refresh automatique et retry
- **Migration SQL** : `docker/migrations/add_global_gdpr_mail_token.sql`

#### Consentement RGPD
- **Statut 'error'** : Ajout de `'error'` comme valeur valide pour `consent_status`
- **Rappels fonctionnels** : Correction de l'appel `sendEmail()` pour les rappels de consentement
- **Migration SQL** : `docker/migrations/add_error_to_consent_status.sql`

#### Qualité du Code
- **Tests corrigés** : Correction des 4 tests cassés dans `health.routes.test.js` (mock `req.query`)
- **Whitelist SQL étendue** : Ajout de 12 tables manquantes dans `postgresHelpers.js`
- **Logging amélioré** : Remplacement des erreurs silencieuses par des logs `warn` dans `mailService.js`

#### UI Mobile
- **Menu hamburger** : Fond opaque (`bg-white`/`bg-gray-800`) pour une meilleure lisibilité
- **Backdrop blur** : Effet de flou sur l'arrière-plan du menu mobile

---

## v1.6.5 - 2026-02-28
### 🔒 Sécurité & Qualité du Code

#### Analyse de Sécurité Complète
- **Audit global** : Analyse exhaustive de l'application (authentification, autorisation, injection, CORS, rate limiting)
- **Points positifs confirmés** : Injection SQL protégée, XSS sanitisé, JWT sécurisé, bcrypt pour mots de passe

#### Protection Mémoire - Rate Limiting
- **Limite de taille** : Ajout de `MAX_RATE_LIMIT_ENTRIES = 10000` pour éviter les fuites mémoire
- **Pruning automatique** : Suppression de 10% des entrées les plus anciennes quand la limite est atteinte
- **Fichier** : `server/middleware/rateLimit.middleware.js`

#### Logs Structurés - Proxy Server
- **Migration console → safeLog** : Remplacement de 45 occurrences de `console.log/error` par `safeLog`
- **Handlers globaux** : `uncaughtException` et `unhandledRejection` utilisent maintenant `safeLog`
- **Startup/Shutdown** : Logs structurés avec métadonnées JSON pour `onServerStart()` et `gracefulShutdown()`
- **Fichier** : `server/proxy-server.js`

#### Métriques LLM
- **Tarifs Q1 2026** : Mise à jour des prix OpenAI (GPT-5.2) et Anthropic (Claude 4.6)
- **Tracking unifié** : Correction du double comptage dans `chatbot.routes.js`
- **Fichiers** : `server/services/metrics.service.js`, `server/services/llm.service.js`

#### Corrections Techniques
- **Erreurs silencieuses** : Remplacement de `catch { /* ignore */ }` par logging en niveau `debug`
- **Fichier** : `server/routes/resumes.routes.js`

---

## v1.6.4 - 2026-02-28
### 📧 Envoi Email des CVs Adaptés

#### Nouvelle Fonctionnalité : Envoi Email pour Adaptations
- **Bouton email** : Ajout du bouton "Envoyer par email" sur la page de consultation d'une adaptation
- **Pré-remplissage** : Client et contact pré-remplis automatiquement depuis la mission associée
- **Modal SendEmailModal** : Nouvelles props `prefilledClientId`, `prefilledContactId`, `missionTitle`, `isAdaptation`
- **Backend enrichi** : Route GET `/api/adaptations/:id` retourne maintenant `Mission Client ID` et `Mission Contact ID`

#### Améliorations du Modal d'Envoi Email
- **Template obligatoire** : L'utilisateur doit sélectionner un template email (plus de "Sans template")
- **Filtrage templates** : Seuls les templates utilisateur sont affichés (templates système masqués)
- **Bouton désactivé** : Le bouton d'envoi est grisé tant qu'un template n'est pas sélectionné

#### Corrections Techniques
- **Génération PDF** : Ajout du paramètre `filename` requis par le serveur PDF
- **Route PDF** : Correction de `/api/generate-pdf` vers `/generate-pdf`
- **Template CV** : Récupération automatique du premier template CV actif pour la génération PDF
- **Version adaptation** : Ajout de `currentVersion={1}` pour les adaptations (pas de versioning)

---

## v1.6.3 - 2026-02-28
### 🎯 Missions - Association Client/Contact & Adaptation CV

#### Association Client/Contact aux Missions
- **Nouveaux champs** : Les missions peuvent maintenant être associées à un client/prospect et un interlocuteur
- **Migration SQL** : Ajout de la colonne `contact_id` à la table `missions` avec clé étrangère vers `client_contacts`
- **Formulaire enrichi** : Sélecteurs en cascade Client → Contact dans le formulaire de création/édition de mission
- **Validation backend** : Vérification que le client appartient à la firm de l'utilisateur
- **Affichage tuiles** : Client (avec badge Prospect/Client) et interlocuteur affichés sur les cartes mission

#### Adaptation CV à une Mission
- **Nouvelle page** : `ResumeAdaptPage.tsx` avec workflow en 3 étapes (Sélectionner → Analyser → Adapter)
- **Route ajoutée** : `/resumes/:id/adapt` pour accéder à l'adaptation depuis la page d'amélioration
- **Indicateur progression** : Affichage visuel des étapes avec icônes de validation
- **Navigation fluide** : Accès direct à l'adaptation créée après génération

#### Corrections & Améliorations
- **Bouton Modifier** : Correction du bouton "Modifier" sur la page de consultation de mission
- **Résolution firm_id** : Utilisation de `getUserFirmId()` pour résoudre correctement le firm_id depuis le nom ou l'UUID
- **Validation Zod** : Acceptation des valeurs `null` pour `Client ID` et `Contact ID` dans les schémas de mission

---

## v1.6.2 - 2026-02-23
### 🔒 RGPD - Badge Compact & Envoi Email Automatique

#### Badge RGPD Compact avec Tooltip
- **Mode compact** : Badge RGPD minimaliste sur les cartes CV et page d'analyse
- **Tooltip hover** : Affichage du nom, email et date d'expiration du consentement
- **React Portal** : Rendu du tooltip hors du DOM parent pour éviter le clipping
- **Largeur dynamique** : Tooltip auto-dimensionné selon le contenu

#### Envoi Automatique Email RGPD
- **Email auto à l'upload** : Envoi automatique de la demande de consentement lors de l'upload d'un CV externe
- **Logging détaillé** : Traces complètes pour le débogage de l'envoi Gmail OAuth
- **Gestion token OAuth** : Documentation du processus de reconnexion Gmail en cas d'expiration

#### Corrections Techniques
- **Colonne BDD** : Correction `consent_given_at` → `consent_responded_at` dans les requêtes SQL
- **Import crypto** : Correction de l'import ES module pour `crypto`
- **Traduction manquante** : Ajout de la clé `resume.steps.improve` en français

---

## v1.6.1 - 2026-02-23
### 🧭 Breadcrumbs & Refactoring Navigation CV

#### Navigation par Breadcrumbs
- **Composant Breadcrumbs** : Implémentation sur l'ensemble des pages de l'application
- **Génération automatique** : Détection intelligente des routes et affichage contextuel
- **Pages couvertes** : CVthèque, Missions, Clients, Adaptations, Templates, Paramètres, Upload, Profile Matching, Guide Utilisateur, Métriques, Logs de Sécurité, Utilisateurs, Tags, Templates Email

#### Refactoring Workflow CV
- **URLs distinctes** : Séparation en `/resumes/:id/analysis`, `/resumes/:id/improve`, `/resumes/:id/export`
- **Redirection automatique** : `/resumes/:id` redirige vers `/resumes/:id/analysis`
- **Nettoyage code** : Suppression de `ResumeViewPage.tsx` et `ResumeAnalysis.tsx` (ancien composant monolithique de 702 lignes)

#### Corrections UI/UX
- **Boutons dark mode** : Style outlined subtil pour "Voir l'amélioration" et "Exporter" (meilleure lisibilité)
- **Animation amélioration** : Correction de l'affichage avec `isVisible={true}` et `setTimeout` pour le rendu React

#### Traductions
- **Nouvelles clés** : `navigation.securityLogs`, `navigation.upload`, `resume.analysis.title`, `resume.analysis.tabs.skills`

---

## v1.6.0 - 2026-02-21
### 📧 Templates Email MJML & Profils Utilisateurs Enrichis

#### Éditeur de Templates Email MJML
- **Éditeur visuel** : Nouveau composant `EmailTemplateEditor.tsx` avec blocs drag-and-drop (Logo, En-tête, Paragraphe, Signature, Pied de page)
- **Compilation MJML** : Intégration de la bibliothèque MJML pour générer des emails HTML responsifs
- **Bloc Logo** : Support du logo dynamique du cabinet dans les templates avec `{{firm.logo}}`
- **Prévisualisation** : Aperçu en temps réel du rendu HTML des templates

#### Gestion des Logos de Cabinet
- **Upload de logo** : Nouvelle fonctionnalité d'upload de logo pour chaque cabinet (JPEG, PNG, GIF, WebP, SVG)
- **Stockage** : Logos stockés dans `client/public/logos/` avec noms uniques
- **URLs absolues** : Conversion automatique des chemins relatifs en URLs absolues pour les emails
- **Migration BDD** : Ajout de la colonne `logo_url` dans la table `firms`

#### Profils Utilisateurs Enrichis
- **Nouveaux champs** : Ajout de `job_title` (fonction) et `phone` (téléphone) dans les profils utilisateurs
- **Formulaire admin** : Champs Fonction et Téléphone dans le modal de gestion des utilisateurs
- **Migration BDD** : `docker/migrations/add_user_profile_fields.sql`

#### Mots-clés Email Étendus
- **Nouveaux mots-clés** : `{{user.email}}`, `{{user.jobTitle}}`, `{{user.phone}}`
- **Enrichissement contexte** : Les données utilisateur sont récupérées depuis la BDD lors de l'envoi pour garantir leur fraîcheur
- **Documentation** : Liste complète des mots-clés disponibles dans l'éditeur

#### Corrections Techniques
- **Contrainte email unique** : Correction de l'erreur lors de la mise à jour d'un utilisateur sans changement d'email
- **TypeScript** : Conversion de `userService.js` en `userService.ts` avec typage complet
- **CSRF multipart** : Gestion correcte du token CSRF pour les uploads de fichiers

#### Traductions
- **FR/EN** : Nouvelles clés pour les champs Fonction, Téléphone, et le bloc Logo dans l'éditeur

---

## v1.5.9 - 2026-02-21
### 🎯 Amélioration des Prompts LLM & Corrections Swagger

#### Refonte des prompts par défaut
- **Prompt d'analyse** : Nouvelle grille d'évaluation détaillée pour `experiencesRating` (5 critères : Lisibilité, Contexte, Livrables, Responsabilités, Impact)
- **Prompt d'amélioration** : Structure alignée sur la grille d'analyse avec priorités de qualité explicites
- **Industries** : Lexique de mapping explicite avec règles de preuve obligatoires
- **Tags tools** : Ajout du type d'élément entre parenthèses (langage, framework, outil...)

#### Corrections Swagger
- **Validation OpenAPI** : Correction du schéma `/llm/openai` (ajout `items` pour le tableau `messages`)
- **Cache désactivé** : Headers `no-cache` pour `/api/docs` et `/api/docs/ui`
- **Anti-cache frontend** : Boutons avec paramètre `?v=timestamp` dans SettingsPage

#### Corrections techniques
- **swagger.js** : Import de `swaggerPaths` déplacé en haut du fichier pour éviter les problèmes de timing ES modules

---

## v1.5.8 - 2026-02-21
### 📚 Refonte Documentation Swagger/OpenAPI & Nettoyage Terminologie

#### Mise à jour complète du Swagger
- **Nouvelle architecture** : Séparation en `swagger.js` (schémas) et `swagger.paths.js` (62 endpoints)
- **Terminologie corrigée** : Remplacement de `customers` par `firms` (aligné avec la BDD)
- **Schémas à jour** : Ajout de `Firm`, `Client`, `ClientContact`, `ResumeSubmission`, `ResumeVersion`, `MailStatus`

#### Routes manquantes documentées
- **Firms** : CRUD complet `/api/firms/*` pour la gestion des cabinets
- **Clients** : CRUD `/api/clients/*` avec gestion des contacts
- **Submissions** : Historique des envois de CV `/api/submissions/*`
- **Mail** : OAuth et création de brouillons `/api/mail/*`
- **Resume Versions** : Gestion des versions `/api/resumes/:id/versions/*`

#### Nettoyage terminologie Customer → Firm
- **proxy-server.js** : Suppression de la route legacy `/api/customers`
- **missions.routes.js** : Suppression des alias `Customer`/`Customer ID` dans les réponses
- **health.routes.js** : Correction `customers` → `firms` dans les stats de cache
- **profileMatching.service.js** : Remplacement `customer` → `firm` dans les paramètres
- **MissionsPage.tsx** : Interface `Mission.Customer` → `Mission.Firm`
- **StatsCards.tsx** : Stats `customers` → `firms`
- **HealthIndicator.tsx** : Type et affichage `customers` → `firms`
- **Traductions** : Clé `missions.stats.customers` → `missions.stats.firms` (FR/EN)

#### Nettoyage fichiers
- **Suppression doublon** : Fichier `server/docs/openapi.js` obsolète supprimé
- **Import corrigé** : `docs.routes.js` utilise maintenant `swagger.js`

---

## v1.5.7 - 2026-02-08
### 🚀 Optimisations Production & Corrections i18n

#### Optimisation des assets statiques
- **Fichiers pré-compressés** : Support Brotli (.br) et Gzip (.gz) pour les assets statiques
- **Cache agressif** : Assets hashés cachés 1 an avec `immutable`, HTML sans cache pour SPA
- **Headers optimisés** : `Vary: Accept-Encoding` pour compatibilité CDN

#### Pagination CVthèque
- **Correction pagination** : Ajout du `totalCount` dans la réponse API pour afficher toutes les pages
- **Cohérence** : Pagination à 20 éléments par page (comme le reste de l'application)

#### Corrections i18n
- **I18nextProvider** : Enveloppement explicite de l'application pour garantir l'initialisation
- **Import prioritaire** : i18n importé en premier dans `main.tsx`
- **Textes de chargement** : Ajout des tableaux `steps` pour les animations d'analyse CV

#### Sécurité API
- **fetchWithAuth** : Migration de tous les appels API protégés vers `fetchWithAuth()`
- **HealthIndicator** : Utilisation de `fetchWithAuth` pour les endpoints admin
- **Génération PDF** : Tous les appels `/generate-pdf` utilisent maintenant `fetchWithAuth`

---

## v1.5.6 - 2026-02-07
### 🌐 Audit & Nettoyage des Traductions

#### Script d'audit des traductions
- **Nouveau script** `scripts/audit-translations.js` : Audit complet des fichiers de traduction
- **Détection automatique** : Identification des clés manquantes et inutilisées
- **Mode fix** : Ajout automatique des clés manquantes avec `--fix`
- **Mode remove-unused** : Suppression des clés inutilisées avec `--remove-unused`
- **Préservation des clés dynamiques** : Les clés utilisées dynamiquement (ex: `marketRadar.dataTypes.*`, `header.language.*`) sont préservées

#### Filtres dynamiques des logs de sécurité
- **Filtres dynamiques** : Les options de filtre (level, event, source) sont maintenant chargées depuis les données réelles
- **Nouvel endpoint** `/api/admin/security-filters` : Retourne les valeurs uniques pour les filtres
- **Suppression des enums hardcodés** : Plus de validation stricte sur les valeurs de filtre

#### Corrections des traductions
- **Clés manquantes ajoutées** : 18 clés ajoutées en FR et EN
- **Synchronisation FR/EN** : Les deux fichiers sont maintenant parfaitement synchronisés
- **Nettoyage** : 344 clés inutilisées supprimées
- **Types de données Market Radar** : Ajout des traductions pour `offres`, `tension`, `dynamique_emploi`, `embauche`, `demandeur`, `demandeur_entrant`

#### Tuile Erreurs des logs de sécurité
- **Comptage corrigé** : La tuile "Erreurs" ne compte maintenant que les logs de niveau ERROR (plus SECURITY)
- **Normalisation** : Les niveaux de log sont normalisés en majuscules pour un comptage cohérent

---

## v1.5.5 - 2026-02-06
### 🎯 Améliorations Matching Profils & UX

#### Matching Profils - Corrections majeures
- **Fix casse status** : Correction de la comparaison case-insensitive pour les status `analyzed`/`improved` dans PostgreSQL
- **Tags cleaned prioritaires** : Le matching utilise maintenant les tags nettoyés (`skills_cleaned`, etc.) en priorité avec fallback sur les tags bruts
- **Affichage tous profils** : Les CVs sont maintenant tous affichés triés par pertinence, même avec un score de 0
- **Debug logging** : Ajout de logs pour diagnostiquer les problèmes de matching

#### Analyse CV - Objectivité
- **Analyse agnostique** : Suppression du biais qui favorisait les scores des CV améliorés
- **Même traitement** : L'analyse LLM traite maintenant tous les CVs de manière identique (original ou amélioré)

#### Affichage CV amélioré
- **Export HTML** : L'aperçu dans l'onglet Exporter affiche maintenant le CV en HTML rendu
- **Comparaison HTML** : L'onglet Comparer affiche le CV amélioré en HTML formaté

#### UX Page d'accueil
- **Espacement sections** : Augmentation de l'espace avant "Comment ça marche" pour un affichage bloc par bloc

---

## v1.5.4 - 2026-02-06
### 🗺️ Améliorations UX Carte France

#### Conservation du métier lors du changement de région
- **Persistance de la sélection** : Le métier sélectionné reste actif lors du changement de région
- **Rechargement automatique** : Les métadonnées sont rechargées pour la nouvelle région
- **Mapping type corrigé** : Correction du mapping `offres` → `offre` pour la recherche de trends

#### Affichage des métadonnées amélioré
- **En-tête métier** : Ajout du nom du métier sélectionné en haut du panneau de métadonnées
- **Affichage conditionnel** : Le panneau ne s'affiche que si les métadonnées sont disponibles ou en chargement
- **Suppression message inutile** : Retrait du message "Sélectionnez un métier pour voir les détails"

#### Corrections de bugs
- **Fix layout shift** : Suppression de l'indicateur de métier qui causait un décalage de layout
- **Fix hauteur panneau** : Ajout d'une hauteur maximale fixe au panneau latéral pour éviter les re-layouts
- **Fix effet région** : Utilisation d'un ref pour détecter uniquement les vrais changements de région

---

## v1.5.3 - 2026-02-06
### 🗺️ Metadata on-demand sur la Carte France

#### Affichage des metadata de tendances
- **Nouvelle route API** `/api/market-radar/trends/:id/metadata` : Chargement on-demand des metadata
- **Nouveau composant** `TrendMetadataDisplay.tsx` : Affichage réutilisable des metadata parsées
- **Panneau de détails** : Affiché au clic sur un métier dans la liste "Répartition par métier"
- Support des types : tension, salaire, embauche, dynamique_emploi, demandeur, offre

#### Optimisation mémoire
- **Cache LRU** : Maximum 50 entrées avec éviction automatique des plus anciennes
- **Nettoyage automatique** : Cache vidé au changement de type de données ou de région
- **Chargement léger** : La carte ne charge que les données essentielles (sans metadata)

#### Améliorations UX
- Metadata chargées uniquement à la sélection d'un métier (pas au hover)
- Indicateur de chargement pendant la récupération des metadata
- Cache local pour éviter les appels API répétés

---

## v1.5.2 - 2026-02-06
### 🧠 Audit mémoire complet & Optimisations

#### Gestion mémoire - Audit complet
- **Audit mémoire exhaustif** : Document `MEMORY_AUDIT.md` avec analyse de tous les caches
- **ESCO Cache** : Ajout limite 10,000 entrées, TTL 24h, cleanup automatique toutes les heures
- **Trends Cache** : Ajout cleanup automatique si inactif > 2× TTL, fonctions `destroy()` et `stats()`
- **Facts Cache** : Idem avec cleanup automatique et fonctions de monitoring
- **Métiers Cache** : Ajout cleanup automatique et fonctions `destroyMetiersCache()`, `getMetiersCacheStats()`
- **Tags Cache** : Ajout TTL explicite 10 min, cleanup automatique, fonctions destroy/stats
- **Logger Frontend** : Ajout limite 1000 entrées, cleanup périodique toutes les 5 minutes
- **File Cleanup** : Ajout `destroyFileCleanup()` et `getFileCleanupStats()` pour cohérence

#### Graceful Shutdown
- **Nouveau service `shutdown.service.js`** : Gestion centralisée du shutdown
- Enregistrement de tous les handlers de cleanup
- Gestion des signaux SIGTERM, SIGINT et exceptions non gérées

#### Monitoring mémoire
- **Nouvel endpoint `/api/health/memory`** : Stats détaillées de tous les caches
- Affichage dans l'indicateur de santé (header) avec détails par cache
- Rafraîchissement dynamique des données au survol du tooltip
- Informations affichées : taille actuelle, limite max, TTL, état GC

#### Collecte Market Radar
- Amélioration de la gestion mémoire dans `collectMarketTrends()`
- Logs détaillés avec usage mémoire (`heapUsedMB`)
- Nettoyage explicite des variables après traitement
- Comptage précis (created/updated/failed/skipped) avec vérification comptable

#### Dynamique de l'emploi (DYN_1)
- Correction de la collecte pour toutes les 13 régions françaises
- Logs améliorés avec `accountingMatch` pour vérifier la cohérence
- Affichage enrichi dans l'UI avec tendance (hausse/baisse/stable)

---

## v1.5.1 - 2026-02-05
### 🔧 Nettoyage et qualité du code

#### Nettoyage Airtable
- **Suppression complète des références Airtable** : Code et dépendances
- Suppression de la dépendance `airtable` du package.json
- Renommage `airtableService.ts` → `resumeService.ts`
- Mise à jour des types (`DatabaseError` remplace `AirtableError`)
- Retrait de `api.airtable.com` du CSP

#### Validation et sécurité
- **Validation Zod sur routes LLM** : `openaiRequestSchema`, `anthropicRequestSchema`
- Validation du chatbot avec `chatbotRequestSchema`
- Schémas de validation pour messages LLM avec limites de taille

#### Qualité du code
- **Nouveau middleware `asyncHandler`** : Gestion d'erreurs standardisée
- **Helpers de routes** : `routeHelpers.js` avec fonctions réutilisables
- Health check PostgreSQL amélioré avec stats détaillées (latence, taille DB, comptages)
- Statistiques complètes dans `/api/resumes/stats` (improved count, scores moyens)
- Correction du format des tableaux PostgreSQL dans `postgresHelpers.js`

#### Tests
- Nouveaux tests d'intégration pour routes health et auth
- 35+ tests passants

#### Corrections
- Fix erreurs TypeScript (types de scores, Status as const)
- Fix appels logger avec trop d'arguments
- Migration du champ `popular` pour les templates

---

## v1.5.0 - 2026-02-05
### 🚀 Migration PostgreSQL & Sécurité renforcée

#### Migration base de données
- **Migration complète Airtable → PostgreSQL** : Performance et scalabilité améliorées
- Nouveau schéma avec UUIDs, indexes optimisés et contraintes d'intégrité
- Triggers de dénormalisation pour synchronisation automatique des champs liés
- Connection pooling avec retry automatique et backoff exponentiel
- Support des transactions ACID pour les opérations critiques

#### Sécurité
- **Protection SQL injection** : Whitelist des tables et validation des colonnes
- **Timeout réel des requêtes** : Utilisation de `statement_timeout` PostgreSQL
- **Masquage des données sensibles** dans les logs (mots de passe, tokens)
- Rate limiting et validation des entrées avec Zod schemas

#### Système de logging amélioré
- Nouvelle architecture de logging backend et frontend
- Niveaux configurables : error, warn, info, debug
- Traçabilité par module source (`[database]`, `[franceTravail]`, etc.)
- Rate limiting pour éviter le spam de logs
- Redaction automatique des champs sensibles
- Configuration via `LOG_LEVEL` et `VITE_LOG_LEVEL`

#### Améliorations UI
- Traduction des statuts de CV (Amélioré, En cours, Analysé, etc.)
- Codes couleur distincts pour chaque statut de CV
- Formatage des dates cohérent et localisé

---

## v1.3.0 - 2026-02-03
### 🔄 Améliorations majeures
#### Refonte des prompts LLM
 - Nouveaux prompts d'analyse et d'amélioration de CV avec instructions détaillées
 - Règles anti-hallucination et anti-invention pour des résultats plus fiables
 - Grilles de notation structurées pour une évaluation cohérente
 - Extraction de tags avec validation par whitelist d'industries
 - Format JSON strict pour une meilleure reproductibilité
 - Température réduite à 0.3 pour l'amélioration (plus déterministe)
 - Gestion d'erreur robuste pour les réponses LLM invalides

#### Intégration ESCO (en cours)
 - Préparation de l'intégration avec le référentiel européen des compétences
 - Infrastructure de mapping des tags vers la taxonomie ESCO
 - Support des occupations et skill groups ICT

#### Corrections et améliorations
 - Correction de l'affichage des messages d'erreur (toast avec largeur appropriée)
 - Correction de l'import manquant dans profileMatching.service.js
 - Architecture améliorée : séparation des prompts backend/frontend
 - Messages d'erreur utilisateur plus clairs et lisibles

## v1.2.3 - 2026-02-01
### 🎯 Nouvelle fonctionnalité majeure : Radar Marché IT/IS France
Page de veille complète sur le marché du travail IT en France, permettant de suivre les tendances et opportunités par région et métier.

#### Carte interactive de France
 - Intégration de MapLibre GL pour une cartographie professionnelle
 - Visualisation des offres d'emploi IT par région avec bulles proportionnelles
 - Popups interactifs au survol avec détails régionaux
 - Panneau de détail par région avec répartition par métier
 - Filtre de recherche dans la liste des métiers
 - Affichage des libellés de métiers (au lieu des codes ROME)

#### Collecte et analyse de données
 - Intégration API France Travail (OAuth2) pour collecte d'offres d'emploi
 - Intégration API Adzuna pour données salariales et tendances
 - Stockage des facts dans Airtable (table MarketFacts)
 - Collecte par codes ROME IT, régions françaises et mots-clés techniques
 - Histogrammes de salaires et top entreprises qui recrutent

#### Interface de consultation
 - Tableau de données détaillées avec pagination serveur
 - Filtres par source, métier et région
 - Statistiques globales : offres totales, régions couvertes, région #1, métiers IT

## v1.2.2 - 2026-02-01
 - Affinement des scores de matching par analyse IA des titres de CV
 - Navigation par URL pour les éléments individuels (/resumes/:id, /missions/:id, /adaptations/:id)
 - Pages dédiées pour la visualisation des CVs, missions et adaptations
 - Mise à jour du guide utilisateur (section matching profils)
 - Correction de la gestion des sessions expirées (erreurs JWT comme "kid_malformed")
 - Synchronisation front/back pour l'expiration des tokens (headers X-Token-Expires-In)
 - Refresh proactif du token avant expiration (5 minutes avant)
 - Codes d'erreur explicites pour les problèmes d'authentification (TOKEN_MISSING, TOKEN_INVALID)
 - Redirection automatique vers la page de connexion en cas d'expiration de session
 - Harmonisation de la gestion de version (source unique: package.json)

## v1.2.1 - 2026-01-31
 - Analyse détaillée IA des profils pour une mission (Phase 2 du matching)
 - Évaluation complète : verdict, forces, lacunes, recommandations
 - Questions d'entretien suggérées par l'IA
 - Évaluation du niveau de risque de recrutement
 - Amélioration de la gestion des erreurs frontend (messages utilisateur)

## v1.2.0 - 2026-01-31
 - Nouvelle fonctionnalité : Matching Profils - Recherche des meilleurs CVs pour une mission
 - Extraction automatique des mots-clés de mission via IA (avec cache)
 - Algorithme de scoring pondéré (compétences, outils, secteurs, soft skills)
 - Matching flou pour les variations de termes techniques
 - Interface dédiée avec filtres avancés et pondérations personnalisables
 - Gestion globale des erreurs frontend avec ErrorBoundary et toasts détaillés

## v1.1.9 - 2026-01-31
 - Gestion des CVs nominatifs / anonymes
 - Affichage des suggestions dans le formulaire d'édition du CV amélioré
 - Mise à jour du guide utilisateur

## v1.1.8 - 2026-01-31
 - Unification de la logique d'analyse CV (meme processus et prompt pour l'analyse initiale et post-amelioration)
 - Nouveau prompt d'analyse optimise avec suggestions par section
 - Correction du scroll dans le header sur la page d'accueil

## v1.1.7 - 2026-01-30
 - Amélioration de la présentation de l'application
 - Prise en compte correcte des suggestions d'amélioration
 - Bug fixing et optimisations

## v1.1.6 - 2026-01-29
 - Sécurité renforcée : blacklist JWT, révocation tokens au logout, logs sécurité persistés
 - Fiabilité améliorée : retry avec backoff exponentiel et circuit breakers pour LLM/Airtable
 - Documentation API Swagger, métriques persistées, types TypeScript centralisés

## v1.1.5 - 2026-01-28
 - Optimisation
 - correction des vulnérabilités
 - poursuite du refactoring

## v1.1.4 - 2026-01-28
 - Corrections de bugs d'authentification (casse des propriétés utilisateur)
 - Corrections et optimisations diverses

## v1.1.3 - 2026-01-28
 - Poursuite du refactoring
 - Bascule en TypeScript du front
 - Corrections et optimisations diverses

## v1.1.2 - 2026-01-27
 - Refactoring du front et nettoyage de fichiers morts historiques
 - Préparation de l'application pour la production
 - Corrections diverses

## v1.1.1 - 2026-01-27
 - Amélioration de la fonctionalité d'adaptation à une offre de mission
 - Amélioration de la sécurité et correction de fuites mémoire serveur
 - Bugfixing

## v1.1.0 - 2026-01-26
 - Proxy server refactored and memory leak fixes
 - Metrics page implemented
 - Translations fixed / implemented where missing

## v1.0.0 - 2026-01-21
 - Application secured.
 - Added option to adapt resume to a mission
 - All database, LLM and file calls now go through a secure proxy server

## v0.6.0 - 2025-06-19
 - LLM calls go through a proxy server. No API key is exposed anymore (security).
 - Added a proxy server to secure front end calls.

## v0.5 - 2025-06-08
 - Resumes are now associated with customers.
 - Each user only sees resumes of the customer they are associated with.

## v0.4
 - various ui improvements
 - added resume and template delete options
 - added a link to download original resume

## v0.3
 - Switch to OpenAI GPT-4o LLM
 - Various UI improvements and fixes
 - Fixed CORS issue.

## v0.2
 - Added support for sign in / sign out and registering

## v0.1
 - Initial version with most features
