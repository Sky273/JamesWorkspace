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
