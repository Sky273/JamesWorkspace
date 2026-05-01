## v1.9.3 - 2026-04-30
### Fiabilisation des modèles de CV, export PDF et finition du mode sombre

#### Modèles de CV
- Correction des problèmes d'enregistrement et de rechargement des modèles de CV pour éviter les retours à une version obsolète après sauvegarde.
- Renforcement de la prise en compte immédiate des modifications de modèle dans les exports PDF.
- Amélioration de la reconstruction des modèles à partir d'un CV source avec séparation header, contenu, footer et feuille de style.

#### Export PDF
- Correction de l'application des styles CSS du footer pendant l'export PDF.
- Ajustement de la gestion de la hauteur du footer afin que la limite basse du contenu tienne compte de l'espace réservé au footer sans créer d'espace excessif.
- Correction des recouvrements entre texte du CV et footer sur les exports paginés.

#### Interface et mode sombre
- Réduction de l'espacement du menu latéral et suppression des titres de section inutiles pour éviter le scroll vertical.
- Harmonisation des onglets partagés en mode sombre, avec onglet actif violet.
- Correction transverse des textes, titres, badges, tuiles statistiques, champs, breadcrumbs, paginations, éditeurs Tiptap et aperçus de CV en mode sombre.
- Correction de plusieurs écrans métiers encore partiellement en thème clair : CVthèque, missions, CRM, administration, radar marché, jobs, logs de sécurité, journal RGPD et guide utilisateur.

#### Qualité
- Alignement de la version applicative sur `v1.9.3`.

---
## v1.9.2 - 2026-04-21
### Fiabilisation du pipeline mission et gestion des suppressions depuis les écrans de détail CV

#### Pipeline mission
- Correction des problèmes de rafraîchissement sur la vue pipeline des missions :
  - relectures fraîches après ajout, modification, suppression et déplacement d'un candidat
  - propagation explicite du marquage dirty pour éviter les retours à un état stale
- Ajout d'un bouton `Actualiser` sur la vue pipeline mission, aligné sur les autres vues.
- Correction du drag and drop des candidats dans le pipeline mission pour le rendre déterministe :
  - résolution fiable de la carte déplacée au drop
  - mise à jour locale optimiste avant rechargement
  - suppression des cas où un toast de succès apparaissait sans mouvement visuel de la carte

#### Onglets pipeline CV
- Correction du même problème de stale refresh dans l'onglet de sélection des CVs améliorés.
- Ajout de la suppression d'un candidat directement depuis le pipeline de sélection des missions.
- Reprise visuelle du bouton `Retirer du pipeline` pour une intégration plus qualitative dans les cartes.

#### Détail CV
- Ajout d'une action de suppression directement depuis la page de détail d'un CV amélioré.
- Ajout de la même action de suppression depuis la page de détail d'un CV analysé.
- Harmonisation du flux de confirmation, du feedback utilisateur et de la redirection vers la liste des CVs.
- Correction du contrat frontend de suppression pour que les erreurs remontent correctement aux écrans appelants.

#### OpenAI et prompts
- Ajout de `gpt-5.4-mini` dans la liste des modèles OpenAI disponibles.
- Remplacement du prompt d'amélioration CV par une nouvelle version stable, plus stricte sur la fidélité au contenu, le JSON de sortie, le sommaire obligatoire et la structuration ATS.

#### Backend et qualité
- Correction du démarrage backend suite à un import invalide de `normalizeWeights` dans les helpers de settings.
- Alignement de la version applicative sur `v1.9.2`.

---
## v1.9.1 - 2026-04-16
### Ajustements UI CVthèque et cohérence des vues liste

#### CVthèque
- Refonte de la vue `CVthèque / Liste` pour reprendre la structure visuelle de la vue `Par affaire` sans la hiérarchie par affaire.
- Réutilisation des cartes CV enrichies dans les deux vues pour aligner les actions rapides, le score, l'aperçu et les badges.
- Correction du tooltip des tags dans les deux vues CVthèque :
  - positionnement viewport-aware
  - z-index d'overlay explicite
  - fond désormais totalement opaque pour éviter les superpositions visuelles avec les cartes sous-jacentes

#### Missions
- Refonte de la vue `Missions / Liste` sur la base de `Missions / Par affaire`, sans regroupement par affaire.
- Réutilisation de la toolbar, du bloc de synthèse et des cartes mission de la vue groupée pour éviter deux rendus concurrents.

#### Qualité
- Alignement de la version applicative sur `v1.9.1`.

---
## v1.9.0 - 2026-04-11
### Administration multi-cabinet et propagation des templates

#### Rôles et périmètres admin
- Renommage du rôle `admin` en `Super administrateur` côté interface.
- Introduction du rôle `localAdmin` affiché comme `Administrateur`, avec cloisonnement aux données de son cabinet.
- Restriction des écrans accessibles aux admins locaux à `Modèles de CV`, `Templates Email`, `Etiquettes` et `Utilisateurs`, sans accès à l’onglet `Cabinets`.
- Mise à jour de l’écran utilisateurs pour permettre l’attribution des rôles `Super administrateur` et `Administrateur`.

#### Cloisonnement par cabinet
- Filtrage backend et frontend des utilisateurs, modèles CV, templates email et étiquettes pour les admins locaux sur leur seul cabinet.
- Verrouillage explicite des créations, éditions, duplications et suppressions hors cabinet pour les admins locaux.
- Correction du chargement en boucle de l’écran utilisateurs provoqué par des dépendances instables dans les hooks React.

#### Templates email
- Ajout d’une vue super administrateur réellement transverse sur tous les templates email, tous cabinets confondus.
- Ajout du badge `Cabinet` sur chaque template email avec affichage du cabinet d’appartenance ou `Global`.
- Correction des contrôles d’accès backend pour permettre au super administrateur de consulter, prévisualiser, dupliquer, modifier et supprimer des templates email de n’importe quel cabinet.

#### Modèles de CV et duplication
- Ajout de l’action de duplication pour les super administrateurs sur les modèles de CV et les templates email, avec choix du cabinet cible.
- Correction des validations backend pour forcer les admins locaux sur leur propre cabinet.
- Correction de l’unicité des noms de modèles CV en base de données : unicité désormais par cabinet, avec gestion séparée des modèles globaux.

#### Base de données
- Ajout de la migration du rôle `localAdmin` dans la contrainte SQL des utilisateurs.
- Ajout de la migration de contrainte d’unicité des modèles CV par cabinet.

#### Navigation et interface admin
- Déplacement de `Logs de sécurité` et `Journal RGPD` dans la section basse du menu, avant le `Guide utilisateur`.
- Confirmation de l’accès au `Guide utilisateur` pour les utilisateurs standards et les admins locaux.

#### Qualité
- Renforcement des tests ciblés frontend et backend sur les rôles, le cloisonnement, les duplications et les templates email.
- Alignement de la version applicative sur `v1.9.0`.

---
## v1.8.9 - 2026-04-07
### Qualité frontend, overlays CV et gouvernance des prompts

#### Parcours CV et analyse
- L’overlay fullscreen pendant l’analyse et l’amélioration de CV couvre désormais correctement tout le viewport, y compris le footer applicatif et le bouton du chatbot.
- Le rendu des écrans de traitement CV a été sécurisé via montage portail au niveau `document.body`, pour éviter les problèmes de stacking context sur les shells éditoriaux.

#### Prompt de préanalyse
- Remplacement du prompt de préanalyse CV par une nouvelle version orientée canonicalisation Markdown, plus stricte sur la fidélité au contenu source et la structuration des sorties.
- Mise à jour de la gouvernance associée du prompt de préanalyse pour refléter cette nouvelle révision.

#### CRM / deals
- Ajout d’une action de consultation sur les cartes deal.
- Création d’une vue de consultation deal réutilisable et d’une page dédiée accessible par route.

#### UX/UI ciblée
- Amélioration ciblée des vues `Templates email`, `Etiquettes` et `Logs de sécurité`.
- Ajout d’un smoke test Playwright admin sur ces pages pour verrouiller les parcours essentiels.

#### Qualité
- Alignement de la version applicative sur `v1.8.9`.
- Vérifications ciblées maintenues sur les changements récents frontend et backend.

---

## v1.8.8 - 2026-03-30
### Fiabilisation plateforme, backup, cache et refactors structurels

#### Couverture frontend et e2e
- Renforcement massif de la couverture frontend sur les parcours critiques : routing/protection, upload, analysis, export, adapt, settings et batch upload.
- Ajout de parcours Playwright authentifiés stables avec bootstrap automatique d'un utilisateur `active` et injection de cookies JWT pour éviter les collisions avec le rate limiting auth.
- Nouvelles specs e2e métier : navigation protégée, formulaire GDPR upload, flux complet `upload -> analysis` et flux `analysis -> improve -> export`.
- La stack Playwright démarre désormais le proxy applicatif et le `pdf-server`, avec bootstrap automatique d'un template d'export pour l'utilisateur e2e.

#### Nettoyage des reliquats CV
- Confirmation et documentation du fait que le flux métier supporté pour l'import, l'analyse et l'amélioration des CVs passe par `batch-jobs`.
- Suppression de l'ancien endpoint direct `POST /api/resumes/upload` côté serveur.
- Conservation des endpoints techniques `extract-pdf` et `extract-doc`, encore utilisés par le frontend pour l'extraction de texte.
- Suppression des handlers LLM legacy non montés dans le routeur `resumes`.

#### Résilience et observabilité
- Alignement du diagnostic `État du système` avec l’architecture réelle : santé plateforme, backend cache, Redis, mémoire, providers LLM et circuit breakers.
- Ajout de l’affichage mémoire consommée / max dans l’indicateur système, avec seuils visuels adaptés.
- Réduction de l’impact des familles LLM sur l’état global : tant qu’au moins un provider reste exploitable, le badge système n’est plus dégradé par redondance.
- Exposition du backend de cache effectif (`redis`, `memory`, `memory-fallback`) dans `/health`, `/api/admin/cache-stats` et l’admin.

#### Backup et diagnostics utilisateurs
- Correction des erreurs FTP/SFTP remontées brutes dans l’UI backup.
- Mapping explicite des erreurs techniques de connexion distante : certificat TLS invalide, timeout, refus de connexion, échec d’authentification, chemin distant introuvable.
- Le cas `self-signed certificate` n’est plus affiché tel quel à l’utilisateur.
- Nettoyage de la locale FR backup et des libellés visibles de la page de sauvegarde.

#### Cache et déploiement
- Abstraction de cache finalisée avec backend `memory|redis`.
- Intégration Redis dans le setup Docker et ajout d’un mode avec Redis séparé du conteneur applicatif.
- Harmonisation des scripts `docker-build.bat`, `docker-run.bat`, `docker-stop.bat` et `.env.docker` autour de cette architecture.

#### Refactors backend
- Découpage de `metrics.service.js` en modules dédiés : état, LLM, persistance, snapshots, opérations.
- Découpage de `openai/resumeOperations.js` avec extraction de la normalisation CV.
- Découpage de `openai/missionOperations.js` avec extraction de la normalisation matching/adaptation.
- Découpage du domaine `marketTrends` en façade, runtime de collecte, extracteurs et persistance.
- Découpage de `marketFacts.service.js` en façade, cache et persistance.

#### Refactors front et i18n
- Découpage supplémentaire des pages lourdes : métriques, settings, écrans `Resume*`.
- Modularisation des locales `fr` et `en` par domaines logiques pour améliorer la maintenabilité.
- Nettoyage et centralisation des chaînes UI visibles sur les écrans principaux.

#### Qualité
- Les suites client et serveur restent vertes après ces changements.
- Tests ciblés ajoutés pour les erreurs TLS backup et les nouveaux chemins normalisés.

---

## v1.8.7 - 2026-03-21
### 📊 Suivi de Progression des Collectes Market Radar

#### Jobs de Collecte — Progression en Temps Réel
- **Collecte métiers** : Ajout d'un callback `onProgress` à `collectITMetiers` pour mise à jour incrémentale après chaque métier traité
- **Collecte offres (facts)** : Ajout d'un callback `onProgress` à `runFullCollection` et `runSourceCollection` avec mise à jour toutes les 5 secondes
- **Collecte tendances** : Réduction de l'intervalle de progression de 30s à 5s pour un affichage plus réactif

#### Estimation du Total Dès le Lancement
- **Offres France Travail** : Calcul du total attendu `(romeCodes × régions) + keywords` avant la boucle de collecte, via callback `onTotalEstimated`
- **Tendances** : Calcul du total attendu `5 × (romeCodes × régions) + romeCodes + régions` dès le chargement des métiers IT
- **Barre de progression** : Le nombre cible (ex: `120 / 1854`) s'affiche immédiatement au lieu de `0 / 0`

#### Correction UPSERT Offres
- **storeFact** : Remplacement de l'INSERT simple par un `INSERT ... ON CONFLICT DO UPDATE` pour éviter les erreurs de clé dupliquée lors des re-collectes sur la contrainte `(keyword, location, source, date)`

#### Qualité
- **108 tests serveur** passent après les modifications
- **Aucune régression** sur les tests client et pdf-server

---

## v1.8.6 - 2026-03-17
### ✏️ Éditeur Tiptap, Vues Groupées par Affaire & Prompts LLM

#### Migration Éditeur TinyMCE → Tiptap/ProseMirror
- **Nouvel éditeur** : Remplacement complet de TinyMCE par Tiptap v3 (ProseMirror)
- **Toolbar contextuelle** : Bubble toolbar avec modes image, lien et texte
- **Toolbar principale** : Menu déroulant titres (H1-H4), menu tableau, boutons formatage
- **Système de suggestions** : Extension ProseMirror avec badges par section, scoring de correspondance et panneau global
- **Nettoyage** : Suppression des fichiers statiques TinyMCE et du script tag HTML

#### Vues Groupées par Affaire
- **Missions par affaire** : Nouveau composant `MissionsDealsGroupedView` avec sections dépliables par deal, cartes mission et compteurs d'adaptations
- **Adaptations par affaire** : Nouveau composant `AdaptationsDealsGroupedView` avec hiérarchie Deal → Mission → Adaptations, recherche intégrée et navigation vers les détails
- **API backend** : Nouvel endpoint `GET /api/adaptations/grouped-by-deal` avec requêtes batch optimisées
- **Toggle vue** : Sélecteur "Par affaire" / "Liste" sur les pages Missions et Adaptations

#### Prompts LLM Restructurés
- **Prompt d'analyse/matching** : Format markdown structuré avec règles anti-hallucination strictes
- **Prompt d'adaptation** : Directives par section, conservation du contenu original, suppression des inventions
- **Prompt d'amélioration** : Formatage backtick, règles de résumé impersonnel, vérification d'existence des sections

#### Améliorations UI/UX
- **Animation d'amélioration** : Nouveau design avec carte inline, spinner multi-anneau et messages d'état cycliques
- **Stepper de progression** : Spinners animés et fonds dégradés pour les états de chargement
- **Preview CV inline** : Panneau de prévisualisation avec chargement paresseux sur les cartes CV par affaire
- **Priorité d'affichage** : Inversion Nom du CV / Nom du candidat dans les adaptations

#### Documentation
- **SECURITY.md** : Mise à jour complète (circuit breakers LLM, APM, métriques, endpoints publics, validation environnement, 9 nouvelles entrées checklist, table de référence fichiers corrigée)
- **ARCHITECTURE.md** : Mise à jour pour refléter la migration Tiptap, le routage modulaire et les nouvelles fonctionnalités
- **INSTALL.md** : Mise à jour de la documentation d'installation

---

## v1.8.5 - 2026-03-16
### 🧪 Tests Routes Backend Complets

#### Nouveaux Tests Routes
- **missions.routes.test.js** : 34 tests couvrant GET /, GET /:id, POST /, PUT /:id, DELETE /:id, GET /:missionId/adaptations
- **Suite complète** : 10 fichiers de tests, 197 tests passent

#### Corrections Tests Existants
- **batchJobs.routes.test.js** : Correction des mocks (`vi.resetAllMocks` au lieu de `clearAllMocks`), mock multer pour `req.body`, alignement avec les vraies routes
- **clients.routes.test.js** : Correction réponse `data` vs `clients`, ajout mocks multi-requêtes (contacts, submissions)
- **deals.routes.test.js** : Ajout mock pour vérification firm du resume dans POST /:id/resumes
- **adaptations.routes.test.js** : Correction `data` vs `records`, `findWithTimeout` lance une erreur 404 au lieu de retourner `null`

#### Améliorations Techniques
- **Mocks factory functions** : `userRateLimit` correctement mocké comme factory `() => middleware`
- **Isolation des tests** : `vi.resetAllMocks()` pour éviter les fuites de mocks entre tests
- **Couverture routes critiques** : auth, resumes, missions, clients, deals, adaptations, batchJobs, health

---

## v1.8.4 - 2026-03-12
### 📦 Export Multi-Format & Qualité Code

#### Export par Lot Multi-Format
- **Sélection multiple** : Remplacement des radio buttons par des checkboxes pour sélectionner plusieurs formats (PDF, DOCX, DOC)
- **Dossiers par type** : Le ZIP d'export contient maintenant un dossier par format sélectionné (PDF/, DOCX/, DOC/)
- **Rate limit augmenté** : Limite PDF serveur passée de 200 à 300 req/min pour supporter 100 docs × 3 formats
- **Animation de chargement** : Feedback visuel lors du dépôt de fichiers dans la zone de drop

#### Qualité Code
- **Tests corrigés** : Migration du fichier `resumes.routes.test.js` de Jest vers Vitest
- **Lint fixes** : Correction de 22 erreurs ESLint (imports inutilisés)
- **Variables préfixées** : ~20 variables catch/paramètres inutilisés préfixés avec `_`
- **396 tests passent** : Tous les tests unitaires et d'intégration passent

#### Corrections Techniques
- **Gestion des doublons** : Les fichiers avec le même nom reçoivent un suffixe numérique dans le ZIP
- **Validation frontend** : Le bouton "Traiter" est désactivé si l'export est activé mais aucun format n'est sélectionné

---

## v1.8.3 - 2026-03-11
### 🔧 Corrections Scheduler Backup & Radar du Marché

#### Corrections Scheduler de Sauvegarde
- **Initialisation correcte** : `initBackupScheduler()` déplacé dans le bloc DB connecté pour garantir l'exécution après connexion à la base
- **Création automatique des tables** : Nouvelle fonction `initBackupTables()` crée automatiquement `backup_settings` et `backup_history` au démarrage
- **Gestion des erreurs** : Meilleure gestion des erreurs DB lors du chargement des paramètres de sauvegarde

#### Corrections Radar du Marché
- **Valeurs carte de France** : Correction de l'affichage des chiffres sur la carte (offres d'emploi, embauches, etc.)
- **Conversion NULL/DECIMAL** : Les valeurs NULL sont maintenant converties en 0, les DECIMAL en nombres côté serveur
- **4 fonctions corrigées** : `getStoredTrendsLight`, `getStoredTrendsWithMetadata`, `getTrendMetadata`, `loadTrendsCache`

#### Améliorations Techniques
- **Import statique** : Conversion de l'import dynamique `apiInterceptor` en import statique dans `textExtraction.ts` (supprime le warning Rollup)
- **Types API** : Nouveau fichier `client/src/types/api.ts` avec types standardisés pour les réponses API
- **Index types** : Nouveau fichier `client/src/types/index.ts` pour exports centralisés

---

## v1.8.2 - 2026-03-09
### 🖨️ Refactoring PDF Server

#### Génération de documents
- **PDF** : Génération via Puppeteer avec support des headers/footers natifs
- **Headers/Footers** : Support natif des headers dans le body et footers dans les marges de page
- **Compteurs de pages** : Support des placeholders `-pageNumber-` et `-totalPages-`
- **DOCX** : Génération via Pandoc avec injection de footer Word natif en post-traitement
- **DOC** : Conversion PDF → DOC via LibreOffice

#### Refactoring du Serveur PDF
- **Architecture modulaire** : `server.cjs` divisé en modules séparés pour une meilleure maintenabilité
  - `lib/logger.cjs` : Utilitaire de logging centralisé
  - `lib/htmlBuilder.cjs` : Construction HTML pour Puppeteer
  - `lib/pdfGenerator.cjs` : Génération PDF via Puppeteer
  - `lib/docxGenerator.cjs` : Génération DOCX/DOC (Pandoc + LibreOffice)
- **Code réduit** : `server.cjs` réduit de ~670 à ~320 lignes
- **Testabilité** : Fonctions exportables pour tests unitaires

---

## v1.8.1 - 2026-03-09
### 🔧 Corrections de Stabilité & Sécurité

#### Corrections de Sécurité
- **Sanitization XSS** : Ajout de `createSafeHtml()` pour tous les rendus HTML dynamiques (VersionsPanel, ExportTab, CompareTab)
- **Configuration proxy** : Correction de la détection d'IP pour le rate limiting derrière reverse proxy

#### Corrections de Stabilité
- **Statut sauvegarde** : Correction du statut "Running" qui restait affiché après une sauvegarde terminée
- **Nettoyage automatique** : Les sauvegardes bloquées depuis plus de 30 minutes sont automatiquement marquées comme échouées
- **Scheduler de sauvegarde** : Démarrage explicite des jobs cron avec `.start()` pour garantir leur exécution

#### Améliorations Techniques
- **Référence base de données** : Correction des références obsolètes vers l'ancienne table `customers` (renommée `firms`)
- **Limite chatbot** : Augmentation de la limite du guide utilisateur de 60000 à 100000 caractères
- **Nettoyage logs** : Suppression des `console.log` de debug dans le preview PDF

---

## v1.8.0 - 2026-03-08
### 🗄️ Page Sauvegarde Dédiée & Corrections FTP/TLS

#### Nouvelle Page Sauvegarde
- **Page dédiée** : Nouvelle page "Sauvegarde" accessible depuis le menu principal (admin uniquement)
- **URL** : `/dashboard/backup` avec protection AdminRoute
- **Menu** : Entrée "Sauvegarde" dans la partie basse du menu, entre Paramètres et Guide Utilisateur
- **Traductions** : Namespace `backup.*` complet en français et anglais

#### Sauvegarde FTP/SFTP
- **Modes TLS** : Support complet des modes TLS (Explicite AUTH TLS, Implicite port 990, Aucun)
- **Correction FTP** : Résolution de l'erreur "503 Use AUTH first" - AUTH TLS envoyé avant USER
- **Validation Zod** : Schémas de validation pour les paramètres de sauvegarde
- **Planification** : Sauvegardes quotidiennes, hebdomadaires et mensuelles avec rétention configurable

#### Scripts Docker
- **docker-logs.bat** : Affiche les logs du Proxy Server (backend principal)
- **docker-logs-pdf.bat** : Nouveau script pour les logs du PDF Server
- **Documentation** : Section "Viewing Logs" ajoutée dans docker/README.md

#### Améliorations Techniques
- **basic-ftp** : Correction du paramètre `secure` (true pour explicite, "implicit" pour implicite)
- **Logging** : Logs détaillés pour le diagnostic des connexions FTP/SFTP

---

## v1.7.9 - 2026-03-08
### 🏠 Page d'Accueil Publique & Stockage Logo en Base

#### Page d'Accueil Publique
- **Nouvelle page** : Page d'accueil publique pour les utilisateurs non connectés (`/welcome`)
- **Header public** : Boutons "Se connecter" et "S'inscrire" stylisés de manière cohérente
- **Section Hero** : Réutilisation de la hero zone de la page d'accueil principale
- **Footer** : Affichage du footer de l'application
- **Configuration** : Variable d'environnement `VITE_PUBLIC_HOME=true` pour activer la page publique
- **Redirection intelligente** : Les utilisateurs non connectés sont redirigés vers `/welcome` si activé

#### Stockage Logo Cabinet en Base de Données
- **Nouveau champ** : `logo_data` (BYTEA) et `logo_mime_type` dans la table `firms`
- **Persistance Docker** : Les logos sont maintenant stockés en base de données (plus de perte lors des rebuilds)
- **Route API** : `GET /api/firms/:id/logo/image` pour servir les logos depuis la base
- **Migration** : `add_firm_logo_data.sql` pour les bases existantes

#### Améliorations UI
- **Footer sur Register** : Ajout du footer sur la page d'inscription (comme sur SignIn)
- **Boutons cohérents** : Style unifié pour les boutons de connexion/inscription

---

## v1.7.8 - 2026-03-07
### 🐳 Docker Améliorations & Documentation APM

#### Docker
- **Port HTTPS** : Utilisation du port 3443 (au lieu de 443) pour éviter les conflits de permissions
- **Mot de passe PostgreSQL sécurisé** : Nouveau mot de passe sécurisé (voir documentation interne)
- **Scripts .bat Windows** : Nouveaux scripts simplifiés à la racine (`docker-build.bat`, `docker-run.bat`, `docker-stop.bat`, `docker-logs.bat`, `docker-shell.bat`)
- **Google Chrome** : Utilisation de Google Chrome au lieu de Chromium pour la génération PDF (meilleure compatibilité)

#### Documentation
- **INSTALL.md** : Simplification de la section Docker avec scripts .bat comme méthode recommandée
- **ARCHITECTURE.md** : 
  - Nouvelle section "Monitoring & APM" documentant l'APM interne
  - Tableau comparatif APM interne vs externe (Datadog, New Relic)
  - Ajout des identifiants PostgreSQL Docker
  - Ajout des scripts .bat Windows
- **docker/README.md** : Mise à jour des ports et credentials

#### Corrections
- **Puppeteer** : Correction du chemin exécutable dans `supervisord.conf` (`google-chrome-stable`)
- **Cohérence mot de passe** : Synchronisation entre création utilisateur PostgreSQL et variable d'environnement

---

## v1.7.7 - 2026-03-05
### 🐳 Docker PostgreSQL 18 & Documentation

#### Configuration Docker
- **PostgreSQL 18** : Mise à jour de PostgreSQL 14 vers 18 pour cohérence avec l'environnement hors Docker
- **Secrets stables** : Les secrets JWT ne sont plus générés aléatoirement à chaque démarrage (évite déconnexions)
- **Variables complètes** : Ajout de `REFRESH_TOKEN_SECRET`, `CSRF_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MAIL_TOKEN_ENCRYPTION_KEY`
- **Volume PostgreSQL** : Chemin mis à jour vers `/var/lib/postgresql/18/main`

#### Documentation
- **INSTALL.md** : Commande Docker complète avec tous les secrets et volume PostgreSQL
- **ARCHITECTURE.md** : Nouvelle section "Déploiement Docker" avec schéma d'architecture conteneur
- **docker/README.md** : Mise à jour des chemins PostgreSQL 18

#### Guide Utilisateur
- **Bonnes Pratiques** : Section entièrement réécrite pour couvrir l'application complète
  - 📄 Gestion des CV (import, qualité, structure)
  - 🎯 Missions et Matching (création, optimisation)
  - 👥 Clients et Contacts (organisation, suivi)
  - 📊 Pipeline de Recrutement (gestion par étape)
  - ✉️ Envoi de CV (préparation, bonnes pratiques)
  - 🔒 Conformité RGPD (consentement, audit)
  - 📈 Market Radar (veille marché)
  - ⚙️ Administration (configuration, sécurité)
  - 🔄 Workflow Recommandé (schéma complet)
  - 💡 Conseils de Productivité
- **Guide EN** : Synchronisé avec la version française

#### Corrections
- **UserGuidePage** : Correction du regex d'extraction de section (matchait `###` au lieu de `##`)

---

## v1.7.6 - 2026-03-04
### 📊 Pipeline Kanban & Entretiens Multiples

#### Vue Kanban au Niveau Mission
- **Nouveau** : Tableau Kanban intégré sur la page de détail de chaque mission
- **Colonnes par étape** : Visualisation des candidats par étape du pipeline
- **Drag & Drop** : Glisser-déposer pour changer l'étape d'un candidat
- **Cartes candidats** : Affichent nom, score, tags, notes, date, nombre d'entretiens
- **Ajout direct** : Ajouter des CVs au pipeline depuis la page mission

#### Gestion des Entretiens Multiples
- **Entretiens successifs** : Possibilité de planifier plusieurs entretiens pour un même candidat
- **Types d'entretiens** : Client (bleu), Partenaire (violet), Technique (vert), RH (orange)
- **Impact différencié** : Seul l'entretien "Client" fait passer à l'étape "Entretien planifié"
- **Liste des entretiens** : Modal affichant tous les entretiens (passés, planifiés, annulés)
- **Actions rapides** : Marquer comme terminé ou annuler depuis la liste

#### Onglet Sélection Étendu
- **Page Amélioration** : L'onglet "Sélection" est maintenant disponible sur la page d'amélioration du CV
- **Accès unifié** : Pipeline accessible depuis l'analyse ET l'amélioration

#### Corrections
- **Requête SQL** : Correction de la colonne `global_score` → `global_rating` dans le service pipeline
- **Google SSO** : Prompt OAuth changé de 'select_account' à 'consent' pour garantir le refresh token

#### Documentation
- **Guide utilisateur FR/EN** : Mise à jour de la section Pipeline de Sélection
- **Nouvelles sections** : Vue Kanban, Entretiens multiples, Types d'entretiens

---

## v1.7.5 - 2026-03-01
### 📋 Journal d'Audit RGPD

#### Nouvelle Fonctionnalité : Journal RGPD
- **Table `gdpr_audit_log`** : Nouvelle table pour tracer toutes les actions RGPD
- **Service backend** : `gdprAudit.service.js` pour logger et consulter les actions
- **API REST** : Endpoints `/api/gdpr-audit/*` pour consultation admin
- **Écran admin** : Nouvelle page "Journal RGPD" accessible via Admin → Journal RGPD

#### Actions Journalisées
- **Consentement** : Envoi de demande, rappel, acceptation, refus
- **Données** : Export, suppression, anonymisation
- **CV** : Upload, traitement, purge automatique
- **Automatisé** : Purges planifiées, rappels automatiques

#### Fonctionnalités de l'Écran Admin
- **Filtres avancés** : Par cabinet, catégorie, action, type (auto/manuel), email, dates
- **Statistiques** : Total actions 30j, répartition par catégorie, auto vs manuel
- **Pagination** : Navigation dans les logs avec 25 entrées par page
- **Détails JSON** : Affichage extensible des métadonnées

#### Intégration
- **consent.service.js** : Logging automatique des actions de consentement
- **Purges automatiques** : Traçabilité des suppressions planifiées
- **Multi-cabinet** : Distinction par firm_id pour environnements multi-tenants

#### Documentation
- **Guide utilisateur FR/EN** : Section "Journal d'Audit RGPD" ajoutée
- **Menu navigation** : Lien ajouté dans la section Admin

---

## v1.7.4 - 2026-03-01
### 🛡️ RGPD & DPO - Conformité Renforcée

#### Onglet DPO dans les Paramètres
- **Nouveau** : Onglet "DPO" pour configurer les coordonnées du Délégué à la Protection des Données
- **Champs** : Nom, Email, Téléphone du DPO
- **Intégration** : Sauvegarde via le bouton global des paramètres

#### Email de Consentement RGPD
- **Refonte complète** du template email de demande de consentement
- **Sections détaillées** : Pourquoi nous conservons, données concernées, partage, durée, droits
- **Email DPO dynamique** : Utilise les coordonnées configurées dans les paramètres
- **Design professionnel** : Mise en page moderne avec icônes et couleurs

#### Écran de Consentement Candidat
- **Cohérence** avec l'email de consentement
- **Nouvelles sections** : Traitements automatisés, données concernées, droits RGPD
- **Mention DPO** : Contact pour exercer ses droits

#### Pages Légales
- **Privacy Policy** : Nouvelle page `/privacy` accessible publiquement
- **Terms of Service** : Nouvelle page `/terms` accessible publiquement
- **Footer** : Liens ajoutés vers les pages légales
- **Traductions** : FR/EN complètes

#### Corrections
- **Validation schema** : Accepte les champs DPO dans les settings
- **Migration SQL** : Colonnes DPO ajoutées à `llm_settings`
- **Description service** : Corrigée dans les Conditions d'Utilisation

---

## v1.7.3 - 2026-03-01
### 🚀 Migration React 19 + Express 5

#### Migration Majeure
- **React** : 18.3.1 → 19.1.0
- **React DOM** : 18.3.1 → 19.1.0
- **Express** : 4.22.1 → 5.2.1
- **framer-motion** : 10.18.0 → 12.34.3
- **i18next** : 24.2.3 → 25.8.13
- **@types/react** : 18.3.28 → 19.2.14
- **@types/react-dom** : 18.3.7 → 19.2.3

#### Corrections React 19
- **Compatibilité JSX** : Shim global pour `JSX.Element`
- **framer-motion** : `as const` pour les valeurs `ease`

#### Migration Express 5
- **Wildcard routes** : `app.get('*')` → `app.get('/*splat')`
- **Async handlers** : Gestion automatique des promesses rejetées

#### Nettoyage
- **Suppression** : `@rollup/plugin-node-resolve` (inutile avec Vite 5)
- **Configuration .env** : Nettoyage des duplications

#### Note Technique
- Vite 7 testé mais incompatible (problèmes ESM/CJS)
- Vite 5.4.x maintenu pour stabilité

---

## v1.7.2 - 2026-03-01
### 🔧 Améliorations Qualité & Tests

#### Migration React 19 + Vite 7
- **React** : 18.3.1 → 19.1.0
- **React DOM** : 18.3.1 → 19.1.0
- **@types/react** : 18.3.28 → 19.2.14
- **@types/react-dom** : 18.3.7 → 19.2.3
- **Vite** : 5.4.21 → 7.3.1
- **@vitejs/plugin-react** : 4.7.0 → 5.1.4
- **framer-motion** : 10.18.0 → 12.34.3
- **i18next** : 24.2.3 → 25.8.13
- **react-i18next** : mise à jour pour compatibilité Vite 7
- **Compatibilité JSX** : Shim global pour `JSX.Element`
- **Rollup config** : `shimMissingExports` + `namedExports` pour React

#### Sécurité
- **Vulnérabilité esbuild** : Corrigée via override npm (^0.25.0)
- **Vulnérabilités elliptic** : 6 low severity (dépendances transitives, acceptable)
- **Configuration .env** : Nettoyage des duplications, correction ALLOWED_ORIGINS

#### Tests (+48 nouveaux tests)
- **totp.service.js** : 14 tests (génération secret, vérification 2FA, lifecycle)
- **consent.service.js** : 24 tests (initialisation, validation token, RGPD)
- **mailService.js** : 10 tests (OAuth, connexion, tokens)
- **Total** : 373 tests passés

#### ESLint
- **0 erreurs** (contre 322 avant)
- Configuration ajustée pour règles trop strictes
- Ignores : `client/dist/`, `coverage/`, fichiers timestamp Vite

#### Nettoyage
- **Dépendance supprimée** : `hi-base32` (remplacée par speakeasy)
- **Fichier supprimé** : `smtpService.js` (non utilisé)
- **Configuration Knip** : Mise à jour des ignores
- **78 packages** mis à jour (mineures)

---

## v1.7.1 - 2026-03-01
### 📚 Documentation & Qualité

#### Documentation Swagger Complète
- **Endpoints 2FA** : Documentation des 5 routes `/api/2fa/*`
- **Email Templates** : 10 endpoints pour la gestion des templates MJML
- **Consent RGPD** : 7 endpoints pour la gestion du consentement
- **GDPR Mail** : 5 endpoints pour la configuration email RGPD
- **Admin** : 4 endpoints pour les logs de sécurité et statistiques
- **Schemas** : Ajout de `EmailTemplate`, `ConsentStatus`, `SecurityLog`
- **User schema** : Ajout des champs `totp_enabled`, `totp_enabled_at`
- **LoginRequest/Response** : Support du champ `totpCode` et `requires2FA`

#### Guide Utilisateur
- **Section Profil Utilisateur** : Nouvelle section complète dans USER_GUIDE.md et USER_GUIDE_EN.md
- **Documentation 2FA** : Instructions détaillées pour activer/désactiver le 2FA
- **Navigation** : Ajout de la section dans le menu de UserGuidePage.tsx

#### Corrections
- **Route PUT /api/users/:id** : Ajout de la route manquante pour la mise à jour du profil utilisateur
- **Dépendance otplib** : Suppression (remplacée par speakeasy)
- **Configuration knip** : Nettoyage et mise à jour

#### Tests
- **64 nouveaux tests** : Tests pour `logger.backend.js` et `validation.js`
- **Total** : 325 tests passés

---

## v1.7.0 - 2026-03-01
### 🔐 Authentification à Deux Facteurs (2FA)

#### Nouvelle Fonctionnalité : 2FA TOTP
- **Service TOTP** : Implémentation complète avec `otplib` (RFC 6238)
- **QR Code** : Génération automatique pour Google Authenticator, Authy, etc.
- **Codes de secours** : 8 codes de secours générés et chiffrés en base
- **Flux de login** : Vérification 2FA intégrée au processus de connexion
- **Gestion utilisateur** : Activation, désactivation, régénération des codes

#### Fichiers Backend
- `server/services/totp.service.js` : Service complet de gestion TOTP
- `server/routes/twofa.routes.js` : Routes API `/api/2fa/*`
- `server/routes/auth.routes.js` : Intégration 2FA au login
- `docker/migrations/add_2fa_columns.sql` : Migration SQL

#### Fichiers Frontend
- `TwoFactorSetup.tsx` : Assistant de configuration 2FA avec QR code
- `TwoFactorVerify.tsx` : Écran de vérification lors du login
- `TwoFactorSettings.tsx` : Gestion 2FA dans les paramètres utilisateur
- `SignIn.tsx` : Support du flux 2FA
- `AuthContext.tsx` : Type `SignInResponse` pour 2FA

#### Sécurité
- Secrets TOTP chiffrés en AES-256-GCM
- Codes de secours à usage unique
- Logging des événements 2FA

---

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
 - Stockage des facts dans PostgreSQL (table market_facts)
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
 - Fiabilité améliorée : retry avec backoff exponentiel et circuit breakers pour LLM
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
