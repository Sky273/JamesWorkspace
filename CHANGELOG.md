## v1.9.1 - 2026-04-16
### Ajustements UI CVtheque et coherence des vues liste

#### CVtheque
- Refonte de la vue `CVtheque / Liste` pour reprendre la structure visuelle de la vue `Par affaire` sans la hierarchie par affaire.
- Reutilisation des cartes CV enrichies dans les deux vues pour aligner les actions rapides, le score, l'apercu et les badges.
- Correction du tooltip des tags dans les deux vues CVtheque :
  - positionnement viewport-aware
  - z-index d'overlay explicite
  - fond desormais totalement opaque pour eviter les superpositions visuelles avec les cartes sous-jacentes

#### Missions
- Refonte de la vue `Missions / Liste` sur la base de `Missions / Par affaire`, sans regroupement par affaire.
- Reutilisation de la toolbar, du bloc de synthese et des cartes mission de la vue groupee pour eviter deux rendus concurrents.

#### Qualite
- Alignement de la version applicative sur `v1.9.1`.

---
## v1.9.0 - 2026-04-11
### Administration multi-cabinet et propagation des templates

#### RÃ´les et pÃ©rimÃ¨tres admin
- Renommage du rÃ´le `admin` en `Super administrateur` cÃ´tÃ© interface.
- Introduction du rÃ´le `localAdmin` affichÃ© comme `Administrateur`, avec cloisonnement aux donnÃ©es de son cabinet.
- Restriction des Ã©crans accessibles aux admins locaux Ã  `ModÃ¨les de CV`, `Templates Email`, `Etiquettes` et `Utilisateurs`, sans accÃ¨s Ã  lâ€™onglet `Cabinets`.
- Mise Ã  jour de lâ€™Ã©cran utilisateurs pour permettre lâ€™attribution des rÃ´les `Super administrateur` et `Administrateur`.

#### Cloisonnement par cabinet
- Filtrage backend et frontend des utilisateurs, modÃ¨les CV, templates email et Ã©tiquettes pour les admins locaux sur leur seul cabinet.
- Verrouillage explicite des crÃ©ations, Ã©ditions, duplications et suppressions hors cabinet pour les admins locaux.
- Correction du chargement en boucle de lâ€™Ã©cran utilisateurs provoquÃ© par des dÃ©pendances instables dans les hooks React.

#### Templates email
- Ajout dâ€™une vue super administrateur rÃ©ellement transverse sur tous les templates email, tous cabinets confondus.
- Ajout du badge `Cabinet` sur chaque template email avec affichage du cabinet dâ€™appartenance ou `Global`.
- Correction des contrÃ´les dâ€™accÃ¨s backend pour permettre au super administrateur de consulter, prÃ©visualiser, dupliquer, modifier et supprimer des templates email de nâ€™importe quel cabinet.

#### ModÃ¨les de CV et duplication
- Ajout de lâ€™action de duplication pour les super administrateurs sur les modÃ¨les de CV et les templates email, avec choix du cabinet cible.
- Correction des validations backend pour forcer les admins locaux sur leur propre cabinet.
- Correction de lâ€™unicitÃ© des noms de modÃ¨les CV en base de donnÃ©es : unicitÃ© dÃ©sormais par cabinet, avec gestion sÃ©parÃ©e des modÃ¨les globaux.

#### Base de donnÃ©es
- Ajout de la migration du rÃ´le `localAdmin` dans la contrainte SQL des utilisateurs.
- Ajout de la migration de contrainte dâ€™unicitÃ© des modÃ¨les CV par cabinet.

#### Navigation et interface admin
- DÃ©placement de `Logs de sÃ©curitÃ©` et `Journal RGPD` dans la section basse du menu, avant le `Guide utilisateur`.
- Confirmation de lâ€™accÃ¨s au `Guide utilisateur` pour les utilisateurs standards et les admins locaux.

#### QualitÃ©
- Renforcement des tests ciblÃ©s frontend et backend sur les rÃ´les, le cloisonnement, les duplications et les templates email.
- Alignement de la version applicative sur `v1.9.0`.

---
## v1.8.9 - 2026-04-07
### QualitÃ© frontend, overlays CV et gouvernance des prompts

#### Parcours CV et analyse
- Lâ€™overlay fullscreen pendant lâ€™analyse et lâ€™amÃ©lioration de CV couvre dÃ©sormais correctement tout le viewport, y compris le footer applicatif et le bouton du chatbot.
- Le rendu des Ã©crans de traitement CV a Ã©tÃ© sÃ©curisÃ© via montage portail au niveau `document.body`, pour Ã©viter les problÃ¨mes de stacking context sur les shells Ã©ditoriaux.

#### Prompt de prÃ©analyse
- Remplacement du prompt de prÃ©analyse CV par une nouvelle version orientÃ©e canonicalisation Markdown, plus stricte sur la fidÃ©litÃ© au contenu source et la structuration des sorties.
- Mise Ã  jour de la gouvernance associÃ©e du prompt de prÃ©analyse pour reflÃ©ter cette nouvelle rÃ©vision.

#### CRM / deals
- Ajout dâ€™une action de consultation sur les cartes deal.
- CrÃ©ation dâ€™une vue de consultation deal rÃ©utilisable et dâ€™une page dÃ©diÃ©e accessible par route.

#### UX/UI ciblÃ©e
- AmÃ©lioration ciblÃ©e des vues `Templates email`, `Etiquettes` et `Logs de sÃ©curitÃ©`.
- Ajout dâ€™un smoke test Playwright admin sur ces pages pour verrouiller les parcours essentiels.

#### QualitÃ©
- Alignement de la version applicative sur `v1.8.9`.
- VÃ©rifications ciblÃ©es maintenues sur les changements rÃ©cents frontend et backend.

---

## v1.8.8 - 2026-03-30
### Fiabilisation plateforme, backup, cache et refactors structurels

#### Couverture frontend et e2e
- Renforcement massif de la couverture frontend sur les parcours critiques : routing/protection, upload, analysis, export, adapt, settings et batch upload.
- Ajout de parcours Playwright authentifiÃ©s stables avec bootstrap automatique d'un utilisateur `active` et injection de cookies JWT pour Ã©viter les collisions avec le rate limiting auth.
- Nouvelles specs e2e mÃ©tier : navigation protÃ©gÃ©e, formulaire GDPR upload, flux complet `upload -> analysis` et flux `analysis -> improve -> export`.
- La stack Playwright dÃ©marre dÃ©sormais le proxy applicatif et le `pdf-server`, avec bootstrap automatique d'un template d'export pour l'utilisateur e2e.

#### Nettoyage des reliquats CV
- Confirmation et documentation du fait que le flux mÃ©tier supportÃ© pour l'import, l'analyse et l'amÃ©lioration des CVs passe par `batch-jobs`.
- Suppression de l'ancien endpoint direct `POST /api/resumes/upload` cÃ´tÃ© serveur.
- Conservation des endpoints techniques `extract-pdf` et `extract-doc`, encore utilisÃ©s par le frontend pour l'extraction de texte.
- Suppression des handlers LLM legacy non montÃ©s dans le routeur `resumes`.

#### RÃ©silience et observabilitÃ©
- Alignement du diagnostic `Ã‰tat du systÃ¨me` avec lâ€™architecture rÃ©elle : santÃ© plateforme, backend cache, Redis, mÃ©moire, providers LLM et circuit breakers.
- Ajout de lâ€™affichage mÃ©moire consommÃ©e / max dans lâ€™indicateur systÃ¨me, avec seuils visuels adaptÃ©s.
- RÃ©duction de lâ€™impact des familles LLM sur lâ€™Ã©tat global : tant quâ€™au moins un provider reste exploitable, le badge systÃ¨me nâ€™est plus dÃ©gradÃ© par redondance.
- Exposition du backend de cache effectif (`redis`, `memory`, `memory-fallback`) dans `/health`, `/api/admin/cache-stats` et lâ€™admin.

#### Backup et diagnostics utilisateurs
- Correction des erreurs FTP/SFTP remontÃ©es brutes dans lâ€™UI backup.
- Mapping explicite des erreurs techniques de connexion distante : certificat TLS invalide, timeout, refus de connexion, Ã©chec dâ€™authentification, chemin distant introuvable.
- Le cas `self-signed certificate` nâ€™est plus affichÃ© tel quel Ã  lâ€™utilisateur.
- Nettoyage de la locale FR backup et des libellÃ©s visibles de la page de sauvegarde.

#### Cache et dÃ©ploiement
- Abstraction de cache finalisÃ©e avec backend `memory|redis`.
- IntÃ©gration Redis dans le setup Docker et ajout dâ€™un mode avec Redis sÃ©parÃ© du conteneur applicatif.
- Harmonisation des scripts `docker-build.bat`, `docker-run.bat`, `docker-stop.bat` et `.env.docker` autour de cette architecture.

#### Refactors backend
- DÃ©coupage de `metrics.service.js` en modules dÃ©diÃ©s : Ã©tat, LLM, persistance, snapshots, opÃ©rations.
- DÃ©coupage de `openai/resumeOperations.js` avec extraction de la normalisation CV.
- DÃ©coupage de `openai/missionOperations.js` avec extraction de la normalisation matching/adaptation.
- DÃ©coupage du domaine `marketTrends` en faÃ§ade, runtime de collecte, extracteurs et persistance.
- DÃ©coupage de `marketFacts.service.js` en faÃ§ade, cache et persistance.

#### Refactors front et i18n
- DÃ©coupage supplÃ©mentaire des pages lourdes : mÃ©triques, settings, Ã©crans `Resume*`.
- Modularisation des locales `fr` et `en` par domaines logiques pour amÃ©liorer la maintenabilitÃ©.
- Nettoyage et centralisation des chaÃ®nes UI visibles sur les Ã©crans principaux.

#### QualitÃ©
- Les suites client et serveur restent vertes aprÃ¨s ces changements.
- Tests ciblÃ©s ajoutÃ©s pour les erreurs TLS backup et les nouveaux chemins normalisÃ©s.

---

## v1.8.7 - 2026-03-21
### ðŸ“Š Suivi de Progression des Collectes Market Radar

#### Jobs de Collecte â€” Progression en Temps RÃ©el
- **Collecte mÃ©tiers** : Ajout d'un callback `onProgress` Ã  `collectITMetiers` pour mise Ã  jour incrÃ©mentale aprÃ¨s chaque mÃ©tier traitÃ©
- **Collecte offres (facts)** : Ajout d'un callback `onProgress` Ã  `runFullCollection` et `runSourceCollection` avec mise Ã  jour toutes les 5 secondes
- **Collecte tendances** : RÃ©duction de l'intervalle de progression de 30s Ã  5s pour un affichage plus rÃ©actif

#### Estimation du Total DÃ¨s le Lancement
- **Offres France Travail** : Calcul du total attendu `(romeCodes Ã— rÃ©gions) + keywords` avant la boucle de collecte, via callback `onTotalEstimated`
- **Tendances** : Calcul du total attendu `5 Ã— (romeCodes Ã— rÃ©gions) + romeCodes + rÃ©gions` dÃ¨s le chargement des mÃ©tiers IT
- **Barre de progression** : Le nombre cible (ex: `120 / 1854`) s'affiche immÃ©diatement au lieu de `0 / 0`

#### Correction UPSERT Offres
- **storeFact** : Remplacement de l'INSERT simple par un `INSERT ... ON CONFLICT DO UPDATE` pour Ã©viter les erreurs de clÃ© dupliquÃ©e lors des re-collectes sur la contrainte `(keyword, location, source, date)`

#### QualitÃ©
- **108 tests serveur** passent aprÃ¨s les modifications
- **Aucune rÃ©gression** sur les tests client et pdf-server

---

## v1.8.6 - 2026-03-17
### âœï¸ Ã‰diteur Tiptap, Vues GroupÃ©es par Affaire & Prompts LLM

#### Migration Ã‰diteur TinyMCE â†’ Tiptap/ProseMirror
- **Nouvel Ã©diteur** : Remplacement complet de TinyMCE par Tiptap v3 (ProseMirror)
- **Toolbar contextuelle** : Bubble toolbar avec modes image, lien et texte
- **Toolbar principale** : Menu dÃ©roulant titres (H1-H4), menu tableau, boutons formatage
- **SystÃ¨me de suggestions** : Extension ProseMirror avec badges par section, scoring de correspondance et panneau global
- **Nettoyage** : Suppression des fichiers statiques TinyMCE et du script tag HTML

#### Vues GroupÃ©es par Affaire
- **Missions par affaire** : Nouveau composant `MissionsDealsGroupedView` avec sections dÃ©pliables par deal, cartes mission et compteurs d'adaptations
- **Adaptations par affaire** : Nouveau composant `AdaptationsDealsGroupedView` avec hiÃ©rarchie Deal â†’ Mission â†’ Adaptations, recherche intÃ©grÃ©e et navigation vers les dÃ©tails
- **API backend** : Nouvel endpoint `GET /api/adaptations/grouped-by-deal` avec requÃªtes batch optimisÃ©es
- **Toggle vue** : SÃ©lecteur "Par affaire" / "Liste" sur les pages Missions et Adaptations

#### Prompts LLM RestructurÃ©s
- **Prompt d'analyse/matching** : Format markdown structurÃ© avec rÃ¨gles anti-hallucination strictes
- **Prompt d'adaptation** : Directives par section, conservation du contenu original, suppression des inventions
- **Prompt d'amÃ©lioration** : Formatage backtick, rÃ¨gles de rÃ©sumÃ© impersonnel, vÃ©rification d'existence des sections

#### AmÃ©liorations UI/UX
- **Animation d'amÃ©lioration** : Nouveau design avec carte inline, spinner multi-anneau et messages d'Ã©tat cycliques
- **Stepper de progression** : Spinners animÃ©s et fonds dÃ©gradÃ©s pour les Ã©tats de chargement
- **Preview CV inline** : Panneau de prÃ©visualisation avec chargement paresseux sur les cartes CV par affaire
- **PrioritÃ© d'affichage** : Inversion Nom du CV / Nom du candidat dans les adaptations

#### Documentation
- **SECURITY.md** : Mise Ã  jour complÃ¨te (circuit breakers LLM, APM, mÃ©triques, endpoints publics, validation environnement, 9 nouvelles entrÃ©es checklist, table de rÃ©fÃ©rence fichiers corrigÃ©e)
- **ARCHITECTURE.md** : Mise Ã  jour pour reflÃ©ter la migration Tiptap, le routage modulaire et les nouvelles fonctionnalitÃ©s
- **INSTALL.md** : Mise Ã  jour de la documentation d'installation

---

## v1.8.5 - 2026-03-16
### ðŸ§ª Tests Routes Backend Complets

#### Nouveaux Tests Routes
- **missions.routes.test.js** : 34 tests couvrant GET /, GET /:id, POST /, PUT /:id, DELETE /:id, GET /:missionId/adaptations
- **Suite complÃ¨te** : 10 fichiers de tests, 197 tests passent

#### Corrections Tests Existants
- **batchJobs.routes.test.js** : Correction des mocks (`vi.resetAllMocks` au lieu de `clearAllMocks`), mock multer pour `req.body`, alignement avec les vraies routes
- **clients.routes.test.js** : Correction rÃ©ponse `data` vs `clients`, ajout mocks multi-requÃªtes (contacts, submissions)
- **deals.routes.test.js** : Ajout mock pour vÃ©rification firm du resume dans POST /:id/resumes
- **adaptations.routes.test.js** : Correction `data` vs `records`, `findWithTimeout` lance une erreur 404 au lieu de retourner `null`

#### AmÃ©liorations Techniques
- **Mocks factory functions** : `userRateLimit` correctement mockÃ© comme factory `() => middleware`
- **Isolation des tests** : `vi.resetAllMocks()` pour Ã©viter les fuites de mocks entre tests
- **Couverture routes critiques** : auth, resumes, missions, clients, deals, adaptations, batchJobs, health

---

## v1.8.4 - 2026-03-12
### ðŸ“¦ Export Multi-Format & QualitÃ© Code

#### Export par Lot Multi-Format
- **SÃ©lection multiple** : Remplacement des radio buttons par des checkboxes pour sÃ©lectionner plusieurs formats (PDF, DOCX, DOC)
- **Dossiers par type** : Le ZIP d'export contient maintenant un dossier par format sÃ©lectionnÃ© (PDF/, DOCX/, DOC/)
- **Rate limit augmentÃ©** : Limite PDF serveur passÃ©e de 200 Ã  300 req/min pour supporter 100 docs Ã— 3 formats
- **Animation de chargement** : Feedback visuel lors du dÃ©pÃ´t de fichiers dans la zone de drop

#### QualitÃ© Code
- **Tests corrigÃ©s** : Migration du fichier `resumes.routes.test.js` de Jest vers Vitest
- **Lint fixes** : Correction de 22 erreurs ESLint (imports inutilisÃ©s)
- **Variables prÃ©fixÃ©es** : ~20 variables catch/paramÃ¨tres inutilisÃ©s prÃ©fixÃ©s avec `_`
- **396 tests passent** : Tous les tests unitaires et d'intÃ©gration passent

#### Corrections Techniques
- **Gestion des doublons** : Les fichiers avec le mÃªme nom reÃ§oivent un suffixe numÃ©rique dans le ZIP
- **Validation frontend** : Le bouton "Traiter" est dÃ©sactivÃ© si l'export est activÃ© mais aucun format n'est sÃ©lectionnÃ©

---

## v1.8.3 - 2026-03-11
### ðŸ”§ Corrections Scheduler Backup & Radar du MarchÃ©

#### Corrections Scheduler de Sauvegarde
- **Initialisation correcte** : `initBackupScheduler()` dÃ©placÃ© dans le bloc DB connectÃ© pour garantir l'exÃ©cution aprÃ¨s connexion Ã  la base
- **CrÃ©ation automatique des tables** : Nouvelle fonction `initBackupTables()` crÃ©e automatiquement `backup_settings` et `backup_history` au dÃ©marrage
- **Gestion des erreurs** : Meilleure gestion des erreurs DB lors du chargement des paramÃ¨tres de sauvegarde

#### Corrections Radar du MarchÃ©
- **Valeurs carte de France** : Correction de l'affichage des chiffres sur la carte (offres d'emploi, embauches, etc.)
- **Conversion NULL/DECIMAL** : Les valeurs NULL sont maintenant converties en 0, les DECIMAL en nombres cÃ´tÃ© serveur
- **4 fonctions corrigÃ©es** : `getStoredTrendsLight`, `getStoredTrendsWithMetadata`, `getTrendMetadata`, `loadTrendsCache`

#### AmÃ©liorations Techniques
- **Import statique** : Conversion de l'import dynamique `apiInterceptor` en import statique dans `textExtraction.ts` (supprime le warning Rollup)
- **Types API** : Nouveau fichier `client/src/types/api.ts` avec types standardisÃ©s pour les rÃ©ponses API
- **Index types** : Nouveau fichier `client/src/types/index.ts` pour exports centralisÃ©s

---

## v1.8.2 - 2026-03-09
### ðŸ–¨ï¸ Refactoring PDF Server

#### GÃ©nÃ©ration de documents
- **PDF** : GÃ©nÃ©ration via Puppeteer avec support des headers/footers natifs
- **Headers/Footers** : Support natif des headers dans le body et footers dans les marges de page
- **Compteurs de pages** : Support des placeholders `-pageNumber-` et `-totalPages-`
- **DOCX** : GÃ©nÃ©ration via Pandoc avec injection de footer Word natif en post-traitement
- **DOC** : Conversion PDF â†’ DOC via LibreOffice

#### Refactoring du Serveur PDF
- **Architecture modulaire** : `server.cjs` divisÃ© en modules sÃ©parÃ©s pour une meilleure maintenabilitÃ©
  - `lib/logger.cjs` : Utilitaire de logging centralisÃ©
  - `lib/htmlBuilder.cjs` : Construction HTML pour Puppeteer
  - `lib/pdfGenerator.cjs` : GÃ©nÃ©ration PDF via Puppeteer
  - `lib/docxGenerator.cjs` : GÃ©nÃ©ration DOCX/DOC (Pandoc + LibreOffice)
- **Code rÃ©duit** : `server.cjs` rÃ©duit de ~670 Ã  ~320 lignes
- **TestabilitÃ©** : Fonctions exportables pour tests unitaires

---

## v1.8.1 - 2026-03-09
### ðŸ”§ Corrections de StabilitÃ© & SÃ©curitÃ©

#### Corrections de SÃ©curitÃ©
- **Sanitization XSS** : Ajout de `createSafeHtml()` pour tous les rendus HTML dynamiques (VersionsPanel, ExportTab, CompareTab)
- **Configuration proxy** : Correction de la dÃ©tection d'IP pour le rate limiting derriÃ¨re reverse proxy

#### Corrections de StabilitÃ©
- **Statut sauvegarde** : Correction du statut "Running" qui restait affichÃ© aprÃ¨s une sauvegarde terminÃ©e
- **Nettoyage automatique** : Les sauvegardes bloquÃ©es depuis plus de 30 minutes sont automatiquement marquÃ©es comme Ã©chouÃ©es
- **Scheduler de sauvegarde** : DÃ©marrage explicite des jobs cron avec `.start()` pour garantir leur exÃ©cution

#### AmÃ©liorations Techniques
- **RÃ©fÃ©rence base de donnÃ©es** : Correction des rÃ©fÃ©rences obsolÃ¨tes vers l'ancienne table `customers` (renommÃ©e `firms`)
- **Limite chatbot** : Augmentation de la limite du guide utilisateur de 60000 Ã  100000 caractÃ¨res
- **Nettoyage logs** : Suppression des `console.log` de debug dans le preview PDF

---

## v1.8.0 - 2026-03-08
### ðŸ—„ï¸ Page Sauvegarde DÃ©diÃ©e & Corrections FTP/TLS

#### Nouvelle Page Sauvegarde
- **Page dÃ©diÃ©e** : Nouvelle page "Sauvegarde" accessible depuis le menu principal (admin uniquement)
- **URL** : `/dashboard/backup` avec protection AdminRoute
- **Menu** : EntrÃ©e "Sauvegarde" dans la partie basse du menu, entre ParamÃ¨tres et Guide Utilisateur
- **Traductions** : Namespace `backup.*` complet en franÃ§ais et anglais

#### Sauvegarde FTP/SFTP
- **Modes TLS** : Support complet des modes TLS (Explicite AUTH TLS, Implicite port 990, Aucun)
- **Correction FTP** : RÃ©solution de l'erreur "503 Use AUTH first" - AUTH TLS envoyÃ© avant USER
- **Validation Zod** : SchÃ©mas de validation pour les paramÃ¨tres de sauvegarde
- **Planification** : Sauvegardes quotidiennes, hebdomadaires et mensuelles avec rÃ©tention configurable

#### Scripts Docker
- **docker-logs.bat** : Affiche les logs du Proxy Server (backend principal)
- **docker-logs-pdf.bat** : Nouveau script pour les logs du PDF Server
- **Documentation** : Section "Viewing Logs" ajoutÃ©e dans docker/README.md

#### AmÃ©liorations Techniques
- **basic-ftp** : Correction du paramÃ¨tre `secure` (true pour explicite, "implicit" pour implicite)
- **Logging** : Logs dÃ©taillÃ©s pour le diagnostic des connexions FTP/SFTP

---

## v1.7.9 - 2026-03-08
### ðŸ  Page d'Accueil Publique & Stockage Logo en Base

#### Page d'Accueil Publique
- **Nouvelle page** : Page d'accueil publique pour les utilisateurs non connectÃ©s (`/welcome`)
- **Header public** : Boutons "Se connecter" et "S'inscrire" stylisÃ©s de maniÃ¨re cohÃ©rente
- **Section Hero** : RÃ©utilisation de la hero zone de la page d'accueil principale
- **Footer** : Affichage du footer de l'application
- **Configuration** : Variable d'environnement `VITE_PUBLIC_HOME=true` pour activer la page publique
- **Redirection intelligente** : Les utilisateurs non connectÃ©s sont redirigÃ©s vers `/welcome` si activÃ©

#### Stockage Logo Cabinet en Base de DonnÃ©es
- **Nouveau champ** : `logo_data` (BYTEA) et `logo_mime_type` dans la table `firms`
- **Persistance Docker** : Les logos sont maintenant stockÃ©s en base de donnÃ©es (plus de perte lors des rebuilds)
- **Route API** : `GET /api/firms/:id/logo/image` pour servir les logos depuis la base
- **Migration** : `add_firm_logo_data.sql` pour les bases existantes

#### AmÃ©liorations UI
- **Footer sur Register** : Ajout du footer sur la page d'inscription (comme sur SignIn)
- **Boutons cohÃ©rents** : Style unifiÃ© pour les boutons de connexion/inscription

---

## v1.7.8 - 2026-03-07
### ðŸ³ Docker AmÃ©liorations & Documentation APM

#### Docker
- **Port HTTPS** : Utilisation du port 3443 (au lieu de 443) pour Ã©viter les conflits de permissions
- **Mot de passe PostgreSQL sÃ©curisÃ©** : Nouveau mot de passe sÃ©curisÃ© (voir documentation interne)
- **Scripts .bat Windows** : Nouveaux scripts simplifiÃ©s Ã  la racine (`docker-build.bat`, `docker-run.bat`, `docker-stop.bat`, `docker-logs.bat`, `docker-shell.bat`)
- **Google Chrome** : Utilisation de Google Chrome au lieu de Chromium pour la gÃ©nÃ©ration PDF (meilleure compatibilitÃ©)

#### Documentation
- **INSTALL.md** : Simplification de la section Docker avec scripts .bat comme mÃ©thode recommandÃ©e
- **ARCHITECTURE.md** : 
  - Nouvelle section "Monitoring & APM" documentant l'APM interne
  - Tableau comparatif APM interne vs externe (Datadog, New Relic)
  - Ajout des identifiants PostgreSQL Docker
  - Ajout des scripts .bat Windows
- **docker/README.md** : Mise Ã  jour des ports et credentials

#### Corrections
- **Puppeteer** : Correction du chemin exÃ©cutable dans `supervisord.conf` (`google-chrome-stable`)
- **CohÃ©rence mot de passe** : Synchronisation entre crÃ©ation utilisateur PostgreSQL et variable d'environnement

---

## v1.7.7 - 2026-03-05
### ðŸ³ Docker PostgreSQL 18 & Documentation

#### Configuration Docker
- **PostgreSQL 18** : Mise Ã  jour de PostgreSQL 14 vers 18 pour cohÃ©rence avec l'environnement hors Docker
- **Secrets stables** : Les secrets JWT ne sont plus gÃ©nÃ©rÃ©s alÃ©atoirement Ã  chaque dÃ©marrage (Ã©vite dÃ©connexions)
- **Variables complÃ¨tes** : Ajout de `REFRESH_TOKEN_SECRET`, `CSRF_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MAIL_TOKEN_ENCRYPTION_KEY`
- **Volume PostgreSQL** : Chemin mis Ã  jour vers `/var/lib/postgresql/18/main`

#### Documentation
- **INSTALL.md** : Commande Docker complÃ¨te avec tous les secrets et volume PostgreSQL
- **ARCHITECTURE.md** : Nouvelle section "DÃ©ploiement Docker" avec schÃ©ma d'architecture conteneur
- **docker/README.md** : Mise Ã  jour des chemins PostgreSQL 18

#### Guide Utilisateur
- **Bonnes Pratiques** : Section entiÃ¨rement rÃ©Ã©crite pour couvrir l'application complÃ¨te
  - ðŸ“„ Gestion des CV (import, qualitÃ©, structure)
  - ðŸŽ¯ Missions et Matching (crÃ©ation, optimisation)
  - ðŸ‘¥ Clients et Contacts (organisation, suivi)
  - ðŸ“Š Pipeline de Recrutement (gestion par Ã©tape)
  - âœ‰ï¸ Envoi de CV (prÃ©paration, bonnes pratiques)
  - ðŸ”’ ConformitÃ© RGPD (consentement, audit)
  - ðŸ“ˆ Market Radar (veille marchÃ©)
  - âš™ï¸ Administration (configuration, sÃ©curitÃ©)
  - ðŸ”„ Workflow RecommandÃ© (schÃ©ma complet)
  - ðŸ’¡ Conseils de ProductivitÃ©
- **Guide EN** : SynchronisÃ© avec la version franÃ§aise

#### Corrections
- **UserGuidePage** : Correction du regex d'extraction de section (matchait `###` au lieu de `##`)

---

## v1.7.6 - 2026-03-04
### ðŸ“Š Pipeline Kanban & Entretiens Multiples

#### Vue Kanban au Niveau Mission
- **Nouveau** : Tableau Kanban intÃ©grÃ© sur la page de dÃ©tail de chaque mission
- **Colonnes par Ã©tape** : Visualisation des candidats par Ã©tape du pipeline
- **Drag & Drop** : Glisser-dÃ©poser pour changer l'Ã©tape d'un candidat
- **Cartes candidats** : Affichent nom, score, tags, notes, date, nombre d'entretiens
- **Ajout direct** : Ajouter des CVs au pipeline depuis la page mission

#### Gestion des Entretiens Multiples
- **Entretiens successifs** : PossibilitÃ© de planifier plusieurs entretiens pour un mÃªme candidat
- **Types d'entretiens** : Client (bleu), Partenaire (violet), Technique (vert), RH (orange)
- **Impact diffÃ©renciÃ©** : Seul l'entretien "Client" fait passer Ã  l'Ã©tape "Entretien planifiÃ©"
- **Liste des entretiens** : Modal affichant tous les entretiens (passÃ©s, planifiÃ©s, annulÃ©s)
- **Actions rapides** : Marquer comme terminÃ© ou annuler depuis la liste

#### Onglet SÃ©lection Ã‰tendu
- **Page AmÃ©lioration** : L'onglet "SÃ©lection" est maintenant disponible sur la page d'amÃ©lioration du CV
- **AccÃ¨s unifiÃ©** : Pipeline accessible depuis l'analyse ET l'amÃ©lioration

#### Corrections
- **RequÃªte SQL** : Correction de la colonne `global_score` â†’ `global_rating` dans le service pipeline
- **Google SSO** : Prompt OAuth changÃ© de 'select_account' Ã  'consent' pour garantir le refresh token

#### Documentation
- **Guide utilisateur FR/EN** : Mise Ã  jour de la section Pipeline de SÃ©lection
- **Nouvelles sections** : Vue Kanban, Entretiens multiples, Types d'entretiens

---

## v1.7.5 - 2026-03-01
### ðŸ“‹ Journal d'Audit RGPD

#### Nouvelle FonctionnalitÃ© : Journal RGPD
- **Table `gdpr_audit_log`** : Nouvelle table pour tracer toutes les actions RGPD
- **Service backend** : `gdprAudit.service.js` pour logger et consulter les actions
- **API REST** : Endpoints `/api/gdpr-audit/*` pour consultation admin
- **Ã‰cran admin** : Nouvelle page "Journal RGPD" accessible via Admin â†’ Journal RGPD

#### Actions JournalisÃ©es
- **Consentement** : Envoi de demande, rappel, acceptation, refus
- **DonnÃ©es** : Export, suppression, anonymisation
- **CV** : Upload, traitement, purge automatique
- **AutomatisÃ©** : Purges planifiÃ©es, rappels automatiques

#### FonctionnalitÃ©s de l'Ã‰cran Admin
- **Filtres avancÃ©s** : Par cabinet, catÃ©gorie, action, type (auto/manuel), email, dates
- **Statistiques** : Total actions 30j, rÃ©partition par catÃ©gorie, auto vs manuel
- **Pagination** : Navigation dans les logs avec 25 entrÃ©es par page
- **DÃ©tails JSON** : Affichage extensible des mÃ©tadonnÃ©es

#### IntÃ©gration
- **consent.service.js** : Logging automatique des actions de consentement
- **Purges automatiques** : TraÃ§abilitÃ© des suppressions planifiÃ©es
- **Multi-cabinet** : Distinction par firm_id pour environnements multi-tenants

#### Documentation
- **Guide utilisateur FR/EN** : Section "Journal d'Audit RGPD" ajoutÃ©e
- **Menu navigation** : Lien ajoutÃ© dans la section Admin

---

## v1.7.4 - 2026-03-01
### ðŸ›¡ï¸ RGPD & DPO - ConformitÃ© RenforcÃ©e

#### Onglet DPO dans les ParamÃ¨tres
- **Nouveau** : Onglet "DPO" pour configurer les coordonnÃ©es du DÃ©lÃ©guÃ© Ã  la Protection des DonnÃ©es
- **Champs** : Nom, Email, TÃ©lÃ©phone du DPO
- **IntÃ©gration** : Sauvegarde via le bouton global des paramÃ¨tres

#### Email de Consentement RGPD
- **Refonte complÃ¨te** du template email de demande de consentement
- **Sections dÃ©taillÃ©es** : Pourquoi nous conservons, donnÃ©es concernÃ©es, partage, durÃ©e, droits
- **Email DPO dynamique** : Utilise les coordonnÃ©es configurÃ©es dans les paramÃ¨tres
- **Design professionnel** : Mise en page moderne avec icÃ´nes et couleurs

#### Ã‰cran de Consentement Candidat
- **CohÃ©rence** avec l'email de consentement
- **Nouvelles sections** : Traitements automatisÃ©s, donnÃ©es concernÃ©es, droits RGPD
- **Mention DPO** : Contact pour exercer ses droits

#### Pages LÃ©gales
- **Privacy Policy** : Nouvelle page `/privacy` accessible publiquement
- **Terms of Service** : Nouvelle page `/terms` accessible publiquement
- **Footer** : Liens ajoutÃ©s vers les pages lÃ©gales
- **Traductions** : FR/EN complÃ¨tes

#### Corrections
- **Validation schema** : Accepte les champs DPO dans les settings
- **Migration SQL** : Colonnes DPO ajoutÃ©es Ã  `llm_settings`
- **Description service** : CorrigÃ©e dans les Conditions d'Utilisation

---

## v1.7.3 - 2026-03-01
### ðŸš€ Migration React 19 + Express 5

#### Migration Majeure
- **React** : 18.3.1 â†’ 19.1.0
- **React DOM** : 18.3.1 â†’ 19.1.0
- **Express** : 4.22.1 â†’ 5.2.1
- **framer-motion** : 10.18.0 â†’ 12.34.3
- **i18next** : 24.2.3 â†’ 25.8.13
- **@types/react** : 18.3.28 â†’ 19.2.14
- **@types/react-dom** : 18.3.7 â†’ 19.2.3

#### Corrections React 19
- **CompatibilitÃ© JSX** : Shim global pour `JSX.Element`
- **framer-motion** : `as const` pour les valeurs `ease`

#### Migration Express 5
- **Wildcard routes** : `app.get('*')` â†’ `app.get('/*splat')`
- **Async handlers** : Gestion automatique des promesses rejetÃ©es

#### Nettoyage
- **Suppression** : `@rollup/plugin-node-resolve` (inutile avec Vite 5)
- **Configuration .env** : Nettoyage des duplications

#### Note Technique
- Vite 7 testÃ© mais incompatible (problÃ¨mes ESM/CJS)
- Vite 5.4.x maintenu pour stabilitÃ©

---

## v1.7.2 - 2026-03-01
### ðŸ”§ AmÃ©liorations QualitÃ© & Tests

#### Migration React 19 + Vite 7
- **React** : 18.3.1 â†’ 19.1.0
- **React DOM** : 18.3.1 â†’ 19.1.0
- **@types/react** : 18.3.28 â†’ 19.2.14
- **@types/react-dom** : 18.3.7 â†’ 19.2.3
- **Vite** : 5.4.21 â†’ 7.3.1
- **@vitejs/plugin-react** : 4.7.0 â†’ 5.1.4
- **framer-motion** : 10.18.0 â†’ 12.34.3
- **i18next** : 24.2.3 â†’ 25.8.13
- **react-i18next** : mise Ã  jour pour compatibilitÃ© Vite 7
- **CompatibilitÃ© JSX** : Shim global pour `JSX.Element`
- **Rollup config** : `shimMissingExports` + `namedExports` pour React

#### SÃ©curitÃ©
- **VulnÃ©rabilitÃ© esbuild** : CorrigÃ©e via override npm (^0.25.0)
- **VulnÃ©rabilitÃ©s elliptic** : 6 low severity (dÃ©pendances transitives, acceptable)
- **Configuration .env** : Nettoyage des duplications, correction ALLOWED_ORIGINS

#### Tests (+48 nouveaux tests)
- **totp.service.js** : 14 tests (gÃ©nÃ©ration secret, vÃ©rification 2FA, lifecycle)
- **consent.service.js** : 24 tests (initialisation, validation token, RGPD)
- **mailService.js** : 10 tests (OAuth, connexion, tokens)
- **Total** : 373 tests passÃ©s

#### ESLint
- **0 erreurs** (contre 322 avant)
- Configuration ajustÃ©e pour rÃ¨gles trop strictes
- Ignores : `client/dist/`, `coverage/`, fichiers timestamp Vite

#### Nettoyage
- **DÃ©pendance supprimÃ©e** : `hi-base32` (remplacÃ©e par speakeasy)
- **Fichier supprimÃ©** : `smtpService.js` (non utilisÃ©)
- **Configuration Knip** : Mise Ã  jour des ignores
- **78 packages** mis Ã  jour (mineures)

---

## v1.7.1 - 2026-03-01
### ðŸ“š Documentation & QualitÃ©

#### Documentation Swagger ComplÃ¨te
- **Endpoints 2FA** : Documentation des 5 routes `/api/2fa/*`
- **Email Templates** : 10 endpoints pour la gestion des templates MJML
- **Consent RGPD** : 7 endpoints pour la gestion du consentement
- **GDPR Mail** : 5 endpoints pour la configuration email RGPD
- **Admin** : 4 endpoints pour les logs de sÃ©curitÃ© et statistiques
- **Schemas** : Ajout de `EmailTemplate`, `ConsentStatus`, `SecurityLog`
- **User schema** : Ajout des champs `totp_enabled`, `totp_enabled_at`
- **LoginRequest/Response** : Support du champ `totpCode` et `requires2FA`

#### Guide Utilisateur
- **Section Profil Utilisateur** : Nouvelle section complÃ¨te dans USER_GUIDE.md et USER_GUIDE_EN.md
- **Documentation 2FA** : Instructions dÃ©taillÃ©es pour activer/dÃ©sactiver le 2FA
- **Navigation** : Ajout de la section dans le menu de UserGuidePage.tsx

#### Corrections
- **Route PUT /api/users/:id** : Ajout de la route manquante pour la mise Ã  jour du profil utilisateur
- **DÃ©pendance otplib** : Suppression (remplacÃ©e par speakeasy)
- **Configuration knip** : Nettoyage et mise Ã  jour

#### Tests
- **64 nouveaux tests** : Tests pour `logger.backend.js` et `validation.js`
- **Total** : 325 tests passÃ©s

---

## v1.7.0 - 2026-03-01
### ðŸ” Authentification Ã  Deux Facteurs (2FA)

#### Nouvelle FonctionnalitÃ© : 2FA TOTP
- **Service TOTP** : ImplÃ©mentation complÃ¨te avec `otplib` (RFC 6238)
- **QR Code** : GÃ©nÃ©ration automatique pour Google Authenticator, Authy, etc.
- **Codes de secours** : 8 codes de secours gÃ©nÃ©rÃ©s et chiffrÃ©s en base
- **Flux de login** : VÃ©rification 2FA intÃ©grÃ©e au processus de connexion
- **Gestion utilisateur** : Activation, dÃ©sactivation, rÃ©gÃ©nÃ©ration des codes

#### Fichiers Backend
- `server/services/totp.service.js` : Service complet de gestion TOTP
- `server/routes/twofa.routes.js` : Routes API `/api/2fa/*`
- `server/routes/auth.routes.js` : IntÃ©gration 2FA au login
- `docker/migrations/add_2fa_columns.sql` : Migration SQL

#### Fichiers Frontend
- `TwoFactorSetup.tsx` : Assistant de configuration 2FA avec QR code
- `TwoFactorVerify.tsx` : Ã‰cran de vÃ©rification lors du login
- `TwoFactorSettings.tsx` : Gestion 2FA dans les paramÃ¨tres utilisateur
- `SignIn.tsx` : Support du flux 2FA
- `AuthContext.tsx` : Type `SignInResponse` pour 2FA

#### SÃ©curitÃ©
- Secrets TOTP chiffrÃ©s en AES-256-GCM
- Codes de secours Ã  usage unique
- Logging des Ã©vÃ©nements 2FA

---

## v1.6.6 - 2026-03-01
### ðŸ”§ Corrections & AmÃ©liorations

#### Token GDPR Global
- **Architecture corrigÃ©e** : Le token Gmail RGPD est maintenant **global** (pas par cabinet)
- **Nouvelle table** : `global_gdpr_mail_token` pour stocker un seul token pour toute l'application
- **Refresh automatique** : Token rafraÃ®chi automatiquement chaque semaine via le scheduler
- **Retry intelligent** : Si Google rejette le token, refresh automatique et retry
- **Migration SQL** : `docker/migrations/add_global_gdpr_mail_token.sql`

#### Consentement RGPD
- **Statut 'error'** : Ajout de `'error'` comme valeur valide pour `consent_status`
- **Rappels fonctionnels** : Correction de l'appel `sendEmail()` pour les rappels de consentement
- **Migration SQL** : `docker/migrations/add_error_to_consent_status.sql`

#### QualitÃ© du Code
- **Tests corrigÃ©s** : Correction des 4 tests cassÃ©s dans `health.routes.test.js` (mock `req.query`)
- **Whitelist SQL Ã©tendue** : Ajout de 12 tables manquantes dans `postgresHelpers.js`
- **Logging amÃ©liorÃ©** : Remplacement des erreurs silencieuses par des logs `warn` dans `mailService.js`

#### UI Mobile
- **Menu hamburger** : Fond opaque (`bg-white`/`bg-gray-800`) pour une meilleure lisibilitÃ©
- **Backdrop blur** : Effet de flou sur l'arriÃ¨re-plan du menu mobile

---

## v1.6.5 - 2026-02-28
### ðŸ”’ SÃ©curitÃ© & QualitÃ© du Code

#### Analyse de SÃ©curitÃ© ComplÃ¨te
- **Audit global** : Analyse exhaustive de l'application (authentification, autorisation, injection, CORS, rate limiting)
- **Points positifs confirmÃ©s** : Injection SQL protÃ©gÃ©e, XSS sanitisÃ©, JWT sÃ©curisÃ©, bcrypt pour mots de passe

#### Protection MÃ©moire - Rate Limiting
- **Limite de taille** : Ajout de `MAX_RATE_LIMIT_ENTRIES = 10000` pour Ã©viter les fuites mÃ©moire
- **Pruning automatique** : Suppression de 10% des entrÃ©es les plus anciennes quand la limite est atteinte
- **Fichier** : `server/middleware/rateLimit.middleware.js`

#### Logs StructurÃ©s - Proxy Server
- **Migration console â†’ safeLog** : Remplacement de 45 occurrences de `console.log/error` par `safeLog`
- **Handlers globaux** : `uncaughtException` et `unhandledRejection` utilisent maintenant `safeLog`
- **Startup/Shutdown** : Logs structurÃ©s avec mÃ©tadonnÃ©es JSON pour `onServerStart()` et `gracefulShutdown()`
- **Fichier** : `server/proxy-server.js`

#### MÃ©triques LLM
- **Tarifs Q1 2026** : Mise Ã  jour des prix OpenAI (GPT-5.2) et Anthropic (Claude 4.6)
- **Tracking unifiÃ©** : Correction du double comptage dans `chatbot.routes.js`
- **Fichiers** : `server/services/metrics.service.js`, `server/services/llm.service.js`

#### Corrections Techniques
- **Erreurs silencieuses** : Remplacement de `catch { /* ignore */ }` par logging en niveau `debug`
- **Fichier** : `server/routes/resumes.routes.js`

---

## v1.6.4 - 2026-02-28
### ðŸ“§ Envoi Email des CVs AdaptÃ©s

#### Nouvelle FonctionnalitÃ© : Envoi Email pour Adaptations
- **Bouton email** : Ajout du bouton "Envoyer par email" sur la page de consultation d'une adaptation
- **PrÃ©-remplissage** : Client et contact prÃ©-remplis automatiquement depuis la mission associÃ©e
- **Modal SendEmailModal** : Nouvelles props `prefilledClientId`, `prefilledContactId`, `missionTitle`, `isAdaptation`
- **Backend enrichi** : Route GET `/api/adaptations/:id` retourne maintenant `Mission Client ID` et `Mission Contact ID`

#### AmÃ©liorations du Modal d'Envoi Email
- **Template obligatoire** : L'utilisateur doit sÃ©lectionner un template email (plus de "Sans template")
- **Filtrage templates** : Seuls les templates utilisateur sont affichÃ©s (templates systÃ¨me masquÃ©s)
- **Bouton dÃ©sactivÃ©** : Le bouton d'envoi est grisÃ© tant qu'un template n'est pas sÃ©lectionnÃ©

#### Corrections Techniques
- **GÃ©nÃ©ration PDF** : Ajout du paramÃ¨tre `filename` requis par le serveur PDF
- **Route PDF** : Correction de `/api/generate-pdf` vers `/generate-pdf`
- **Template CV** : RÃ©cupÃ©ration automatique du premier template CV actif pour la gÃ©nÃ©ration PDF
- **Version adaptation** : Ajout de `currentVersion={1}` pour les adaptations (pas de versioning)

---

## v1.6.3 - 2026-02-28
### ðŸŽ¯ Missions - Association Client/Contact & Adaptation CV

#### Association Client/Contact aux Missions
- **Nouveaux champs** : Les missions peuvent maintenant Ãªtre associÃ©es Ã  un client/prospect et un interlocuteur
- **Migration SQL** : Ajout de la colonne `contact_id` Ã  la table `missions` avec clÃ© Ã©trangÃ¨re vers `client_contacts`
- **Formulaire enrichi** : SÃ©lecteurs en cascade Client â†’ Contact dans le formulaire de crÃ©ation/Ã©dition de mission
- **Validation backend** : VÃ©rification que le client appartient Ã  la firm de l'utilisateur
- **Affichage tuiles** : Client (avec badge Prospect/Client) et interlocuteur affichÃ©s sur les cartes mission

#### Adaptation CV Ã  une Mission
- **Nouvelle page** : `ResumeAdaptPage.tsx` avec workflow en 3 Ã©tapes (SÃ©lectionner â†’ Analyser â†’ Adapter)
- **Route ajoutÃ©e** : `/resumes/:id/adapt` pour accÃ©der Ã  l'adaptation depuis la page d'amÃ©lioration
- **Indicateur progression** : Affichage visuel des Ã©tapes avec icÃ´nes de validation
- **Navigation fluide** : AccÃ¨s direct Ã  l'adaptation crÃ©Ã©e aprÃ¨s gÃ©nÃ©ration

#### Corrections & AmÃ©liorations
- **Bouton Modifier** : Correction du bouton "Modifier" sur la page de consultation de mission
- **RÃ©solution firm_id** : Utilisation de `getUserFirmId()` pour rÃ©soudre correctement le firm_id depuis le nom ou l'UUID
- **Validation Zod** : Acceptation des valeurs `null` pour `Client ID` et `Contact ID` dans les schÃ©mas de mission

---

## v1.6.2 - 2026-02-23
### ðŸ”’ RGPD - Badge Compact & Envoi Email Automatique

#### Badge RGPD Compact avec Tooltip
- **Mode compact** : Badge RGPD minimaliste sur les cartes CV et page d'analyse
- **Tooltip hover** : Affichage du nom, email et date d'expiration du consentement
- **React Portal** : Rendu du tooltip hors du DOM parent pour Ã©viter le clipping
- **Largeur dynamique** : Tooltip auto-dimensionnÃ© selon le contenu

#### Envoi Automatique Email RGPD
- **Email auto Ã  l'upload** : Envoi automatique de la demande de consentement lors de l'upload d'un CV externe
- **Logging dÃ©taillÃ©** : Traces complÃ¨tes pour le dÃ©bogage de l'envoi Gmail OAuth
- **Gestion token OAuth** : Documentation du processus de reconnexion Gmail en cas d'expiration

#### Corrections Techniques
- **Colonne BDD** : Correction `consent_given_at` â†’ `consent_responded_at` dans les requÃªtes SQL
- **Import crypto** : Correction de l'import ES module pour `crypto`
- **Traduction manquante** : Ajout de la clÃ© `resume.steps.improve` en franÃ§ais

---

## v1.6.1 - 2026-02-23
### ðŸ§­ Breadcrumbs & Refactoring Navigation CV

#### Navigation par Breadcrumbs
- **Composant Breadcrumbs** : ImplÃ©mentation sur l'ensemble des pages de l'application
- **GÃ©nÃ©ration automatique** : DÃ©tection intelligente des routes et affichage contextuel
- **Pages couvertes** : CVthÃ¨que, Missions, Clients, Adaptations, Templates, ParamÃ¨tres, Upload, Profile Matching, Guide Utilisateur, MÃ©triques, Logs de SÃ©curitÃ©, Utilisateurs, Tags, Templates Email

#### Refactoring Workflow CV
- **URLs distinctes** : SÃ©paration en `/resumes/:id/analysis`, `/resumes/:id/improve`, `/resumes/:id/export`
- **Redirection automatique** : `/resumes/:id` redirige vers `/resumes/:id/analysis`
- **Nettoyage code** : Suppression de `ResumeViewPage.tsx` et `ResumeAnalysis.tsx` (ancien composant monolithique de 702 lignes)

#### Corrections UI/UX
- **Boutons dark mode** : Style outlined subtil pour "Voir l'amÃ©lioration" et "Exporter" (meilleure lisibilitÃ©)
- **Animation amÃ©lioration** : Correction de l'affichage avec `isVisible={true}` et `setTimeout` pour le rendu React

#### Traductions
- **Nouvelles clÃ©s** : `navigation.securityLogs`, `navigation.upload`, `resume.analysis.title`, `resume.analysis.tabs.skills`

---

## v1.6.0 - 2026-02-21
### ðŸ“§ Templates Email MJML & Profils Utilisateurs Enrichis

#### Ã‰diteur de Templates Email MJML
- **Ã‰diteur visuel** : Nouveau composant `EmailTemplateEditor.tsx` avec blocs drag-and-drop (Logo, En-tÃªte, Paragraphe, Signature, Pied de page)
- **Compilation MJML** : IntÃ©gration de la bibliothÃ¨que MJML pour gÃ©nÃ©rer des emails HTML responsifs
- **Bloc Logo** : Support du logo dynamique du cabinet dans les templates avec `{{firm.logo}}`
- **PrÃ©visualisation** : AperÃ§u en temps rÃ©el du rendu HTML des templates

#### Gestion des Logos de Cabinet
- **Upload de logo** : Nouvelle fonctionnalitÃ© d'upload de logo pour chaque cabinet (JPEG, PNG, GIF, WebP, SVG)
- **Stockage** : Logos stockÃ©s dans `client/public/logos/` avec noms uniques
- **URLs absolues** : Conversion automatique des chemins relatifs en URLs absolues pour les emails
- **Migration BDD** : Ajout de la colonne `logo_url` dans la table `firms`

#### Profils Utilisateurs Enrichis
- **Nouveaux champs** : Ajout de `job_title` (fonction) et `phone` (tÃ©lÃ©phone) dans les profils utilisateurs
- **Formulaire admin** : Champs Fonction et TÃ©lÃ©phone dans le modal de gestion des utilisateurs
- **Migration BDD** : `docker/migrations/add_user_profile_fields.sql`

#### Mots-clÃ©s Email Ã‰tendus
- **Nouveaux mots-clÃ©s** : `{{user.email}}`, `{{user.jobTitle}}`, `{{user.phone}}`
- **Enrichissement contexte** : Les donnÃ©es utilisateur sont rÃ©cupÃ©rÃ©es depuis la BDD lors de l'envoi pour garantir leur fraÃ®cheur
- **Documentation** : Liste complÃ¨te des mots-clÃ©s disponibles dans l'Ã©diteur

#### Corrections Techniques
- **Contrainte email unique** : Correction de l'erreur lors de la mise Ã  jour d'un utilisateur sans changement d'email
- **TypeScript** : Conversion de `userService.js` en `userService.ts` avec typage complet
- **CSRF multipart** : Gestion correcte du token CSRF pour les uploads de fichiers

#### Traductions
- **FR/EN** : Nouvelles clÃ©s pour les champs Fonction, TÃ©lÃ©phone, et le bloc Logo dans l'Ã©diteur

---

## v1.5.9 - 2026-02-21
### ðŸŽ¯ AmÃ©lioration des Prompts LLM & Corrections Swagger

#### Refonte des prompts par dÃ©faut
- **Prompt d'analyse** : Nouvelle grille d'Ã©valuation dÃ©taillÃ©e pour `experiencesRating` (5 critÃ¨res : LisibilitÃ©, Contexte, Livrables, ResponsabilitÃ©s, Impact)
- **Prompt d'amÃ©lioration** : Structure alignÃ©e sur la grille d'analyse avec prioritÃ©s de qualitÃ© explicites
- **Industries** : Lexique de mapping explicite avec rÃ¨gles de preuve obligatoires
- **Tags tools** : Ajout du type d'Ã©lÃ©ment entre parenthÃ¨ses (langage, framework, outil...)

#### Corrections Swagger
- **Validation OpenAPI** : Correction du schÃ©ma `/llm/openai` (ajout `items` pour le tableau `messages`)
- **Cache dÃ©sactivÃ©** : Headers `no-cache` pour `/api/docs` et `/api/docs/ui`
- **Anti-cache frontend** : Boutons avec paramÃ¨tre `?v=timestamp` dans SettingsPage

#### Corrections techniques
- **swagger.js** : Import de `swaggerPaths` dÃ©placÃ© en haut du fichier pour Ã©viter les problÃ¨mes de timing ES modules

---

## v1.5.8 - 2026-02-21
### ðŸ“š Refonte Documentation Swagger/OpenAPI & Nettoyage Terminologie

#### Mise Ã  jour complÃ¨te du Swagger
- **Nouvelle architecture** : SÃ©paration en `swagger.js` (schÃ©mas) et `swagger.paths.js` (62 endpoints)
- **Terminologie corrigÃ©e** : Remplacement de `customers` par `firms` (alignÃ© avec la BDD)
- **SchÃ©mas Ã  jour** : Ajout de `Firm`, `Client`, `ClientContact`, `ResumeSubmission`, `ResumeVersion`, `MailStatus`

#### Routes manquantes documentÃ©es
- **Firms** : CRUD complet `/api/firms/*` pour la gestion des cabinets
- **Clients** : CRUD `/api/clients/*` avec gestion des contacts
- **Submissions** : Historique des envois de CV `/api/submissions/*`
- **Mail** : OAuth et crÃ©ation de brouillons `/api/mail/*`
- **Resume Versions** : Gestion des versions `/api/resumes/:id/versions/*`

#### Nettoyage terminologie Customer â†’ Firm
- **proxy-server.js** : Suppression de la route legacy `/api/customers`
- **missions.routes.js** : Suppression des alias `Customer`/`Customer ID` dans les rÃ©ponses
- **health.routes.js** : Correction `customers` â†’ `firms` dans les stats de cache
- **profileMatching.service.js** : Remplacement `customer` â†’ `firm` dans les paramÃ¨tres
- **MissionsPage.tsx** : Interface `Mission.Customer` â†’ `Mission.Firm`
- **StatsCards.tsx** : Stats `customers` â†’ `firms`
- **HealthIndicator.tsx** : Type et affichage `customers` â†’ `firms`
- **Traductions** : ClÃ© `missions.stats.customers` â†’ `missions.stats.firms` (FR/EN)

#### Nettoyage fichiers
- **Suppression doublon** : Fichier `server/docs/openapi.js` obsolÃ¨te supprimÃ©
- **Import corrigÃ©** : `docs.routes.js` utilise maintenant `swagger.js`

---

## v1.5.7 - 2026-02-08
### ðŸš€ Optimisations Production & Corrections i18n

#### Optimisation des assets statiques
- **Fichiers prÃ©-compressÃ©s** : Support Brotli (.br) et Gzip (.gz) pour les assets statiques
- **Cache agressif** : Assets hashÃ©s cachÃ©s 1 an avec `immutable`, HTML sans cache pour SPA
- **Headers optimisÃ©s** : `Vary: Accept-Encoding` pour compatibilitÃ© CDN

#### Pagination CVthÃ¨que
- **Correction pagination** : Ajout du `totalCount` dans la rÃ©ponse API pour afficher toutes les pages
- **CohÃ©rence** : Pagination Ã  20 Ã©lÃ©ments par page (comme le reste de l'application)

#### Corrections i18n
- **I18nextProvider** : Enveloppement explicite de l'application pour garantir l'initialisation
- **Import prioritaire** : i18n importÃ© en premier dans `main.tsx`
- **Textes de chargement** : Ajout des tableaux `steps` pour les animations d'analyse CV

#### SÃ©curitÃ© API
- **fetchWithAuth** : Migration de tous les appels API protÃ©gÃ©s vers `fetchWithAuth()`
- **HealthIndicator** : Utilisation de `fetchWithAuth` pour les endpoints admin
- **GÃ©nÃ©ration PDF** : Tous les appels `/generate-pdf` utilisent maintenant `fetchWithAuth`

---

## v1.5.6 - 2026-02-07
### ðŸŒ Audit & Nettoyage des Traductions

#### Script d'audit des traductions
- **Nouveau script** `scripts/audit-translations.js` : Audit complet des fichiers de traduction
- **DÃ©tection automatique** : Identification des clÃ©s manquantes et inutilisÃ©es
- **Mode fix** : Ajout automatique des clÃ©s manquantes avec `--fix`
- **Mode remove-unused** : Suppression des clÃ©s inutilisÃ©es avec `--remove-unused`
- **PrÃ©servation des clÃ©s dynamiques** : Les clÃ©s utilisÃ©es dynamiquement (ex: `marketRadar.dataTypes.*`, `header.language.*`) sont prÃ©servÃ©es

#### Filtres dynamiques des logs de sÃ©curitÃ©
- **Filtres dynamiques** : Les options de filtre (level, event, source) sont maintenant chargÃ©es depuis les donnÃ©es rÃ©elles
- **Nouvel endpoint** `/api/admin/security-filters` : Retourne les valeurs uniques pour les filtres
- **Suppression des enums hardcodÃ©s** : Plus de validation stricte sur les valeurs de filtre

#### Corrections des traductions
- **ClÃ©s manquantes ajoutÃ©es** : 18 clÃ©s ajoutÃ©es en FR et EN
- **Synchronisation FR/EN** : Les deux fichiers sont maintenant parfaitement synchronisÃ©s
- **Nettoyage** : 344 clÃ©s inutilisÃ©es supprimÃ©es
- **Types de donnÃ©es Market Radar** : Ajout des traductions pour `offres`, `tension`, `dynamique_emploi`, `embauche`, `demandeur`, `demandeur_entrant`

#### Tuile Erreurs des logs de sÃ©curitÃ©
- **Comptage corrigÃ©** : La tuile "Erreurs" ne compte maintenant que les logs de niveau ERROR (plus SECURITY)
- **Normalisation** : Les niveaux de log sont normalisÃ©s en majuscules pour un comptage cohÃ©rent

---

## v1.5.5 - 2026-02-06
### ðŸŽ¯ AmÃ©liorations Matching Profils & UX

#### Matching Profils - Corrections majeures
- **Fix casse status** : Correction de la comparaison case-insensitive pour les status `analyzed`/`improved` dans PostgreSQL
- **Tags cleaned prioritaires** : Le matching utilise maintenant les tags nettoyÃ©s (`skills_cleaned`, etc.) en prioritÃ© avec fallback sur les tags bruts
- **Affichage tous profils** : Les CVs sont maintenant tous affichÃ©s triÃ©s par pertinence, mÃªme avec un score de 0
- **Debug logging** : Ajout de logs pour diagnostiquer les problÃ¨mes de matching

#### Analyse CV - ObjectivitÃ©
- **Analyse agnostique** : Suppression du biais qui favorisait les scores des CV amÃ©liorÃ©s
- **MÃªme traitement** : L'analyse LLM traite maintenant tous les CVs de maniÃ¨re identique (original ou amÃ©liorÃ©)

#### Affichage CV amÃ©liorÃ©
- **Export HTML** : L'aperÃ§u dans l'onglet Exporter affiche maintenant le CV en HTML rendu
- **Comparaison HTML** : L'onglet Comparer affiche le CV amÃ©liorÃ© en HTML formatÃ©

#### UX Page d'accueil
- **Espacement sections** : Augmentation de l'espace avant "Comment Ã§a marche" pour un affichage bloc par bloc

---

## v1.5.4 - 2026-02-06
### ðŸ—ºï¸ AmÃ©liorations UX Carte France

#### Conservation du mÃ©tier lors du changement de rÃ©gion
- **Persistance de la sÃ©lection** : Le mÃ©tier sÃ©lectionnÃ© reste actif lors du changement de rÃ©gion
- **Rechargement automatique** : Les mÃ©tadonnÃ©es sont rechargÃ©es pour la nouvelle rÃ©gion
- **Mapping type corrigÃ©** : Correction du mapping `offres` â†’ `offre` pour la recherche de trends

#### Affichage des mÃ©tadonnÃ©es amÃ©liorÃ©
- **En-tÃªte mÃ©tier** : Ajout du nom du mÃ©tier sÃ©lectionnÃ© en haut du panneau de mÃ©tadonnÃ©es
- **Affichage conditionnel** : Le panneau ne s'affiche que si les mÃ©tadonnÃ©es sont disponibles ou en chargement
- **Suppression message inutile** : Retrait du message "SÃ©lectionnez un mÃ©tier pour voir les dÃ©tails"

#### Corrections de bugs
- **Fix layout shift** : Suppression de l'indicateur de mÃ©tier qui causait un dÃ©calage de layout
- **Fix hauteur panneau** : Ajout d'une hauteur maximale fixe au panneau latÃ©ral pour Ã©viter les re-layouts
- **Fix effet rÃ©gion** : Utilisation d'un ref pour dÃ©tecter uniquement les vrais changements de rÃ©gion

---

## v1.5.3 - 2026-02-06
### ðŸ—ºï¸ Metadata on-demand sur la Carte France

#### Affichage des metadata de tendances
- **Nouvelle route API** `/api/market-radar/trends/:id/metadata` : Chargement on-demand des metadata
- **Nouveau composant** `TrendMetadataDisplay.tsx` : Affichage rÃ©utilisable des metadata parsÃ©es
- **Panneau de dÃ©tails** : AffichÃ© au clic sur un mÃ©tier dans la liste "RÃ©partition par mÃ©tier"
- Support des types : tension, salaire, embauche, dynamique_emploi, demandeur, offre

#### Optimisation mÃ©moire
- **Cache LRU** : Maximum 50 entrÃ©es avec Ã©viction automatique des plus anciennes
- **Nettoyage automatique** : Cache vidÃ© au changement de type de donnÃ©es ou de rÃ©gion
- **Chargement lÃ©ger** : La carte ne charge que les donnÃ©es essentielles (sans metadata)

#### AmÃ©liorations UX
- Metadata chargÃ©es uniquement Ã  la sÃ©lection d'un mÃ©tier (pas au hover)
- Indicateur de chargement pendant la rÃ©cupÃ©ration des metadata
- Cache local pour Ã©viter les appels API rÃ©pÃ©tÃ©s

---

## v1.5.2 - 2026-02-06
### ðŸ§  Audit mÃ©moire complet & Optimisations

#### Gestion mÃ©moire - Audit complet
- **Audit mÃ©moire exhaustif** : Document `MEMORY_AUDIT.md` avec analyse de tous les caches
- **ESCO Cache** : Ajout limite 10,000 entrÃ©es, TTL 24h, cleanup automatique toutes les heures
- **Trends Cache** : Ajout cleanup automatique si inactif > 2Ã— TTL, fonctions `destroy()` et `stats()`
- **Facts Cache** : Idem avec cleanup automatique et fonctions de monitoring
- **MÃ©tiers Cache** : Ajout cleanup automatique et fonctions `destroyMetiersCache()`, `getMetiersCacheStats()`
- **Tags Cache** : Ajout TTL explicite 10 min, cleanup automatique, fonctions destroy/stats
- **Logger Frontend** : Ajout limite 1000 entrÃ©es, cleanup pÃ©riodique toutes les 5 minutes
- **File Cleanup** : Ajout `destroyFileCleanup()` et `getFileCleanupStats()` pour cohÃ©rence

#### Graceful Shutdown
- **Nouveau service `shutdown.service.js`** : Gestion centralisÃ©e du shutdown
- Enregistrement de tous les handlers de cleanup
- Gestion des signaux SIGTERM, SIGINT et exceptions non gÃ©rÃ©es

#### Monitoring mÃ©moire
- **Nouvel endpoint `/api/health/memory`** : Stats dÃ©taillÃ©es de tous les caches
- Affichage dans l'indicateur de santÃ© (header) avec dÃ©tails par cache
- RafraÃ®chissement dynamique des donnÃ©es au survol du tooltip
- Informations affichÃ©es : taille actuelle, limite max, TTL, Ã©tat GC

#### Collecte Market Radar
- AmÃ©lioration de la gestion mÃ©moire dans `collectMarketTrends()`
- Logs dÃ©taillÃ©s avec usage mÃ©moire (`heapUsedMB`)
- Nettoyage explicite des variables aprÃ¨s traitement
- Comptage prÃ©cis (created/updated/failed/skipped) avec vÃ©rification comptable

#### Dynamique de l'emploi (DYN_1)
- Correction de la collecte pour toutes les 13 rÃ©gions franÃ§aises
- Logs amÃ©liorÃ©s avec `accountingMatch` pour vÃ©rifier la cohÃ©rence
- Affichage enrichi dans l'UI avec tendance (hausse/baisse/stable)

---

## v1.5.1 - 2026-02-05
### ðŸ”§ Nettoyage et qualitÃ© du code

#### Nettoyage Airtable
- **Suppression complÃ¨te des rÃ©fÃ©rences Airtable** : Code et dÃ©pendances
- Suppression de la dÃ©pendance `airtable` du package.json
- Renommage `airtableService.ts` â†’ `resumeService.ts`
- Mise Ã  jour des types (`DatabaseError` remplace `AirtableError`)
- Retrait de `api.airtable.com` du CSP

#### Validation et sÃ©curitÃ©
- **Validation Zod sur routes LLM** : `openaiRequestSchema`, `anthropicRequestSchema`
- Validation du chatbot avec `chatbotRequestSchema`
- SchÃ©mas de validation pour messages LLM avec limites de taille

#### QualitÃ© du code
- **Nouveau middleware `asyncHandler`** : Gestion d'erreurs standardisÃ©e
- **Helpers de routes** : `routeHelpers.js` avec fonctions rÃ©utilisables
- Health check PostgreSQL amÃ©liorÃ© avec stats dÃ©taillÃ©es (latence, taille DB, comptages)
- Statistiques complÃ¨tes dans `/api/resumes/stats` (improved count, scores moyens)
- Correction du format des tableaux PostgreSQL dans `postgresHelpers.js`

#### Tests
- Nouveaux tests d'intÃ©gration pour routes health et auth
- 35+ tests passants

#### Corrections
- Fix erreurs TypeScript (types de scores, Status as const)
- Fix appels logger avec trop d'arguments
- Migration du champ `popular` pour les templates

---

## v1.5.0 - 2026-02-05
### ðŸš€ Migration PostgreSQL & SÃ©curitÃ© renforcÃ©e

#### Migration base de donnÃ©es
- **Migration complÃ¨te Airtable â†’ PostgreSQL** : Performance et scalabilitÃ© amÃ©liorÃ©es
- Nouveau schÃ©ma avec UUIDs, indexes optimisÃ©s et contraintes d'intÃ©gritÃ©
- Triggers de dÃ©normalisation pour synchronisation automatique des champs liÃ©s
- Connection pooling avec retry automatique et backoff exponentiel
- Support des transactions ACID pour les opÃ©rations critiques

#### SÃ©curitÃ©
- **Protection SQL injection** : Whitelist des tables et validation des colonnes
- **Timeout rÃ©el des requÃªtes** : Utilisation de `statement_timeout` PostgreSQL
- **Masquage des donnÃ©es sensibles** dans les logs (mots de passe, tokens)
- Rate limiting et validation des entrÃ©es avec Zod schemas

#### SystÃ¨me de logging amÃ©liorÃ©
- Nouvelle architecture de logging backend et frontend
- Niveaux configurables : error, warn, info, debug
- TraÃ§abilitÃ© par module source (`[database]`, `[franceTravail]`, etc.)
- Rate limiting pour Ã©viter le spam de logs
- Redaction automatique des champs sensibles
- Configuration via `LOG_LEVEL` et `VITE_LOG_LEVEL`

#### AmÃ©liorations UI
- Traduction des statuts de CV (AmÃ©liorÃ©, En cours, AnalysÃ©, etc.)
- Codes couleur distincts pour chaque statut de CV
- Formatage des dates cohÃ©rent et localisÃ©

---

## v1.3.0 - 2026-02-03
### ðŸ”„ AmÃ©liorations majeures
#### Refonte des prompts LLM
 - Nouveaux prompts d'analyse et d'amÃ©lioration de CV avec instructions dÃ©taillÃ©es
 - RÃ¨gles anti-hallucination et anti-invention pour des rÃ©sultats plus fiables
 - Grilles de notation structurÃ©es pour une Ã©valuation cohÃ©rente
 - Extraction de tags avec validation par whitelist d'industries
 - Format JSON strict pour une meilleure reproductibilitÃ©
 - TempÃ©rature rÃ©duite Ã  0.3 pour l'amÃ©lioration (plus dÃ©terministe)
 - Gestion d'erreur robuste pour les rÃ©ponses LLM invalides

#### IntÃ©gration ESCO (en cours)
 - PrÃ©paration de l'intÃ©gration avec le rÃ©fÃ©rentiel europÃ©en des compÃ©tences
 - Infrastructure de mapping des tags vers la taxonomie ESCO
 - Support des occupations et skill groups ICT

#### Corrections et amÃ©liorations
 - Correction de l'affichage des messages d'erreur (toast avec largeur appropriÃ©e)
 - Correction de l'import manquant dans profileMatching.service.js
 - Architecture amÃ©liorÃ©e : sÃ©paration des prompts backend/frontend
 - Messages d'erreur utilisateur plus clairs et lisibles

## v1.2.3 - 2026-02-01
### ðŸŽ¯ Nouvelle fonctionnalitÃ© majeure : Radar MarchÃ© IT/IS France
Page de veille complÃ¨te sur le marchÃ© du travail IT en France, permettant de suivre les tendances et opportunitÃ©s par rÃ©gion et mÃ©tier.

#### Carte interactive de France
 - IntÃ©gration de MapLibre GL pour une cartographie professionnelle
 - Visualisation des offres d'emploi IT par rÃ©gion avec bulles proportionnelles
 - Popups interactifs au survol avec dÃ©tails rÃ©gionaux
 - Panneau de dÃ©tail par rÃ©gion avec rÃ©partition par mÃ©tier
 - Filtre de recherche dans la liste des mÃ©tiers
 - Affichage des libellÃ©s de mÃ©tiers (au lieu des codes ROME)

#### Collecte et analyse de donnÃ©es
 - IntÃ©gration API France Travail (OAuth2) pour collecte d'offres d'emploi
 - IntÃ©gration API Adzuna pour donnÃ©es salariales et tendances
 - Stockage des facts dans PostgreSQL (table market_facts)
 - Collecte par codes ROME IT, rÃ©gions franÃ§aises et mots-clÃ©s techniques
 - Histogrammes de salaires et top entreprises qui recrutent

#### Interface de consultation
 - Tableau de donnÃ©es dÃ©taillÃ©es avec pagination serveur
 - Filtres par source, mÃ©tier et rÃ©gion
 - Statistiques globales : offres totales, rÃ©gions couvertes, rÃ©gion #1, mÃ©tiers IT

## v1.2.2 - 2026-02-01
 - Affinement des scores de matching par analyse IA des titres de CV
 - Navigation par URL pour les Ã©lÃ©ments individuels (/resumes/:id, /missions/:id, /adaptations/:id)
 - Pages dÃ©diÃ©es pour la visualisation des CVs, missions et adaptations
 - Mise Ã  jour du guide utilisateur (section matching profils)
 - Correction de la gestion des sessions expirÃ©es (erreurs JWT comme "kid_malformed")
 - Synchronisation front/back pour l'expiration des tokens (headers X-Token-Expires-In)
 - Refresh proactif du token avant expiration (5 minutes avant)
 - Codes d'erreur explicites pour les problÃ¨mes d'authentification (TOKEN_MISSING, TOKEN_INVALID)
 - Redirection automatique vers la page de connexion en cas d'expiration de session
 - Harmonisation de la gestion de version (source unique: package.json)

## v1.2.1 - 2026-01-31
 - Analyse dÃ©taillÃ©e IA des profils pour une mission (Phase 2 du matching)
 - Ã‰valuation complÃ¨te : verdict, forces, lacunes, recommandations
 - Questions d'entretien suggÃ©rÃ©es par l'IA
 - Ã‰valuation du niveau de risque de recrutement
 - AmÃ©lioration de la gestion des erreurs frontend (messages utilisateur)

## v1.2.0 - 2026-01-31
 - Nouvelle fonctionnalitÃ© : Matching Profils - Recherche des meilleurs CVs pour une mission
 - Extraction automatique des mots-clÃ©s de mission via IA (avec cache)
 - Algorithme de scoring pondÃ©rÃ© (compÃ©tences, outils, secteurs, soft skills)
 - Matching flou pour les variations de termes techniques
 - Interface dÃ©diÃ©e avec filtres avancÃ©s et pondÃ©rations personnalisables
 - Gestion globale des erreurs frontend avec ErrorBoundary et toasts dÃ©taillÃ©s

## v1.1.9 - 2026-01-31
 - Gestion des CVs nominatifs / anonymes
 - Affichage des suggestions dans le formulaire d'Ã©dition du CV amÃ©liorÃ©
 - Mise Ã  jour du guide utilisateur

## v1.1.8 - 2026-01-31
 - Unification de la logique d'analyse CV (meme processus et prompt pour l'analyse initiale et post-amelioration)
 - Nouveau prompt d'analyse optimise avec suggestions par section
 - Correction du scroll dans le header sur la page d'accueil

## v1.1.7 - 2026-01-30
 - AmÃ©lioration de la prÃ©sentation de l'application
 - Prise en compte correcte des suggestions d'amÃ©lioration
 - Bug fixing et optimisations

## v1.1.6 - 2026-01-29
 - SÃ©curitÃ© renforcÃ©e : blacklist JWT, rÃ©vocation tokens au logout, logs sÃ©curitÃ© persistÃ©s
 - FiabilitÃ© amÃ©liorÃ©e : retry avec backoff exponentiel et circuit breakers pour LLM
 - Documentation API Swagger, mÃ©triques persistÃ©es, types TypeScript centralisÃ©s

## v1.1.5 - 2026-01-28
 - Optimisation
 - correction des vulnÃ©rabilitÃ©s
 - poursuite du refactoring

## v1.1.4 - 2026-01-28
 - Corrections de bugs d'authentification (casse des propriÃ©tÃ©s utilisateur)
 - Corrections et optimisations diverses

## v1.1.3 - 2026-01-28
 - Poursuite du refactoring
 - Bascule en TypeScript du front
 - Corrections et optimisations diverses

## v1.1.2 - 2026-01-27
 - Refactoring du front et nettoyage de fichiers morts historiques
 - PrÃ©paration de l'application pour la production
 - Corrections diverses

## v1.1.1 - 2026-01-27
 - AmÃ©lioration de la fonctionalitÃ© d'adaptation Ã  une offre de mission
 - AmÃ©lioration de la sÃ©curitÃ© et correction de fuites mÃ©moire serveur
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
