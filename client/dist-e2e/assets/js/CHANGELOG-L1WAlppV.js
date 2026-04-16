var e=`## v1.9.1 - 2026-04-16\r
### Ajustements UI CVtheque et coherence des vues liste\r
\r
#### CVtheque\r
- Refonte de la vue \`CVtheque / Liste\` pour reprendre la structure visuelle de la vue \`Par affaire\` sans la hierarchie par affaire.\r
- Reutilisation des cartes CV enrichies dans les deux vues pour aligner les actions rapides, le score, l'apercu et les badges.\r
- Correction du tooltip des tags dans les deux vues CVtheque :\r
  - positionnement viewport-aware\r
  - z-index d'overlay explicite\r
  - fond desormais totalement opaque pour eviter les superpositions visuelles avec les cartes sous-jacentes\r
\r
#### Missions\r
- Refonte de la vue \`Missions / Liste\` sur la base de \`Missions / Par affaire\`, sans regroupement par affaire.\r
- Reutilisation de la toolbar, du bloc de synthese et des cartes mission de la vue groupee pour eviter deux rendus concurrents.\r
\r
#### Qualite\r
- Alignement de la version applicative sur \`v1.9.1\`.\r
\r
---\r
## v1.9.0 - 2026-04-11\r
### Administration multi-cabinet et propagation des templates\r
\r
#### RÃ´les et pÃ©rimÃ¨tres admin\r
- Renommage du rÃ´le \`admin\` en \`Super administrateur\` cÃ´tÃ© interface.\r
- Introduction du rÃ´le \`localAdmin\` affichÃ© comme \`Administrateur\`, avec cloisonnement aux donnÃ©es de son cabinet.\r
- Restriction des Ã©crans accessibles aux admins locaux Ã\xA0 \`ModÃ¨les de CV\`, \`Templates Email\`, \`Etiquettes\` et \`Utilisateurs\`, sans accÃ¨s Ã\xA0 lâ€™onglet \`Cabinets\`.\r
- Mise Ã\xA0 jour de lâ€™Ã©cran utilisateurs pour permettre lâ€™attribution des rÃ´les \`Super administrateur\` et \`Administrateur\`.\r
\r
#### Cloisonnement par cabinet\r
- Filtrage backend et frontend des utilisateurs, modÃ¨les CV, templates email et Ã©tiquettes pour les admins locaux sur leur seul cabinet.\r
- Verrouillage explicite des crÃ©ations, Ã©ditions, duplications et suppressions hors cabinet pour les admins locaux.\r
- Correction du chargement en boucle de lâ€™Ã©cran utilisateurs provoquÃ© par des dÃ©pendances instables dans les hooks React.\r
\r
#### Templates email\r
- Ajout dâ€™une vue super administrateur rÃ©ellement transverse sur tous les templates email, tous cabinets confondus.\r
- Ajout du badge \`Cabinet\` sur chaque template email avec affichage du cabinet dâ€™appartenance ou \`Global\`.\r
- Correction des contrÃ´les dâ€™accÃ¨s backend pour permettre au super administrateur de consulter, prÃ©visualiser, dupliquer, modifier et supprimer des templates email de nâ€™importe quel cabinet.\r
\r
#### ModÃ¨les de CV et duplication\r
- Ajout de lâ€™action de duplication pour les super administrateurs sur les modÃ¨les de CV et les templates email, avec choix du cabinet cible.\r
- Correction des validations backend pour forcer les admins locaux sur leur propre cabinet.\r
- Correction de lâ€™unicitÃ© des noms de modÃ¨les CV en base de donnÃ©es : unicitÃ© dÃ©sormais par cabinet, avec gestion sÃ©parÃ©e des modÃ¨les globaux.\r
\r
#### Base de donnÃ©es\r
- Ajout de la migration du rÃ´le \`localAdmin\` dans la contrainte SQL des utilisateurs.\r
- Ajout de la migration de contrainte dâ€™unicitÃ© des modÃ¨les CV par cabinet.\r
\r
#### Navigation et interface admin\r
- DÃ©placement de \`Logs de sÃ©curitÃ©\` et \`Journal RGPD\` dans la section basse du menu, avant le \`Guide utilisateur\`.\r
- Confirmation de lâ€™accÃ¨s au \`Guide utilisateur\` pour les utilisateurs standards et les admins locaux.\r
\r
#### QualitÃ©\r
- Renforcement des tests ciblÃ©s frontend et backend sur les rÃ´les, le cloisonnement, les duplications et les templates email.\r
- Alignement de la version applicative sur \`v1.9.0\`.\r
\r
---\r
## v1.8.9 - 2026-04-07\r
### QualitÃ© frontend, overlays CV et gouvernance des prompts\r
\r
#### Parcours CV et analyse\r
- Lâ€™overlay fullscreen pendant lâ€™analyse et lâ€™amÃ©lioration de CV couvre dÃ©sormais correctement tout le viewport, y compris le footer applicatif et le bouton du chatbot.\r
- Le rendu des Ã©crans de traitement CV a Ã©tÃ© sÃ©curisÃ© via montage portail au niveau \`document.body\`, pour Ã©viter les problÃ¨mes de stacking context sur les shells Ã©ditoriaux.\r
\r
#### Prompt de prÃ©analyse\r
- Remplacement du prompt de prÃ©analyse CV par une nouvelle version orientÃ©e canonicalisation Markdown, plus stricte sur la fidÃ©litÃ© au contenu source et la structuration des sorties.\r
- Mise Ã\xA0 jour de la gouvernance associÃ©e du prompt de prÃ©analyse pour reflÃ©ter cette nouvelle rÃ©vision.\r
\r
#### CRM / deals\r
- Ajout dâ€™une action de consultation sur les cartes deal.\r
- CrÃ©ation dâ€™une vue de consultation deal rÃ©utilisable et dâ€™une page dÃ©diÃ©e accessible par route.\r
\r
#### UX/UI ciblÃ©e\r
- AmÃ©lioration ciblÃ©e des vues \`Templates email\`, \`Etiquettes\` et \`Logs de sÃ©curitÃ©\`.\r
- Ajout dâ€™un smoke test Playwright admin sur ces pages pour verrouiller les parcours essentiels.\r
\r
#### QualitÃ©\r
- Alignement de la version applicative sur \`v1.8.9\`.\r
- VÃ©rifications ciblÃ©es maintenues sur les changements rÃ©cents frontend et backend.\r
\r
---\r
\r
## v1.8.8 - 2026-03-30\r
### Fiabilisation plateforme, backup, cache et refactors structurels\r
\r
#### Couverture frontend et e2e\r
- Renforcement massif de la couverture frontend sur les parcours critiques : routing/protection, upload, analysis, export, adapt, settings et batch upload.\r
- Ajout de parcours Playwright authentifiÃ©s stables avec bootstrap automatique d'un utilisateur \`active\` et injection de cookies JWT pour Ã©viter les collisions avec le rate limiting auth.\r
- Nouvelles specs e2e mÃ©tier : navigation protÃ©gÃ©e, formulaire GDPR upload, flux complet \`upload -> analysis\` et flux \`analysis -> improve -> export\`.\r
- La stack Playwright dÃ©marre dÃ©sormais le proxy applicatif et le \`pdf-server\`, avec bootstrap automatique d'un template d'export pour l'utilisateur e2e.\r
\r
#### Nettoyage des reliquats CV\r
- Confirmation et documentation du fait que le flux mÃ©tier supportÃ© pour l'import, l'analyse et l'amÃ©lioration des CVs passe par \`batch-jobs\`.\r
- Suppression de l'ancien endpoint direct \`POST /api/resumes/upload\` cÃ´tÃ© serveur.\r
- Conservation des endpoints techniques \`extract-pdf\` et \`extract-doc\`, encore utilisÃ©s par le frontend pour l'extraction de texte.\r
- Suppression des handlers LLM legacy non montÃ©s dans le routeur \`resumes\`.\r
\r
#### RÃ©silience et observabilitÃ©\r
- Alignement du diagnostic \`Ã‰tat du systÃ¨me\` avec lâ€™architecture rÃ©elle : santÃ© plateforme, backend cache, Redis, mÃ©moire, providers LLM et circuit breakers.\r
- Ajout de lâ€™affichage mÃ©moire consommÃ©e / max dans lâ€™indicateur systÃ¨me, avec seuils visuels adaptÃ©s.\r
- RÃ©duction de lâ€™impact des familles LLM sur lâ€™Ã©tat global : tant quâ€™au moins un provider reste exploitable, le badge systÃ¨me nâ€™est plus dÃ©gradÃ© par redondance.\r
- Exposition du backend de cache effectif (\`redis\`, \`memory\`, \`memory-fallback\`) dans \`/health\`, \`/api/admin/cache-stats\` et lâ€™admin.\r
\r
#### Backup et diagnostics utilisateurs\r
- Correction des erreurs FTP/SFTP remontÃ©es brutes dans lâ€™UI backup.\r
- Mapping explicite des erreurs techniques de connexion distante : certificat TLS invalide, timeout, refus de connexion, Ã©chec dâ€™authentification, chemin distant introuvable.\r
- Le cas \`self-signed certificate\` nâ€™est plus affichÃ© tel quel Ã\xA0 lâ€™utilisateur.\r
- Nettoyage de la locale FR backup et des libellÃ©s visibles de la page de sauvegarde.\r
\r
#### Cache et dÃ©ploiement\r
- Abstraction de cache finalisÃ©e avec backend \`memory|redis\`.\r
- IntÃ©gration Redis dans le setup Docker et ajout dâ€™un mode avec Redis sÃ©parÃ© du conteneur applicatif.\r
- Harmonisation des scripts \`docker-build.bat\`, \`docker-run.bat\`, \`docker-stop.bat\` et \`.env.docker\` autour de cette architecture.\r
\r
#### Refactors backend\r
- DÃ©coupage de \`metrics.service.js\` en modules dÃ©diÃ©s : Ã©tat, LLM, persistance, snapshots, opÃ©rations.\r
- DÃ©coupage de \`openai/resumeOperations.js\` avec extraction de la normalisation CV.\r
- DÃ©coupage de \`openai/missionOperations.js\` avec extraction de la normalisation matching/adaptation.\r
- DÃ©coupage du domaine \`marketTrends\` en faÃ§ade, runtime de collecte, extracteurs et persistance.\r
- DÃ©coupage de \`marketFacts.service.js\` en faÃ§ade, cache et persistance.\r
\r
#### Refactors front et i18n\r
- DÃ©coupage supplÃ©mentaire des pages lourdes : mÃ©triques, settings, Ã©crans \`Resume*\`.\r
- Modularisation des locales \`fr\` et \`en\` par domaines logiques pour amÃ©liorer la maintenabilitÃ©.\r
- Nettoyage et centralisation des chaÃ®nes UI visibles sur les Ã©crans principaux.\r
\r
#### QualitÃ©\r
- Les suites client et serveur restent vertes aprÃ¨s ces changements.\r
- Tests ciblÃ©s ajoutÃ©s pour les erreurs TLS backup et les nouveaux chemins normalisÃ©s.\r
\r
---\r
\r
## v1.8.7 - 2026-03-21\r
### ðŸ“Š Suivi de Progression des Collectes Market Radar\r
\r
#### Jobs de Collecte â€” Progression en Temps RÃ©el\r
- **Collecte mÃ©tiers** : Ajout d'un callback \`onProgress\` Ã\xA0 \`collectITMetiers\` pour mise Ã\xA0 jour incrÃ©mentale aprÃ¨s chaque mÃ©tier traitÃ©\r
- **Collecte offres (facts)** : Ajout d'un callback \`onProgress\` Ã\xA0 \`runFullCollection\` et \`runSourceCollection\` avec mise Ã\xA0 jour toutes les 5 secondes\r
- **Collecte tendances** : RÃ©duction de l'intervalle de progression de 30s Ã\xA0 5s pour un affichage plus rÃ©actif\r
\r
#### Estimation du Total DÃ¨s le Lancement\r
- **Offres France Travail** : Calcul du total attendu \`(romeCodes Ã— rÃ©gions) + keywords\` avant la boucle de collecte, via callback \`onTotalEstimated\`\r
- **Tendances** : Calcul du total attendu \`5 Ã— (romeCodes Ã— rÃ©gions) + romeCodes + rÃ©gions\` dÃ¨s le chargement des mÃ©tiers IT\r
- **Barre de progression** : Le nombre cible (ex: \`120 / 1854\`) s'affiche immÃ©diatement au lieu de \`0 / 0\`\r
\r
#### Correction UPSERT Offres\r
- **storeFact** : Remplacement de l'INSERT simple par un \`INSERT ... ON CONFLICT DO UPDATE\` pour Ã©viter les erreurs de clÃ© dupliquÃ©e lors des re-collectes sur la contrainte \`(keyword, location, source, date)\`\r
\r
#### QualitÃ©\r
- **108 tests serveur** passent aprÃ¨s les modifications\r
- **Aucune rÃ©gression** sur les tests client et pdf-server\r
\r
---\r
\r
## v1.8.6 - 2026-03-17\r
### âœï¸ Ã‰diteur Tiptap, Vues GroupÃ©es par Affaire & Prompts LLM\r
\r
#### Migration Ã‰diteur TinyMCE â†’ Tiptap/ProseMirror\r
- **Nouvel Ã©diteur** : Remplacement complet de TinyMCE par Tiptap v3 (ProseMirror)\r
- **Toolbar contextuelle** : Bubble toolbar avec modes image, lien et texte\r
- **Toolbar principale** : Menu dÃ©roulant titres (H1-H4), menu tableau, boutons formatage\r
- **SystÃ¨me de suggestions** : Extension ProseMirror avec badges par section, scoring de correspondance et panneau global\r
- **Nettoyage** : Suppression des fichiers statiques TinyMCE et du script tag HTML\r
\r
#### Vues GroupÃ©es par Affaire\r
- **Missions par affaire** : Nouveau composant \`MissionsDealsGroupedView\` avec sections dÃ©pliables par deal, cartes mission et compteurs d'adaptations\r
- **Adaptations par affaire** : Nouveau composant \`AdaptationsDealsGroupedView\` avec hiÃ©rarchie Deal â†’ Mission â†’ Adaptations, recherche intÃ©grÃ©e et navigation vers les dÃ©tails\r
- **API backend** : Nouvel endpoint \`GET /api/adaptations/grouped-by-deal\` avec requÃªtes batch optimisÃ©es\r
- **Toggle vue** : SÃ©lecteur "Par affaire" / "Liste" sur les pages Missions et Adaptations\r
\r
#### Prompts LLM RestructurÃ©s\r
- **Prompt d'analyse/matching** : Format markdown structurÃ© avec rÃ¨gles anti-hallucination strictes\r
- **Prompt d'adaptation** : Directives par section, conservation du contenu original, suppression des inventions\r
- **Prompt d'amÃ©lioration** : Formatage backtick, rÃ¨gles de rÃ©sumÃ© impersonnel, vÃ©rification d'existence des sections\r
\r
#### AmÃ©liorations UI/UX\r
- **Animation d'amÃ©lioration** : Nouveau design avec carte inline, spinner multi-anneau et messages d'Ã©tat cycliques\r
- **Stepper de progression** : Spinners animÃ©s et fonds dÃ©gradÃ©s pour les Ã©tats de chargement\r
- **Preview CV inline** : Panneau de prÃ©visualisation avec chargement paresseux sur les cartes CV par affaire\r
- **PrioritÃ© d'affichage** : Inversion Nom du CV / Nom du candidat dans les adaptations\r
\r
#### Documentation\r
- **SECURITY.md** : Mise Ã\xA0 jour complÃ¨te (circuit breakers LLM, APM, mÃ©triques, endpoints publics, validation environnement, 9 nouvelles entrÃ©es checklist, table de rÃ©fÃ©rence fichiers corrigÃ©e)\r
- **ARCHITECTURE.md** : Mise Ã\xA0 jour pour reflÃ©ter la migration Tiptap, le routage modulaire et les nouvelles fonctionnalitÃ©s\r
- **INSTALL.md** : Mise Ã\xA0 jour de la documentation d'installation\r
\r
---\r
\r
## v1.8.5 - 2026-03-16\r
### ðŸ§ª Tests Routes Backend Complets\r
\r
#### Nouveaux Tests Routes\r
- **missions.routes.test.js** : 34 tests couvrant GET /, GET /:id, POST /, PUT /:id, DELETE /:id, GET /:missionId/adaptations\r
- **Suite complÃ¨te** : 10 fichiers de tests, 197 tests passent\r
\r
#### Corrections Tests Existants\r
- **batchJobs.routes.test.js** : Correction des mocks (\`vi.resetAllMocks\` au lieu de \`clearAllMocks\`), mock multer pour \`req.body\`, alignement avec les vraies routes\r
- **clients.routes.test.js** : Correction rÃ©ponse \`data\` vs \`clients\`, ajout mocks multi-requÃªtes (contacts, submissions)\r
- **deals.routes.test.js** : Ajout mock pour vÃ©rification firm du resume dans POST /:id/resumes\r
- **adaptations.routes.test.js** : Correction \`data\` vs \`records\`, \`findWithTimeout\` lance une erreur 404 au lieu de retourner \`null\`\r
\r
#### AmÃ©liorations Techniques\r
- **Mocks factory functions** : \`userRateLimit\` correctement mockÃ© comme factory \`() => middleware\`\r
- **Isolation des tests** : \`vi.resetAllMocks()\` pour Ã©viter les fuites de mocks entre tests\r
- **Couverture routes critiques** : auth, resumes, missions, clients, deals, adaptations, batchJobs, health\r
\r
---\r
\r
## v1.8.4 - 2026-03-12\r
### ðŸ“¦ Export Multi-Format & QualitÃ© Code\r
\r
#### Export par Lot Multi-Format\r
- **SÃ©lection multiple** : Remplacement des radio buttons par des checkboxes pour sÃ©lectionner plusieurs formats (PDF, DOCX, DOC)\r
- **Dossiers par type** : Le ZIP d'export contient maintenant un dossier par format sÃ©lectionnÃ© (PDF/, DOCX/, DOC/)\r
- **Rate limit augmentÃ©** : Limite PDF serveur passÃ©e de 200 Ã\xA0 300 req/min pour supporter 100 docs Ã— 3 formats\r
- **Animation de chargement** : Feedback visuel lors du dÃ©pÃ´t de fichiers dans la zone de drop\r
\r
#### QualitÃ© Code\r
- **Tests corrigÃ©s** : Migration du fichier \`resumes.routes.test.js\` de Jest vers Vitest\r
- **Lint fixes** : Correction de 22 erreurs ESLint (imports inutilisÃ©s)\r
- **Variables prÃ©fixÃ©es** : ~20 variables catch/paramÃ¨tres inutilisÃ©s prÃ©fixÃ©s avec \`_\`\r
- **396 tests passent** : Tous les tests unitaires et d'intÃ©gration passent\r
\r
#### Corrections Techniques\r
- **Gestion des doublons** : Les fichiers avec le mÃªme nom reÃ§oivent un suffixe numÃ©rique dans le ZIP\r
- **Validation frontend** : Le bouton "Traiter" est dÃ©sactivÃ© si l'export est activÃ© mais aucun format n'est sÃ©lectionnÃ©\r
\r
---\r
\r
## v1.8.3 - 2026-03-11\r
### ðŸ”§ Corrections Scheduler Backup & Radar du MarchÃ©\r
\r
#### Corrections Scheduler de Sauvegarde\r
- **Initialisation correcte** : \`initBackupScheduler()\` dÃ©placÃ© dans le bloc DB connectÃ© pour garantir l'exÃ©cution aprÃ¨s connexion Ã\xA0 la base\r
- **CrÃ©ation automatique des tables** : Nouvelle fonction \`initBackupTables()\` crÃ©e automatiquement \`backup_settings\` et \`backup_history\` au dÃ©marrage\r
- **Gestion des erreurs** : Meilleure gestion des erreurs DB lors du chargement des paramÃ¨tres de sauvegarde\r
\r
#### Corrections Radar du MarchÃ©\r
- **Valeurs carte de France** : Correction de l'affichage des chiffres sur la carte (offres d'emploi, embauches, etc.)\r
- **Conversion NULL/DECIMAL** : Les valeurs NULL sont maintenant converties en 0, les DECIMAL en nombres cÃ´tÃ© serveur\r
- **4 fonctions corrigÃ©es** : \`getStoredTrendsLight\`, \`getStoredTrendsWithMetadata\`, \`getTrendMetadata\`, \`loadTrendsCache\`\r
\r
#### AmÃ©liorations Techniques\r
- **Import statique** : Conversion de l'import dynamique \`apiInterceptor\` en import statique dans \`textExtraction.ts\` (supprime le warning Rollup)\r
- **Types API** : Nouveau fichier \`client/src/types/api.ts\` avec types standardisÃ©s pour les rÃ©ponses API\r
- **Index types** : Nouveau fichier \`client/src/types/index.ts\` pour exports centralisÃ©s\r
\r
---\r
\r
## v1.8.2 - 2026-03-09\r
### ðŸ–¨ï¸ Refactoring PDF Server\r
\r
#### GÃ©nÃ©ration de documents\r
- **PDF** : GÃ©nÃ©ration via Puppeteer avec support des headers/footers natifs\r
- **Headers/Footers** : Support natif des headers dans le body et footers dans les marges de page\r
- **Compteurs de pages** : Support des placeholders \`-pageNumber-\` et \`-totalPages-\`\r
- **DOCX** : GÃ©nÃ©ration via Pandoc avec injection de footer Word natif en post-traitement\r
- **DOC** : Conversion PDF â†’ DOC via LibreOffice\r
\r
#### Refactoring du Serveur PDF\r
- **Architecture modulaire** : \`server.cjs\` divisÃ© en modules sÃ©parÃ©s pour une meilleure maintenabilitÃ©\r
  - \`lib/logger.cjs\` : Utilitaire de logging centralisÃ©\r
  - \`lib/htmlBuilder.cjs\` : Construction HTML pour Puppeteer\r
  - \`lib/pdfGenerator.cjs\` : GÃ©nÃ©ration PDF via Puppeteer\r
  - \`lib/docxGenerator.cjs\` : GÃ©nÃ©ration DOCX/DOC (Pandoc + LibreOffice)\r
- **Code rÃ©duit** : \`server.cjs\` rÃ©duit de ~670 Ã\xA0 ~320 lignes\r
- **TestabilitÃ©** : Fonctions exportables pour tests unitaires\r
\r
---\r
\r
## v1.8.1 - 2026-03-09\r
### ðŸ”§ Corrections de StabilitÃ© & SÃ©curitÃ©\r
\r
#### Corrections de SÃ©curitÃ©\r
- **Sanitization XSS** : Ajout de \`createSafeHtml()\` pour tous les rendus HTML dynamiques (VersionsPanel, ExportTab, CompareTab)\r
- **Configuration proxy** : Correction de la dÃ©tection d'IP pour le rate limiting derriÃ¨re reverse proxy\r
\r
#### Corrections de StabilitÃ©\r
- **Statut sauvegarde** : Correction du statut "Running" qui restait affichÃ© aprÃ¨s une sauvegarde terminÃ©e\r
- **Nettoyage automatique** : Les sauvegardes bloquÃ©es depuis plus de 30 minutes sont automatiquement marquÃ©es comme Ã©chouÃ©es\r
- **Scheduler de sauvegarde** : DÃ©marrage explicite des jobs cron avec \`.start()\` pour garantir leur exÃ©cution\r
\r
#### AmÃ©liorations Techniques\r
- **RÃ©fÃ©rence base de donnÃ©es** : Correction des rÃ©fÃ©rences obsolÃ¨tes vers l'ancienne table \`customers\` (renommÃ©e \`firms\`)\r
- **Limite chatbot** : Augmentation de la limite du guide utilisateur de 60000 Ã\xA0 100000 caractÃ¨res\r
- **Nettoyage logs** : Suppression des \`console.log\` de debug dans le preview PDF\r
\r
---\r
\r
## v1.8.0 - 2026-03-08\r
### ðŸ—„ï¸ Page Sauvegarde DÃ©diÃ©e & Corrections FTP/TLS\r
\r
#### Nouvelle Page Sauvegarde\r
- **Page dÃ©diÃ©e** : Nouvelle page "Sauvegarde" accessible depuis le menu principal (admin uniquement)\r
- **URL** : \`/dashboard/backup\` avec protection AdminRoute\r
- **Menu** : EntrÃ©e "Sauvegarde" dans la partie basse du menu, entre ParamÃ¨tres et Guide Utilisateur\r
- **Traductions** : Namespace \`backup.*\` complet en franÃ§ais et anglais\r
\r
#### Sauvegarde FTP/SFTP\r
- **Modes TLS** : Support complet des modes TLS (Explicite AUTH TLS, Implicite port 990, Aucun)\r
- **Correction FTP** : RÃ©solution de l'erreur "503 Use AUTH first" - AUTH TLS envoyÃ© avant USER\r
- **Validation Zod** : SchÃ©mas de validation pour les paramÃ¨tres de sauvegarde\r
- **Planification** : Sauvegardes quotidiennes, hebdomadaires et mensuelles avec rÃ©tention configurable\r
\r
#### Scripts Docker\r
- **docker-logs.bat** : Affiche les logs du Proxy Server (backend principal)\r
- **docker-logs-pdf.bat** : Nouveau script pour les logs du PDF Server\r
- **Documentation** : Section "Viewing Logs" ajoutÃ©e dans docker/README.md\r
\r
#### AmÃ©liorations Techniques\r
- **basic-ftp** : Correction du paramÃ¨tre \`secure\` (true pour explicite, "implicit" pour implicite)\r
- **Logging** : Logs dÃ©taillÃ©s pour le diagnostic des connexions FTP/SFTP\r
\r
---\r
\r
## v1.7.9 - 2026-03-08\r
### ðŸ\xA0 Page d'Accueil Publique & Stockage Logo en Base\r
\r
#### Page d'Accueil Publique\r
- **Nouvelle page** : Page d'accueil publique pour les utilisateurs non connectÃ©s (\`/welcome\`)\r
- **Header public** : Boutons "Se connecter" et "S'inscrire" stylisÃ©s de maniÃ¨re cohÃ©rente\r
- **Section Hero** : RÃ©utilisation de la hero zone de la page d'accueil principale\r
- **Footer** : Affichage du footer de l'application\r
- **Configuration** : Variable d'environnement \`VITE_PUBLIC_HOME=true\` pour activer la page publique\r
- **Redirection intelligente** : Les utilisateurs non connectÃ©s sont redirigÃ©s vers \`/welcome\` si activÃ©\r
\r
#### Stockage Logo Cabinet en Base de DonnÃ©es\r
- **Nouveau champ** : \`logo_data\` (BYTEA) et \`logo_mime_type\` dans la table \`firms\`\r
- **Persistance Docker** : Les logos sont maintenant stockÃ©s en base de donnÃ©es (plus de perte lors des rebuilds)\r
- **Route API** : \`GET /api/firms/:id/logo/image\` pour servir les logos depuis la base\r
- **Migration** : \`add_firm_logo_data.sql\` pour les bases existantes\r
\r
#### AmÃ©liorations UI\r
- **Footer sur Register** : Ajout du footer sur la page d'inscription (comme sur SignIn)\r
- **Boutons cohÃ©rents** : Style unifiÃ© pour les boutons de connexion/inscription\r
\r
---\r
\r
## v1.7.8 - 2026-03-07\r
### ðŸ³ Docker AmÃ©liorations & Documentation APM\r
\r
#### Docker\r
- **Port HTTPS** : Utilisation du port 3443 (au lieu de 443) pour Ã©viter les conflits de permissions\r
- **Mot de passe PostgreSQL sÃ©curisÃ©** : Nouveau mot de passe sÃ©curisÃ© (voir documentation interne)\r
- **Scripts .bat Windows** : Nouveaux scripts simplifiÃ©s Ã\xA0 la racine (\`docker-build.bat\`, \`docker-run.bat\`, \`docker-stop.bat\`, \`docker-logs.bat\`, \`docker-shell.bat\`)\r
- **Google Chrome** : Utilisation de Google Chrome au lieu de Chromium pour la gÃ©nÃ©ration PDF (meilleure compatibilitÃ©)\r
\r
#### Documentation\r
- **INSTALL.md** : Simplification de la section Docker avec scripts .bat comme mÃ©thode recommandÃ©e\r
- **ARCHITECTURE.md** : \r
  - Nouvelle section "Monitoring & APM" documentant l'APM interne\r
  - Tableau comparatif APM interne vs externe (Datadog, New Relic)\r
  - Ajout des identifiants PostgreSQL Docker\r
  - Ajout des scripts .bat Windows\r
- **docker/README.md** : Mise Ã\xA0 jour des ports et credentials\r
\r
#### Corrections\r
- **Puppeteer** : Correction du chemin exÃ©cutable dans \`supervisord.conf\` (\`google-chrome-stable\`)\r
- **CohÃ©rence mot de passe** : Synchronisation entre crÃ©ation utilisateur PostgreSQL et variable d'environnement\r
\r
---\r
\r
## v1.7.7 - 2026-03-05\r
### ðŸ³ Docker PostgreSQL 18 & Documentation\r
\r
#### Configuration Docker\r
- **PostgreSQL 18** : Mise Ã\xA0 jour de PostgreSQL 14 vers 18 pour cohÃ©rence avec l'environnement hors Docker\r
- **Secrets stables** : Les secrets JWT ne sont plus gÃ©nÃ©rÃ©s alÃ©atoirement Ã\xA0 chaque dÃ©marrage (Ã©vite dÃ©connexions)\r
- **Variables complÃ¨tes** : Ajout de \`REFRESH_TOKEN_SECRET\`, \`CSRF_SECRET\`, \`GOOGLE_CLIENT_ID\`, \`GOOGLE_CLIENT_SECRET\`, \`MAIL_TOKEN_ENCRYPTION_KEY\`\r
- **Volume PostgreSQL** : Chemin mis Ã\xA0 jour vers \`/var/lib/postgresql/18/main\`\r
\r
#### Documentation\r
- **INSTALL.md** : Commande Docker complÃ¨te avec tous les secrets et volume PostgreSQL\r
- **ARCHITECTURE.md** : Nouvelle section "DÃ©ploiement Docker" avec schÃ©ma d'architecture conteneur\r
- **docker/README.md** : Mise Ã\xA0 jour des chemins PostgreSQL 18\r
\r
#### Guide Utilisateur\r
- **Bonnes Pratiques** : Section entiÃ¨rement rÃ©Ã©crite pour couvrir l'application complÃ¨te\r
  - ðŸ“„ Gestion des CV (import, qualitÃ©, structure)\r
  - ðŸŽ¯ Missions et Matching (crÃ©ation, optimisation)\r
  - ðŸ‘¥ Clients et Contacts (organisation, suivi)\r
  - ðŸ“Š Pipeline de Recrutement (gestion par Ã©tape)\r
  - âœ‰ï¸ Envoi de CV (prÃ©paration, bonnes pratiques)\r
  - ðŸ”’ ConformitÃ© RGPD (consentement, audit)\r
  - ðŸ“ˆ Market Radar (veille marchÃ©)\r
  - âš™ï¸ Administration (configuration, sÃ©curitÃ©)\r
  - ðŸ”„ Workflow RecommandÃ© (schÃ©ma complet)\r
  - ðŸ’¡ Conseils de ProductivitÃ©\r
- **Guide EN** : SynchronisÃ© avec la version franÃ§aise\r
\r
#### Corrections\r
- **UserGuidePage** : Correction du regex d'extraction de section (matchait \`###\` au lieu de \`##\`)\r
\r
---\r
\r
## v1.7.6 - 2026-03-04\r
### ðŸ“Š Pipeline Kanban & Entretiens Multiples\r
\r
#### Vue Kanban au Niveau Mission\r
- **Nouveau** : Tableau Kanban intÃ©grÃ© sur la page de dÃ©tail de chaque mission\r
- **Colonnes par Ã©tape** : Visualisation des candidats par Ã©tape du pipeline\r
- **Drag & Drop** : Glisser-dÃ©poser pour changer l'Ã©tape d'un candidat\r
- **Cartes candidats** : Affichent nom, score, tags, notes, date, nombre d'entretiens\r
- **Ajout direct** : Ajouter des CVs au pipeline depuis la page mission\r
\r
#### Gestion des Entretiens Multiples\r
- **Entretiens successifs** : PossibilitÃ© de planifier plusieurs entretiens pour un mÃªme candidat\r
- **Types d'entretiens** : Client (bleu), Partenaire (violet), Technique (vert), RH (orange)\r
- **Impact diffÃ©renciÃ©** : Seul l'entretien "Client" fait passer Ã\xA0 l'Ã©tape "Entretien planifiÃ©"\r
- **Liste des entretiens** : Modal affichant tous les entretiens (passÃ©s, planifiÃ©s, annulÃ©s)\r
- **Actions rapides** : Marquer comme terminÃ© ou annuler depuis la liste\r
\r
#### Onglet SÃ©lection Ã‰tendu\r
- **Page AmÃ©lioration** : L'onglet "SÃ©lection" est maintenant disponible sur la page d'amÃ©lioration du CV\r
- **AccÃ¨s unifiÃ©** : Pipeline accessible depuis l'analyse ET l'amÃ©lioration\r
\r
#### Corrections\r
- **RequÃªte SQL** : Correction de la colonne \`global_score\` â†’ \`global_rating\` dans le service pipeline\r
- **Google SSO** : Prompt OAuth changÃ© de 'select_account' Ã\xA0 'consent' pour garantir le refresh token\r
\r
#### Documentation\r
- **Guide utilisateur FR/EN** : Mise Ã\xA0 jour de la section Pipeline de SÃ©lection\r
- **Nouvelles sections** : Vue Kanban, Entretiens multiples, Types d'entretiens\r
\r
---\r
\r
## v1.7.5 - 2026-03-01\r
### ðŸ“‹ Journal d'Audit RGPD\r
\r
#### Nouvelle FonctionnalitÃ© : Journal RGPD\r
- **Table \`gdpr_audit_log\`** : Nouvelle table pour tracer toutes les actions RGPD\r
- **Service backend** : \`gdprAudit.service.js\` pour logger et consulter les actions\r
- **API REST** : Endpoints \`/api/gdpr-audit/*\` pour consultation admin\r
- **Ã‰cran admin** : Nouvelle page "Journal RGPD" accessible via Admin â†’ Journal RGPD\r
\r
#### Actions JournalisÃ©es\r
- **Consentement** : Envoi de demande, rappel, acceptation, refus\r
- **DonnÃ©es** : Export, suppression, anonymisation\r
- **CV** : Upload, traitement, purge automatique\r
- **AutomatisÃ©** : Purges planifiÃ©es, rappels automatiques\r
\r
#### FonctionnalitÃ©s de l'Ã‰cran Admin\r
- **Filtres avancÃ©s** : Par cabinet, catÃ©gorie, action, type (auto/manuel), email, dates\r
- **Statistiques** : Total actions 30j, rÃ©partition par catÃ©gorie, auto vs manuel\r
- **Pagination** : Navigation dans les logs avec 25 entrÃ©es par page\r
- **DÃ©tails JSON** : Affichage extensible des mÃ©tadonnÃ©es\r
\r
#### IntÃ©gration\r
- **consent.service.js** : Logging automatique des actions de consentement\r
- **Purges automatiques** : TraÃ§abilitÃ© des suppressions planifiÃ©es\r
- **Multi-cabinet** : Distinction par firm_id pour environnements multi-tenants\r
\r
#### Documentation\r
- **Guide utilisateur FR/EN** : Section "Journal d'Audit RGPD" ajoutÃ©e\r
- **Menu navigation** : Lien ajoutÃ© dans la section Admin\r
\r
---\r
\r
## v1.7.4 - 2026-03-01\r
### ðŸ›¡ï¸ RGPD & DPO - ConformitÃ© RenforcÃ©e\r
\r
#### Onglet DPO dans les ParamÃ¨tres\r
- **Nouveau** : Onglet "DPO" pour configurer les coordonnÃ©es du DÃ©lÃ©guÃ© Ã\xA0 la Protection des DonnÃ©es\r
- **Champs** : Nom, Email, TÃ©lÃ©phone du DPO\r
- **IntÃ©gration** : Sauvegarde via le bouton global des paramÃ¨tres\r
\r
#### Email de Consentement RGPD\r
- **Refonte complÃ¨te** du template email de demande de consentement\r
- **Sections dÃ©taillÃ©es** : Pourquoi nous conservons, donnÃ©es concernÃ©es, partage, durÃ©e, droits\r
- **Email DPO dynamique** : Utilise les coordonnÃ©es configurÃ©es dans les paramÃ¨tres\r
- **Design professionnel** : Mise en page moderne avec icÃ´nes et couleurs\r
\r
#### Ã‰cran de Consentement Candidat\r
- **CohÃ©rence** avec l'email de consentement\r
- **Nouvelles sections** : Traitements automatisÃ©s, donnÃ©es concernÃ©es, droits RGPD\r
- **Mention DPO** : Contact pour exercer ses droits\r
\r
#### Pages LÃ©gales\r
- **Privacy Policy** : Nouvelle page \`/privacy\` accessible publiquement\r
- **Terms of Service** : Nouvelle page \`/terms\` accessible publiquement\r
- **Footer** : Liens ajoutÃ©s vers les pages lÃ©gales\r
- **Traductions** : FR/EN complÃ¨tes\r
\r
#### Corrections\r
- **Validation schema** : Accepte les champs DPO dans les settings\r
- **Migration SQL** : Colonnes DPO ajoutÃ©es Ã\xA0 \`llm_settings\`\r
- **Description service** : CorrigÃ©e dans les Conditions d'Utilisation\r
\r
---\r
\r
## v1.7.3 - 2026-03-01\r
### ðŸš€ Migration React 19 + Express 5\r
\r
#### Migration Majeure\r
- **React** : 18.3.1 â†’ 19.1.0\r
- **React DOM** : 18.3.1 â†’ 19.1.0\r
- **Express** : 4.22.1 â†’ 5.2.1\r
- **framer-motion** : 10.18.0 â†’ 12.34.3\r
- **i18next** : 24.2.3 â†’ 25.8.13\r
- **@types/react** : 18.3.28 â†’ 19.2.14\r
- **@types/react-dom** : 18.3.7 â†’ 19.2.3\r
\r
#### Corrections React 19\r
- **CompatibilitÃ© JSX** : Shim global pour \`JSX.Element\`\r
- **framer-motion** : \`as const\` pour les valeurs \`ease\`\r
\r
#### Migration Express 5\r
- **Wildcard routes** : \`app.get('*')\` â†’ \`app.get('/*splat')\`\r
- **Async handlers** : Gestion automatique des promesses rejetÃ©es\r
\r
#### Nettoyage\r
- **Suppression** : \`@rollup/plugin-node-resolve\` (inutile avec Vite 5)\r
- **Configuration .env** : Nettoyage des duplications\r
\r
#### Note Technique\r
- Vite 7 testÃ© mais incompatible (problÃ¨mes ESM/CJS)\r
- Vite 5.4.x maintenu pour stabilitÃ©\r
\r
---\r
\r
## v1.7.2 - 2026-03-01\r
### ðŸ”§ AmÃ©liorations QualitÃ© & Tests\r
\r
#### Migration React 19 + Vite 7\r
- **React** : 18.3.1 â†’ 19.1.0\r
- **React DOM** : 18.3.1 â†’ 19.1.0\r
- **@types/react** : 18.3.28 â†’ 19.2.14\r
- **@types/react-dom** : 18.3.7 â†’ 19.2.3\r
- **Vite** : 5.4.21 â†’ 7.3.1\r
- **@vitejs/plugin-react** : 4.7.0 â†’ 5.1.4\r
- **framer-motion** : 10.18.0 â†’ 12.34.3\r
- **i18next** : 24.2.3 â†’ 25.8.13\r
- **react-i18next** : mise Ã\xA0 jour pour compatibilitÃ© Vite 7\r
- **CompatibilitÃ© JSX** : Shim global pour \`JSX.Element\`\r
- **Rollup config** : \`shimMissingExports\` + \`namedExports\` pour React\r
\r
#### SÃ©curitÃ©\r
- **VulnÃ©rabilitÃ© esbuild** : CorrigÃ©e via override npm (^0.25.0)\r
- **VulnÃ©rabilitÃ©s elliptic** : 6 low severity (dÃ©pendances transitives, acceptable)\r
- **Configuration .env** : Nettoyage des duplications, correction ALLOWED_ORIGINS\r
\r
#### Tests (+48 nouveaux tests)\r
- **totp.service.js** : 14 tests (gÃ©nÃ©ration secret, vÃ©rification 2FA, lifecycle)\r
- **consent.service.js** : 24 tests (initialisation, validation token, RGPD)\r
- **mailService.js** : 10 tests (OAuth, connexion, tokens)\r
- **Total** : 373 tests passÃ©s\r
\r
#### ESLint\r
- **0 erreurs** (contre 322 avant)\r
- Configuration ajustÃ©e pour rÃ¨gles trop strictes\r
- Ignores : \`client/dist/\`, \`coverage/\`, fichiers timestamp Vite\r
\r
#### Nettoyage\r
- **DÃ©pendance supprimÃ©e** : \`hi-base32\` (remplacÃ©e par speakeasy)\r
- **Fichier supprimÃ©** : \`smtpService.js\` (non utilisÃ©)\r
- **Configuration Knip** : Mise Ã\xA0 jour des ignores\r
- **78 packages** mis Ã\xA0 jour (mineures)\r
\r
---\r
\r
## v1.7.1 - 2026-03-01\r
### ðŸ“š Documentation & QualitÃ©\r
\r
#### Documentation Swagger ComplÃ¨te\r
- **Endpoints 2FA** : Documentation des 5 routes \`/api/2fa/*\`\r
- **Email Templates** : 10 endpoints pour la gestion des templates MJML\r
- **Consent RGPD** : 7 endpoints pour la gestion du consentement\r
- **GDPR Mail** : 5 endpoints pour la configuration email RGPD\r
- **Admin** : 4 endpoints pour les logs de sÃ©curitÃ© et statistiques\r
- **Schemas** : Ajout de \`EmailTemplate\`, \`ConsentStatus\`, \`SecurityLog\`\r
- **User schema** : Ajout des champs \`totp_enabled\`, \`totp_enabled_at\`\r
- **LoginRequest/Response** : Support du champ \`totpCode\` et \`requires2FA\`\r
\r
#### Guide Utilisateur\r
- **Section Profil Utilisateur** : Nouvelle section complÃ¨te dans USER_GUIDE.md et USER_GUIDE_EN.md\r
- **Documentation 2FA** : Instructions dÃ©taillÃ©es pour activer/dÃ©sactiver le 2FA\r
- **Navigation** : Ajout de la section dans le menu de UserGuidePage.tsx\r
\r
#### Corrections\r
- **Route PUT /api/users/:id** : Ajout de la route manquante pour la mise Ã\xA0 jour du profil utilisateur\r
- **DÃ©pendance otplib** : Suppression (remplacÃ©e par speakeasy)\r
- **Configuration knip** : Nettoyage et mise Ã\xA0 jour\r
\r
#### Tests\r
- **64 nouveaux tests** : Tests pour \`logger.backend.js\` et \`validation.js\`\r
- **Total** : 325 tests passÃ©s\r
\r
---\r
\r
## v1.7.0 - 2026-03-01\r
### ðŸ” Authentification Ã\xA0 Deux Facteurs (2FA)\r
\r
#### Nouvelle FonctionnalitÃ© : 2FA TOTP\r
- **Service TOTP** : ImplÃ©mentation complÃ¨te avec \`otplib\` (RFC 6238)\r
- **QR Code** : GÃ©nÃ©ration automatique pour Google Authenticator, Authy, etc.\r
- **Codes de secours** : 8 codes de secours gÃ©nÃ©rÃ©s et chiffrÃ©s en base\r
- **Flux de login** : VÃ©rification 2FA intÃ©grÃ©e au processus de connexion\r
- **Gestion utilisateur** : Activation, dÃ©sactivation, rÃ©gÃ©nÃ©ration des codes\r
\r
#### Fichiers Backend\r
- \`server/services/totp.service.js\` : Service complet de gestion TOTP\r
- \`server/routes/twofa.routes.js\` : Routes API \`/api/2fa/*\`\r
- \`server/routes/auth.routes.js\` : IntÃ©gration 2FA au login\r
- \`docker/migrations/add_2fa_columns.sql\` : Migration SQL\r
\r
#### Fichiers Frontend\r
- \`TwoFactorSetup.tsx\` : Assistant de configuration 2FA avec QR code\r
- \`TwoFactorVerify.tsx\` : Ã‰cran de vÃ©rification lors du login\r
- \`TwoFactorSettings.tsx\` : Gestion 2FA dans les paramÃ¨tres utilisateur\r
- \`SignIn.tsx\` : Support du flux 2FA\r
- \`AuthContext.tsx\` : Type \`SignInResponse\` pour 2FA\r
\r
#### SÃ©curitÃ©\r
- Secrets TOTP chiffrÃ©s en AES-256-GCM\r
- Codes de secours Ã\xA0 usage unique\r
- Logging des Ã©vÃ©nements 2FA\r
\r
---\r
\r
## v1.6.6 - 2026-03-01\r
### ðŸ”§ Corrections & AmÃ©liorations\r
\r
#### Token GDPR Global\r
- **Architecture corrigÃ©e** : Le token Gmail RGPD est maintenant **global** (pas par cabinet)\r
- **Nouvelle table** : \`global_gdpr_mail_token\` pour stocker un seul token pour toute l'application\r
- **Refresh automatique** : Token rafraÃ®chi automatiquement chaque semaine via le scheduler\r
- **Retry intelligent** : Si Google rejette le token, refresh automatique et retry\r
- **Migration SQL** : \`docker/migrations/add_global_gdpr_mail_token.sql\`\r
\r
#### Consentement RGPD\r
- **Statut 'error'** : Ajout de \`'error'\` comme valeur valide pour \`consent_status\`\r
- **Rappels fonctionnels** : Correction de l'appel \`sendEmail()\` pour les rappels de consentement\r
- **Migration SQL** : \`docker/migrations/add_error_to_consent_status.sql\`\r
\r
#### QualitÃ© du Code\r
- **Tests corrigÃ©s** : Correction des 4 tests cassÃ©s dans \`health.routes.test.js\` (mock \`req.query\`)\r
- **Whitelist SQL Ã©tendue** : Ajout de 12 tables manquantes dans \`postgresHelpers.js\`\r
- **Logging amÃ©liorÃ©** : Remplacement des erreurs silencieuses par des logs \`warn\` dans \`mailService.js\`\r
\r
#### UI Mobile\r
- **Menu hamburger** : Fond opaque (\`bg-white\`/\`bg-gray-800\`) pour une meilleure lisibilitÃ©\r
- **Backdrop blur** : Effet de flou sur l'arriÃ¨re-plan du menu mobile\r
\r
---\r
\r
## v1.6.5 - 2026-02-28\r
### ðŸ”’ SÃ©curitÃ© & QualitÃ© du Code\r
\r
#### Analyse de SÃ©curitÃ© ComplÃ¨te\r
- **Audit global** : Analyse exhaustive de l'application (authentification, autorisation, injection, CORS, rate limiting)\r
- **Points positifs confirmÃ©s** : Injection SQL protÃ©gÃ©e, XSS sanitisÃ©, JWT sÃ©curisÃ©, bcrypt pour mots de passe\r
\r
#### Protection MÃ©moire - Rate Limiting\r
- **Limite de taille** : Ajout de \`MAX_RATE_LIMIT_ENTRIES = 10000\` pour Ã©viter les fuites mÃ©moire\r
- **Pruning automatique** : Suppression de 10% des entrÃ©es les plus anciennes quand la limite est atteinte\r
- **Fichier** : \`server/middleware/rateLimit.middleware.js\`\r
\r
#### Logs StructurÃ©s - Proxy Server\r
- **Migration console â†’ safeLog** : Remplacement de 45 occurrences de \`console.log/error\` par \`safeLog\`\r
- **Handlers globaux** : \`uncaughtException\` et \`unhandledRejection\` utilisent maintenant \`safeLog\`\r
- **Startup/Shutdown** : Logs structurÃ©s avec mÃ©tadonnÃ©es JSON pour \`onServerStart()\` et \`gracefulShutdown()\`\r
- **Fichier** : \`server/proxy-server.js\`\r
\r
#### MÃ©triques LLM\r
- **Tarifs Q1 2026** : Mise Ã\xA0 jour des prix OpenAI (GPT-5.2) et Anthropic (Claude 4.6)\r
- **Tracking unifiÃ©** : Correction du double comptage dans \`chatbot.routes.js\`\r
- **Fichiers** : \`server/services/metrics.service.js\`, \`server/services/llm.service.js\`\r
\r
#### Corrections Techniques\r
- **Erreurs silencieuses** : Remplacement de \`catch { /* ignore */ }\` par logging en niveau \`debug\`\r
- **Fichier** : \`server/routes/resumes.routes.js\`\r
\r
---\r
\r
## v1.6.4 - 2026-02-28\r
### ðŸ“§ Envoi Email des CVs AdaptÃ©s\r
\r
#### Nouvelle FonctionnalitÃ© : Envoi Email pour Adaptations\r
- **Bouton email** : Ajout du bouton "Envoyer par email" sur la page de consultation d'une adaptation\r
- **PrÃ©-remplissage** : Client et contact prÃ©-remplis automatiquement depuis la mission associÃ©e\r
- **Modal SendEmailModal** : Nouvelles props \`prefilledClientId\`, \`prefilledContactId\`, \`missionTitle\`, \`isAdaptation\`\r
- **Backend enrichi** : Route GET \`/api/adaptations/:id\` retourne maintenant \`Mission Client ID\` et \`Mission Contact ID\`\r
\r
#### AmÃ©liorations du Modal d'Envoi Email\r
- **Template obligatoire** : L'utilisateur doit sÃ©lectionner un template email (plus de "Sans template")\r
- **Filtrage templates** : Seuls les templates utilisateur sont affichÃ©s (templates systÃ¨me masquÃ©s)\r
- **Bouton dÃ©sactivÃ©** : Le bouton d'envoi est grisÃ© tant qu'un template n'est pas sÃ©lectionnÃ©\r
\r
#### Corrections Techniques\r
- **GÃ©nÃ©ration PDF** : Ajout du paramÃ¨tre \`filename\` requis par le serveur PDF\r
- **Route PDF** : Correction de \`/api/generate-pdf\` vers \`/generate-pdf\`\r
- **Template CV** : RÃ©cupÃ©ration automatique du premier template CV actif pour la gÃ©nÃ©ration PDF\r
- **Version adaptation** : Ajout de \`currentVersion={1}\` pour les adaptations (pas de versioning)\r
\r
---\r
\r
## v1.6.3 - 2026-02-28\r
### ðŸŽ¯ Missions - Association Client/Contact & Adaptation CV\r
\r
#### Association Client/Contact aux Missions\r
- **Nouveaux champs** : Les missions peuvent maintenant Ãªtre associÃ©es Ã\xA0 un client/prospect et un interlocuteur\r
- **Migration SQL** : Ajout de la colonne \`contact_id\` Ã\xA0 la table \`missions\` avec clÃ© Ã©trangÃ¨re vers \`client_contacts\`\r
- **Formulaire enrichi** : SÃ©lecteurs en cascade Client â†’ Contact dans le formulaire de crÃ©ation/Ã©dition de mission\r
- **Validation backend** : VÃ©rification que le client appartient Ã\xA0 la firm de l'utilisateur\r
- **Affichage tuiles** : Client (avec badge Prospect/Client) et interlocuteur affichÃ©s sur les cartes mission\r
\r
#### Adaptation CV Ã\xA0 une Mission\r
- **Nouvelle page** : \`ResumeAdaptPage.tsx\` avec workflow en 3 Ã©tapes (SÃ©lectionner â†’ Analyser â†’ Adapter)\r
- **Route ajoutÃ©e** : \`/resumes/:id/adapt\` pour accÃ©der Ã\xA0 l'adaptation depuis la page d'amÃ©lioration\r
- **Indicateur progression** : Affichage visuel des Ã©tapes avec icÃ´nes de validation\r
- **Navigation fluide** : AccÃ¨s direct Ã\xA0 l'adaptation crÃ©Ã©e aprÃ¨s gÃ©nÃ©ration\r
\r
#### Corrections & AmÃ©liorations\r
- **Bouton Modifier** : Correction du bouton "Modifier" sur la page de consultation de mission\r
- **RÃ©solution firm_id** : Utilisation de \`getUserFirmId()\` pour rÃ©soudre correctement le firm_id depuis le nom ou l'UUID\r
- **Validation Zod** : Acceptation des valeurs \`null\` pour \`Client ID\` et \`Contact ID\` dans les schÃ©mas de mission\r
\r
---\r
\r
## v1.6.2 - 2026-02-23\r
### ðŸ”’ RGPD - Badge Compact & Envoi Email Automatique\r
\r
#### Badge RGPD Compact avec Tooltip\r
- **Mode compact** : Badge RGPD minimaliste sur les cartes CV et page d'analyse\r
- **Tooltip hover** : Affichage du nom, email et date d'expiration du consentement\r
- **React Portal** : Rendu du tooltip hors du DOM parent pour Ã©viter le clipping\r
- **Largeur dynamique** : Tooltip auto-dimensionnÃ© selon le contenu\r
\r
#### Envoi Automatique Email RGPD\r
- **Email auto Ã\xA0 l'upload** : Envoi automatique de la demande de consentement lors de l'upload d'un CV externe\r
- **Logging dÃ©taillÃ©** : Traces complÃ¨tes pour le dÃ©bogage de l'envoi Gmail OAuth\r
- **Gestion token OAuth** : Documentation du processus de reconnexion Gmail en cas d'expiration\r
\r
#### Corrections Techniques\r
- **Colonne BDD** : Correction \`consent_given_at\` â†’ \`consent_responded_at\` dans les requÃªtes SQL\r
- **Import crypto** : Correction de l'import ES module pour \`crypto\`\r
- **Traduction manquante** : Ajout de la clÃ© \`resume.steps.improve\` en franÃ§ais\r
\r
---\r
\r
## v1.6.1 - 2026-02-23\r
### ðŸ§­ Breadcrumbs & Refactoring Navigation CV\r
\r
#### Navigation par Breadcrumbs\r
- **Composant Breadcrumbs** : ImplÃ©mentation sur l'ensemble des pages de l'application\r
- **GÃ©nÃ©ration automatique** : DÃ©tection intelligente des routes et affichage contextuel\r
- **Pages couvertes** : CVthÃ¨que, Missions, Clients, Adaptations, Templates, ParamÃ¨tres, Upload, Profile Matching, Guide Utilisateur, MÃ©triques, Logs de SÃ©curitÃ©, Utilisateurs, Tags, Templates Email\r
\r
#### Refactoring Workflow CV\r
- **URLs distinctes** : SÃ©paration en \`/resumes/:id/analysis\`, \`/resumes/:id/improve\`, \`/resumes/:id/export\`\r
- **Redirection automatique** : \`/resumes/:id\` redirige vers \`/resumes/:id/analysis\`\r
- **Nettoyage code** : Suppression de \`ResumeViewPage.tsx\` et \`ResumeAnalysis.tsx\` (ancien composant monolithique de 702 lignes)\r
\r
#### Corrections UI/UX\r
- **Boutons dark mode** : Style outlined subtil pour "Voir l'amÃ©lioration" et "Exporter" (meilleure lisibilitÃ©)\r
- **Animation amÃ©lioration** : Correction de l'affichage avec \`isVisible={true}\` et \`setTimeout\` pour le rendu React\r
\r
#### Traductions\r
- **Nouvelles clÃ©s** : \`navigation.securityLogs\`, \`navigation.upload\`, \`resume.analysis.title\`, \`resume.analysis.tabs.skills\`\r
\r
---\r
\r
## v1.6.0 - 2026-02-21\r
### ðŸ“§ Templates Email MJML & Profils Utilisateurs Enrichis\r
\r
#### Ã‰diteur de Templates Email MJML\r
- **Ã‰diteur visuel** : Nouveau composant \`EmailTemplateEditor.tsx\` avec blocs drag-and-drop (Logo, En-tÃªte, Paragraphe, Signature, Pied de page)\r
- **Compilation MJML** : IntÃ©gration de la bibliothÃ¨que MJML pour gÃ©nÃ©rer des emails HTML responsifs\r
- **Bloc Logo** : Support du logo dynamique du cabinet dans les templates avec \`{{firm.logo}}\`\r
- **PrÃ©visualisation** : AperÃ§u en temps rÃ©el du rendu HTML des templates\r
\r
#### Gestion des Logos de Cabinet\r
- **Upload de logo** : Nouvelle fonctionnalitÃ© d'upload de logo pour chaque cabinet (JPEG, PNG, GIF, WebP, SVG)\r
- **Stockage** : Logos stockÃ©s dans \`client/public/logos/\` avec noms uniques\r
- **URLs absolues** : Conversion automatique des chemins relatifs en URLs absolues pour les emails\r
- **Migration BDD** : Ajout de la colonne \`logo_url\` dans la table \`firms\`\r
\r
#### Profils Utilisateurs Enrichis\r
- **Nouveaux champs** : Ajout de \`job_title\` (fonction) et \`phone\` (tÃ©lÃ©phone) dans les profils utilisateurs\r
- **Formulaire admin** : Champs Fonction et TÃ©lÃ©phone dans le modal de gestion des utilisateurs\r
- **Migration BDD** : \`docker/migrations/add_user_profile_fields.sql\`\r
\r
#### Mots-clÃ©s Email Ã‰tendus\r
- **Nouveaux mots-clÃ©s** : \`{{user.email}}\`, \`{{user.jobTitle}}\`, \`{{user.phone}}\`\r
- **Enrichissement contexte** : Les donnÃ©es utilisateur sont rÃ©cupÃ©rÃ©es depuis la BDD lors de l'envoi pour garantir leur fraÃ®cheur\r
- **Documentation** : Liste complÃ¨te des mots-clÃ©s disponibles dans l'Ã©diteur\r
\r
#### Corrections Techniques\r
- **Contrainte email unique** : Correction de l'erreur lors de la mise Ã\xA0 jour d'un utilisateur sans changement d'email\r
- **TypeScript** : Conversion de \`userService.js\` en \`userService.ts\` avec typage complet\r
- **CSRF multipart** : Gestion correcte du token CSRF pour les uploads de fichiers\r
\r
#### Traductions\r
- **FR/EN** : Nouvelles clÃ©s pour les champs Fonction, TÃ©lÃ©phone, et le bloc Logo dans l'Ã©diteur\r
\r
---\r
\r
## v1.5.9 - 2026-02-21\r
### ðŸŽ¯ AmÃ©lioration des Prompts LLM & Corrections Swagger\r
\r
#### Refonte des prompts par dÃ©faut\r
- **Prompt d'analyse** : Nouvelle grille d'Ã©valuation dÃ©taillÃ©e pour \`experiencesRating\` (5 critÃ¨res : LisibilitÃ©, Contexte, Livrables, ResponsabilitÃ©s, Impact)\r
- **Prompt d'amÃ©lioration** : Structure alignÃ©e sur la grille d'analyse avec prioritÃ©s de qualitÃ© explicites\r
- **Industries** : Lexique de mapping explicite avec rÃ¨gles de preuve obligatoires\r
- **Tags tools** : Ajout du type d'Ã©lÃ©ment entre parenthÃ¨ses (langage, framework, outil...)\r
\r
#### Corrections Swagger\r
- **Validation OpenAPI** : Correction du schÃ©ma \`/llm/openai\` (ajout \`items\` pour le tableau \`messages\`)\r
- **Cache dÃ©sactivÃ©** : Headers \`no-cache\` pour \`/api/docs\` et \`/api/docs/ui\`\r
- **Anti-cache frontend** : Boutons avec paramÃ¨tre \`?v=timestamp\` dans SettingsPage\r
\r
#### Corrections techniques\r
- **swagger.js** : Import de \`swaggerPaths\` dÃ©placÃ© en haut du fichier pour Ã©viter les problÃ¨mes de timing ES modules\r
\r
---\r
\r
## v1.5.8 - 2026-02-21\r
### ðŸ“š Refonte Documentation Swagger/OpenAPI & Nettoyage Terminologie\r
\r
#### Mise Ã\xA0 jour complÃ¨te du Swagger\r
- **Nouvelle architecture** : SÃ©paration en \`swagger.js\` (schÃ©mas) et \`swagger.paths.js\` (62 endpoints)\r
- **Terminologie corrigÃ©e** : Remplacement de \`customers\` par \`firms\` (alignÃ© avec la BDD)\r
- **SchÃ©mas Ã\xA0 jour** : Ajout de \`Firm\`, \`Client\`, \`ClientContact\`, \`ResumeSubmission\`, \`ResumeVersion\`, \`MailStatus\`\r
\r
#### Routes manquantes documentÃ©es\r
- **Firms** : CRUD complet \`/api/firms/*\` pour la gestion des cabinets\r
- **Clients** : CRUD \`/api/clients/*\` avec gestion des contacts\r
- **Submissions** : Historique des envois de CV \`/api/submissions/*\`\r
- **Mail** : OAuth et crÃ©ation de brouillons \`/api/mail/*\`\r
- **Resume Versions** : Gestion des versions \`/api/resumes/:id/versions/*\`\r
\r
#### Nettoyage terminologie Customer â†’ Firm\r
- **proxy-server.js** : Suppression de la route legacy \`/api/customers\`\r
- **missions.routes.js** : Suppression des alias \`Customer\`/\`Customer ID\` dans les rÃ©ponses\r
- **health.routes.js** : Correction \`customers\` â†’ \`firms\` dans les stats de cache\r
- **profileMatching.service.js** : Remplacement \`customer\` â†’ \`firm\` dans les paramÃ¨tres\r
- **MissionsPage.tsx** : Interface \`Mission.Customer\` â†’ \`Mission.Firm\`\r
- **StatsCards.tsx** : Stats \`customers\` â†’ \`firms\`\r
- **HealthIndicator.tsx** : Type et affichage \`customers\` â†’ \`firms\`\r
- **Traductions** : ClÃ© \`missions.stats.customers\` â†’ \`missions.stats.firms\` (FR/EN)\r
\r
#### Nettoyage fichiers\r
- **Suppression doublon** : Fichier \`server/docs/openapi.js\` obsolÃ¨te supprimÃ©\r
- **Import corrigÃ©** : \`docs.routes.js\` utilise maintenant \`swagger.js\`\r
\r
---\r
\r
## v1.5.7 - 2026-02-08\r
### ðŸš€ Optimisations Production & Corrections i18n\r
\r
#### Optimisation des assets statiques\r
- **Fichiers prÃ©-compressÃ©s** : Support Brotli (.br) et Gzip (.gz) pour les assets statiques\r
- **Cache agressif** : Assets hashÃ©s cachÃ©s 1 an avec \`immutable\`, HTML sans cache pour SPA\r
- **Headers optimisÃ©s** : \`Vary: Accept-Encoding\` pour compatibilitÃ© CDN\r
\r
#### Pagination CVthÃ¨que\r
- **Correction pagination** : Ajout du \`totalCount\` dans la rÃ©ponse API pour afficher toutes les pages\r
- **CohÃ©rence** : Pagination Ã\xA0 20 Ã©lÃ©ments par page (comme le reste de l'application)\r
\r
#### Corrections i18n\r
- **I18nextProvider** : Enveloppement explicite de l'application pour garantir l'initialisation\r
- **Import prioritaire** : i18n importÃ© en premier dans \`main.tsx\`\r
- **Textes de chargement** : Ajout des tableaux \`steps\` pour les animations d'analyse CV\r
\r
#### SÃ©curitÃ© API\r
- **fetchWithAuth** : Migration de tous les appels API protÃ©gÃ©s vers \`fetchWithAuth()\`\r
- **HealthIndicator** : Utilisation de \`fetchWithAuth\` pour les endpoints admin\r
- **GÃ©nÃ©ration PDF** : Tous les appels \`/generate-pdf\` utilisent maintenant \`fetchWithAuth\`\r
\r
---\r
\r
## v1.5.6 - 2026-02-07\r
### ðŸŒ Audit & Nettoyage des Traductions\r
\r
#### Script d'audit des traductions\r
- **Nouveau script** \`scripts/audit-translations.js\` : Audit complet des fichiers de traduction\r
- **DÃ©tection automatique** : Identification des clÃ©s manquantes et inutilisÃ©es\r
- **Mode fix** : Ajout automatique des clÃ©s manquantes avec \`--fix\`\r
- **Mode remove-unused** : Suppression des clÃ©s inutilisÃ©es avec \`--remove-unused\`\r
- **PrÃ©servation des clÃ©s dynamiques** : Les clÃ©s utilisÃ©es dynamiquement (ex: \`marketRadar.dataTypes.*\`, \`header.language.*\`) sont prÃ©servÃ©es\r
\r
#### Filtres dynamiques des logs de sÃ©curitÃ©\r
- **Filtres dynamiques** : Les options de filtre (level, event, source) sont maintenant chargÃ©es depuis les donnÃ©es rÃ©elles\r
- **Nouvel endpoint** \`/api/admin/security-filters\` : Retourne les valeurs uniques pour les filtres\r
- **Suppression des enums hardcodÃ©s** : Plus de validation stricte sur les valeurs de filtre\r
\r
#### Corrections des traductions\r
- **ClÃ©s manquantes ajoutÃ©es** : 18 clÃ©s ajoutÃ©es en FR et EN\r
- **Synchronisation FR/EN** : Les deux fichiers sont maintenant parfaitement synchronisÃ©s\r
- **Nettoyage** : 344 clÃ©s inutilisÃ©es supprimÃ©es\r
- **Types de donnÃ©es Market Radar** : Ajout des traductions pour \`offres\`, \`tension\`, \`dynamique_emploi\`, \`embauche\`, \`demandeur\`, \`demandeur_entrant\`\r
\r
#### Tuile Erreurs des logs de sÃ©curitÃ©\r
- **Comptage corrigÃ©** : La tuile "Erreurs" ne compte maintenant que les logs de niveau ERROR (plus SECURITY)\r
- **Normalisation** : Les niveaux de log sont normalisÃ©s en majuscules pour un comptage cohÃ©rent\r
\r
---\r
\r
## v1.5.5 - 2026-02-06\r
### ðŸŽ¯ AmÃ©liorations Matching Profils & UX\r
\r
#### Matching Profils - Corrections majeures\r
- **Fix casse status** : Correction de la comparaison case-insensitive pour les status \`analyzed\`/\`improved\` dans PostgreSQL\r
- **Tags cleaned prioritaires** : Le matching utilise maintenant les tags nettoyÃ©s (\`skills_cleaned\`, etc.) en prioritÃ© avec fallback sur les tags bruts\r
- **Affichage tous profils** : Les CVs sont maintenant tous affichÃ©s triÃ©s par pertinence, mÃªme avec un score de 0\r
- **Debug logging** : Ajout de logs pour diagnostiquer les problÃ¨mes de matching\r
\r
#### Analyse CV - ObjectivitÃ©\r
- **Analyse agnostique** : Suppression du biais qui favorisait les scores des CV amÃ©liorÃ©s\r
- **MÃªme traitement** : L'analyse LLM traite maintenant tous les CVs de maniÃ¨re identique (original ou amÃ©liorÃ©)\r
\r
#### Affichage CV amÃ©liorÃ©\r
- **Export HTML** : L'aperÃ§u dans l'onglet Exporter affiche maintenant le CV en HTML rendu\r
- **Comparaison HTML** : L'onglet Comparer affiche le CV amÃ©liorÃ© en HTML formatÃ©\r
\r
#### UX Page d'accueil\r
- **Espacement sections** : Augmentation de l'espace avant "Comment Ã§a marche" pour un affichage bloc par bloc\r
\r
---\r
\r
## v1.5.4 - 2026-02-06\r
### ðŸ—ºï¸ AmÃ©liorations UX Carte France\r
\r
#### Conservation du mÃ©tier lors du changement de rÃ©gion\r
- **Persistance de la sÃ©lection** : Le mÃ©tier sÃ©lectionnÃ© reste actif lors du changement de rÃ©gion\r
- **Rechargement automatique** : Les mÃ©tadonnÃ©es sont rechargÃ©es pour la nouvelle rÃ©gion\r
- **Mapping type corrigÃ©** : Correction du mapping \`offres\` â†’ \`offre\` pour la recherche de trends\r
\r
#### Affichage des mÃ©tadonnÃ©es amÃ©liorÃ©\r
- **En-tÃªte mÃ©tier** : Ajout du nom du mÃ©tier sÃ©lectionnÃ© en haut du panneau de mÃ©tadonnÃ©es\r
- **Affichage conditionnel** : Le panneau ne s'affiche que si les mÃ©tadonnÃ©es sont disponibles ou en chargement\r
- **Suppression message inutile** : Retrait du message "SÃ©lectionnez un mÃ©tier pour voir les dÃ©tails"\r
\r
#### Corrections de bugs\r
- **Fix layout shift** : Suppression de l'indicateur de mÃ©tier qui causait un dÃ©calage de layout\r
- **Fix hauteur panneau** : Ajout d'une hauteur maximale fixe au panneau latÃ©ral pour Ã©viter les re-layouts\r
- **Fix effet rÃ©gion** : Utilisation d'un ref pour dÃ©tecter uniquement les vrais changements de rÃ©gion\r
\r
---\r
\r
## v1.5.3 - 2026-02-06\r
### ðŸ—ºï¸ Metadata on-demand sur la Carte France\r
\r
#### Affichage des metadata de tendances\r
- **Nouvelle route API** \`/api/market-radar/trends/:id/metadata\` : Chargement on-demand des metadata\r
- **Nouveau composant** \`TrendMetadataDisplay.tsx\` : Affichage rÃ©utilisable des metadata parsÃ©es\r
- **Panneau de dÃ©tails** : AffichÃ© au clic sur un mÃ©tier dans la liste "RÃ©partition par mÃ©tier"\r
- Support des types : tension, salaire, embauche, dynamique_emploi, demandeur, offre\r
\r
#### Optimisation mÃ©moire\r
- **Cache LRU** : Maximum 50 entrÃ©es avec Ã©viction automatique des plus anciennes\r
- **Nettoyage automatique** : Cache vidÃ© au changement de type de donnÃ©es ou de rÃ©gion\r
- **Chargement lÃ©ger** : La carte ne charge que les donnÃ©es essentielles (sans metadata)\r
\r
#### AmÃ©liorations UX\r
- Metadata chargÃ©es uniquement Ã\xA0 la sÃ©lection d'un mÃ©tier (pas au hover)\r
- Indicateur de chargement pendant la rÃ©cupÃ©ration des metadata\r
- Cache local pour Ã©viter les appels API rÃ©pÃ©tÃ©s\r
\r
---\r
\r
## v1.5.2 - 2026-02-06\r
### ðŸ§\xA0 Audit mÃ©moire complet & Optimisations\r
\r
#### Gestion mÃ©moire - Audit complet\r
- **Audit mÃ©moire exhaustif** : Document \`MEMORY_AUDIT.md\` avec analyse de tous les caches\r
- **ESCO Cache** : Ajout limite 10,000 entrÃ©es, TTL 24h, cleanup automatique toutes les heures\r
- **Trends Cache** : Ajout cleanup automatique si inactif > 2Ã— TTL, fonctions \`destroy()\` et \`stats()\`\r
- **Facts Cache** : Idem avec cleanup automatique et fonctions de monitoring\r
- **MÃ©tiers Cache** : Ajout cleanup automatique et fonctions \`destroyMetiersCache()\`, \`getMetiersCacheStats()\`\r
- **Tags Cache** : Ajout TTL explicite 10 min, cleanup automatique, fonctions destroy/stats\r
- **Logger Frontend** : Ajout limite 1000 entrÃ©es, cleanup pÃ©riodique toutes les 5 minutes\r
- **File Cleanup** : Ajout \`destroyFileCleanup()\` et \`getFileCleanupStats()\` pour cohÃ©rence\r
\r
#### Graceful Shutdown\r
- **Nouveau service \`shutdown.service.js\`** : Gestion centralisÃ©e du shutdown\r
- Enregistrement de tous les handlers de cleanup\r
- Gestion des signaux SIGTERM, SIGINT et exceptions non gÃ©rÃ©es\r
\r
#### Monitoring mÃ©moire\r
- **Nouvel endpoint \`/api/health/memory\`** : Stats dÃ©taillÃ©es de tous les caches\r
- Affichage dans l'indicateur de santÃ© (header) avec dÃ©tails par cache\r
- RafraÃ®chissement dynamique des donnÃ©es au survol du tooltip\r
- Informations affichÃ©es : taille actuelle, limite max, TTL, Ã©tat GC\r
\r
#### Collecte Market Radar\r
- AmÃ©lioration de la gestion mÃ©moire dans \`collectMarketTrends()\`\r
- Logs dÃ©taillÃ©s avec usage mÃ©moire (\`heapUsedMB\`)\r
- Nettoyage explicite des variables aprÃ¨s traitement\r
- Comptage prÃ©cis (created/updated/failed/skipped) avec vÃ©rification comptable\r
\r
#### Dynamique de l'emploi (DYN_1)\r
- Correction de la collecte pour toutes les 13 rÃ©gions franÃ§aises\r
- Logs amÃ©liorÃ©s avec \`accountingMatch\` pour vÃ©rifier la cohÃ©rence\r
- Affichage enrichi dans l'UI avec tendance (hausse/baisse/stable)\r
\r
---\r
\r
## v1.5.1 - 2026-02-05\r
### ðŸ”§ Nettoyage et qualitÃ© du code\r
\r
#### Nettoyage Airtable\r
- **Suppression complÃ¨te des rÃ©fÃ©rences Airtable** : Code et dÃ©pendances\r
- Suppression de la dÃ©pendance \`airtable\` du package.json\r
- Renommage \`airtableService.ts\` â†’ \`resumeService.ts\`\r
- Mise Ã\xA0 jour des types (\`DatabaseError\` remplace \`AirtableError\`)\r
- Retrait de \`api.airtable.com\` du CSP\r
\r
#### Validation et sÃ©curitÃ©\r
- **Validation Zod sur routes LLM** : \`openaiRequestSchema\`, \`anthropicRequestSchema\`\r
- Validation du chatbot avec \`chatbotRequestSchema\`\r
- SchÃ©mas de validation pour messages LLM avec limites de taille\r
\r
#### QualitÃ© du code\r
- **Nouveau middleware \`asyncHandler\`** : Gestion d'erreurs standardisÃ©e\r
- **Helpers de routes** : \`routeHelpers.js\` avec fonctions rÃ©utilisables\r
- Health check PostgreSQL amÃ©liorÃ© avec stats dÃ©taillÃ©es (latence, taille DB, comptages)\r
- Statistiques complÃ¨tes dans \`/api/resumes/stats\` (improved count, scores moyens)\r
- Correction du format des tableaux PostgreSQL dans \`postgresHelpers.js\`\r
\r
#### Tests\r
- Nouveaux tests d'intÃ©gration pour routes health et auth\r
- 35+ tests passants\r
\r
#### Corrections\r
- Fix erreurs TypeScript (types de scores, Status as const)\r
- Fix appels logger avec trop d'arguments\r
- Migration du champ \`popular\` pour les templates\r
\r
---\r
\r
## v1.5.0 - 2026-02-05\r
### ðŸš€ Migration PostgreSQL & SÃ©curitÃ© renforcÃ©e\r
\r
#### Migration base de donnÃ©es\r
- **Migration complÃ¨te Airtable â†’ PostgreSQL** : Performance et scalabilitÃ© amÃ©liorÃ©es\r
- Nouveau schÃ©ma avec UUIDs, indexes optimisÃ©s et contraintes d'intÃ©gritÃ©\r
- Triggers de dÃ©normalisation pour synchronisation automatique des champs liÃ©s\r
- Connection pooling avec retry automatique et backoff exponentiel\r
- Support des transactions ACID pour les opÃ©rations critiques\r
\r
#### SÃ©curitÃ©\r
- **Protection SQL injection** : Whitelist des tables et validation des colonnes\r
- **Timeout rÃ©el des requÃªtes** : Utilisation de \`statement_timeout\` PostgreSQL\r
- **Masquage des donnÃ©es sensibles** dans les logs (mots de passe, tokens)\r
- Rate limiting et validation des entrÃ©es avec Zod schemas\r
\r
#### SystÃ¨me de logging amÃ©liorÃ©\r
- Nouvelle architecture de logging backend et frontend\r
- Niveaux configurables : error, warn, info, debug\r
- TraÃ§abilitÃ© par module source (\`[database]\`, \`[franceTravail]\`, etc.)\r
- Rate limiting pour Ã©viter le spam de logs\r
- Redaction automatique des champs sensibles\r
- Configuration via \`LOG_LEVEL\` et \`VITE_LOG_LEVEL\`\r
\r
#### AmÃ©liorations UI\r
- Traduction des statuts de CV (AmÃ©liorÃ©, En cours, AnalysÃ©, etc.)\r
- Codes couleur distincts pour chaque statut de CV\r
- Formatage des dates cohÃ©rent et localisÃ©\r
\r
---\r
\r
## v1.3.0 - 2026-02-03\r
### ðŸ”„ AmÃ©liorations majeures\r
#### Refonte des prompts LLM\r
 - Nouveaux prompts d'analyse et d'amÃ©lioration de CV avec instructions dÃ©taillÃ©es\r
 - RÃ¨gles anti-hallucination et anti-invention pour des rÃ©sultats plus fiables\r
 - Grilles de notation structurÃ©es pour une Ã©valuation cohÃ©rente\r
 - Extraction de tags avec validation par whitelist d'industries\r
 - Format JSON strict pour une meilleure reproductibilitÃ©\r
 - TempÃ©rature rÃ©duite Ã\xA0 0.3 pour l'amÃ©lioration (plus dÃ©terministe)\r
 - Gestion d'erreur robuste pour les rÃ©ponses LLM invalides\r
\r
#### IntÃ©gration ESCO (en cours)\r
 - PrÃ©paration de l'intÃ©gration avec le rÃ©fÃ©rentiel europÃ©en des compÃ©tences\r
 - Infrastructure de mapping des tags vers la taxonomie ESCO\r
 - Support des occupations et skill groups ICT\r
\r
#### Corrections et amÃ©liorations\r
 - Correction de l'affichage des messages d'erreur (toast avec largeur appropriÃ©e)\r
 - Correction de l'import manquant dans profileMatching.service.js\r
 - Architecture amÃ©liorÃ©e : sÃ©paration des prompts backend/frontend\r
 - Messages d'erreur utilisateur plus clairs et lisibles\r
\r
## v1.2.3 - 2026-02-01\r
### ðŸŽ¯ Nouvelle fonctionnalitÃ© majeure : Radar MarchÃ© IT/IS France\r
Page de veille complÃ¨te sur le marchÃ© du travail IT en France, permettant de suivre les tendances et opportunitÃ©s par rÃ©gion et mÃ©tier.\r
\r
#### Carte interactive de France\r
 - IntÃ©gration de MapLibre GL pour une cartographie professionnelle\r
 - Visualisation des offres d'emploi IT par rÃ©gion avec bulles proportionnelles\r
 - Popups interactifs au survol avec dÃ©tails rÃ©gionaux\r
 - Panneau de dÃ©tail par rÃ©gion avec rÃ©partition par mÃ©tier\r
 - Filtre de recherche dans la liste des mÃ©tiers\r
 - Affichage des libellÃ©s de mÃ©tiers (au lieu des codes ROME)\r
\r
#### Collecte et analyse de donnÃ©es\r
 - IntÃ©gration API France Travail (OAuth2) pour collecte d'offres d'emploi\r
 - IntÃ©gration API Adzuna pour donnÃ©es salariales et tendances\r
 - Stockage des facts dans PostgreSQL (table market_facts)\r
 - Collecte par codes ROME IT, rÃ©gions franÃ§aises et mots-clÃ©s techniques\r
 - Histogrammes de salaires et top entreprises qui recrutent\r
\r
#### Interface de consultation\r
 - Tableau de donnÃ©es dÃ©taillÃ©es avec pagination serveur\r
 - Filtres par source, mÃ©tier et rÃ©gion\r
 - Statistiques globales : offres totales, rÃ©gions couvertes, rÃ©gion #1, mÃ©tiers IT\r
\r
## v1.2.2 - 2026-02-01\r
 - Affinement des scores de matching par analyse IA des titres de CV\r
 - Navigation par URL pour les Ã©lÃ©ments individuels (/resumes/:id, /missions/:id, /adaptations/:id)\r
 - Pages dÃ©diÃ©es pour la visualisation des CVs, missions et adaptations\r
 - Mise Ã\xA0 jour du guide utilisateur (section matching profils)\r
 - Correction de la gestion des sessions expirÃ©es (erreurs JWT comme "kid_malformed")\r
 - Synchronisation front/back pour l'expiration des tokens (headers X-Token-Expires-In)\r
 - Refresh proactif du token avant expiration (5 minutes avant)\r
 - Codes d'erreur explicites pour les problÃ¨mes d'authentification (TOKEN_MISSING, TOKEN_INVALID)\r
 - Redirection automatique vers la page de connexion en cas d'expiration de session\r
 - Harmonisation de la gestion de version (source unique: package.json)\r
\r
## v1.2.1 - 2026-01-31\r
 - Analyse dÃ©taillÃ©e IA des profils pour une mission (Phase 2 du matching)\r
 - Ã‰valuation complÃ¨te : verdict, forces, lacunes, recommandations\r
 - Questions d'entretien suggÃ©rÃ©es par l'IA\r
 - Ã‰valuation du niveau de risque de recrutement\r
 - AmÃ©lioration de la gestion des erreurs frontend (messages utilisateur)\r
\r
## v1.2.0 - 2026-01-31\r
 - Nouvelle fonctionnalitÃ© : Matching Profils - Recherche des meilleurs CVs pour une mission\r
 - Extraction automatique des mots-clÃ©s de mission via IA (avec cache)\r
 - Algorithme de scoring pondÃ©rÃ© (compÃ©tences, outils, secteurs, soft skills)\r
 - Matching flou pour les variations de termes techniques\r
 - Interface dÃ©diÃ©e avec filtres avancÃ©s et pondÃ©rations personnalisables\r
 - Gestion globale des erreurs frontend avec ErrorBoundary et toasts dÃ©taillÃ©s\r
\r
## v1.1.9 - 2026-01-31\r
 - Gestion des CVs nominatifs / anonymes\r
 - Affichage des suggestions dans le formulaire d'Ã©dition du CV amÃ©liorÃ©\r
 - Mise Ã\xA0 jour du guide utilisateur\r
\r
## v1.1.8 - 2026-01-31\r
 - Unification de la logique d'analyse CV (meme processus et prompt pour l'analyse initiale et post-amelioration)\r
 - Nouveau prompt d'analyse optimise avec suggestions par section\r
 - Correction du scroll dans le header sur la page d'accueil\r
\r
## v1.1.7 - 2026-01-30\r
 - AmÃ©lioration de la prÃ©sentation de l'application\r
 - Prise en compte correcte des suggestions d'amÃ©lioration\r
 - Bug fixing et optimisations\r
\r
## v1.1.6 - 2026-01-29\r
 - SÃ©curitÃ© renforcÃ©e : blacklist JWT, rÃ©vocation tokens au logout, logs sÃ©curitÃ© persistÃ©s\r
 - FiabilitÃ© amÃ©liorÃ©e : retry avec backoff exponentiel et circuit breakers pour LLM\r
 - Documentation API Swagger, mÃ©triques persistÃ©es, types TypeScript centralisÃ©s\r
\r
## v1.1.5 - 2026-01-28\r
 - Optimisation\r
 - correction des vulnÃ©rabilitÃ©s\r
 - poursuite du refactoring\r
\r
## v1.1.4 - 2026-01-28\r
 - Corrections de bugs d'authentification (casse des propriÃ©tÃ©s utilisateur)\r
 - Corrections et optimisations diverses\r
\r
## v1.1.3 - 2026-01-28\r
 - Poursuite du refactoring\r
 - Bascule en TypeScript du front\r
 - Corrections et optimisations diverses\r
\r
## v1.1.2 - 2026-01-27\r
 - Refactoring du front et nettoyage de fichiers morts historiques\r
 - PrÃ©paration de l'application pour la production\r
 - Corrections diverses\r
\r
## v1.1.1 - 2026-01-27\r
 - AmÃ©lioration de la fonctionalitÃ© d'adaptation Ã\xA0 une offre de mission\r
 - AmÃ©lioration de la sÃ©curitÃ© et correction de fuites mÃ©moire serveur\r
 - Bugfixing\r
\r
## v1.1.0 - 2026-01-26\r
 - Proxy server refactored and memory leak fixes\r
 - Metrics page implemented\r
 - Translations fixed / implemented where missing\r
\r
## v1.0.0 - 2026-01-21\r
 - Application secured.\r
 - Added option to adapt resume to a mission\r
 - All database, LLM and file calls now go through a secure proxy server\r
\r
## v0.6.0 - 2025-06-19\r
 - LLM calls go through a proxy server. No API key is exposed anymore (security).\r
 - Added a proxy server to secure front end calls.\r
\r
## v0.5 - 2025-06-08\r
 - Resumes are now associated with customers.\r
 - Each user only sees resumes of the customer they are associated with.\r
\r
## v0.4\r
 - various ui improvements\r
 - added resume and template delete options\r
 - added a link to download original resume\r
\r
## v0.3\r
 - Switch to OpenAI GPT-4o LLM\r
 - Various UI improvements and fixes\r
 - Fixed CORS issue.\r
\r
## v0.2\r
 - Added support for sign in / sign out and registering\r
\r
## v0.1\r
 - Initial version with most features\r
`;export{e as default};
//# sourceMappingURL=CHANGELOG-L1WAlppV.js.map