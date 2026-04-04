# Audit backend - 2026-04-04

## Synthese

Le backend est globalement bien couvert par les tests et dispose deja de plusieurs garde-fous utiles: validation d'entree sur beaucoup de routes, rate limiting, cleanup planifie, protection CSRF, signature binaire pour plusieurs uploads, et une couverture de tests server/pdf-server tres large.

Les priorites a traiter ne sont pas des details cosmetiques. Les principaux risques observes sont:

1. amplification memoire et blocage de l'event loop sur les exports batch et certaines persistances locales;
2. frontiere de securite encore poreuse autour des fichiers DOCX et du token interne du `pdf-server`;
3. hygiene incomplete des fichiers temporaires OCR et garde-fous insuffisants autour des suppressions planifiees;
4. dette structurelle importante dans quelques modules centraux, qui ralentit les corrections et augmente le risque de regression.

## Perimetre analyse

- `server/`
- `pdf-server/`
- cycle de vie des fichiers temporaires et artefacts generes
- performance et memoire
- securite applicative
- refactoring / architecture / operabilite

## Findings prioritaires

### F1 - Critique operationnelle: export batch tres couteux en memoire

- Localisation: `server/services/batchJobsWorker/exportGenerator.js:256-379`
- Constat:
  - les documents d'un batch sont generes en buffers puis stockes dans `JSZip`;
  - un second buffer complet `zipBuffer` est ensuite materialise;
  - l'ecriture finale se fait avec `fs.writeFileSync`.
- Impact:
  - double ou triple retention memoire sur les gros exports;
  - blocage de l'event loop pendant l'ecriture synchrone;
  - risque d'OOM ou de latence globale lors de batches volumineux.
- Priorite: P1
- Recommandation:
  - passer a une generation stream vers fichier;
  - limiter la taille totale d'un batch exportable;
  - remplacer les I/O synchrones par des ecritures asynchrones.

### F2 - Securite: validation DOCX insuffisante

- Localisation: `server/utils/fileSignature.js:18-20`, `server/utils/fileSignature.js:45-50`
- Constat:
  - un DOCX est considere valide des que le header ZIP est present;
  - un simple `.zip` renomme en `.docx` passe la barriere de validation.
- Impact:
  - la frontiere d'acceptation des fichiers est plus faible que ce que la documentation laisse entendre;
  - des archives non conformes peuvent atteindre des traitements plus profonds (OCR, extraction, parsing).
- Priorite: P1
- Recommandation:
  - verifier au minimum la presence de `[Content_Types].xml` et `word/document.xml`;
  - idealement ouvrir l'archive en lecture defensive et verifier la structure OOXML attendue.

### F3 - Securite: token interne du pdf-server previsible hors production

- Localisation: `pdf-server/lib/requestGuards.cjs:4-5`, `pdf-server/lib/requestGuards.cjs:44-58`, `pdf-server/server.cjs:27-33`, `pdf-server/server.cjs:217-229`
- Constat:
  - en dehors de `production`, le service accepte un token interne statique connu;
  - si un environnement de staging/dev est expose, l'endpoint interne n'est plus vraiment interne.
- Impact:
  - generation PDF/DOCX appelable par un tiers connaissant la constante;
  - contournement partiel du role de proxy/couche d'authentification.
- Priorite: P1
- Recommandation:
  - fail closed si le token manque;
  - n'autoriser un fallback que sous un flag explicite `ALLOW_INSECURE_LOCAL_PDF_TOKEN=true` combine a un bind loopback.

### F4 - Suppression planifiee: garde-fous de chemin insuffisants

- Localisation: `server/config/constants.js:94`, `server/routes/resumes/upload/helpers.js:51-57`, `server/utils/fileCleanup.js:19-36`, `server/utils/fileCleanup.js:154-183`, `server/utils/fileCleanup.js:460-480`
- Constat:
  - `UPLOAD_DIR` reste configurable par variable d'environnement;
  - les routines generiques de cleanup suppriment par age ou en masse sans verifier que le chemin resolu reste dans une racine geree.
- Impact:
  - une mauvaise configuration peut faire pointer le cleanup periodique vers un repertoire inattendu;
  - le risque est surtout operationnel, mais la consequence potentielle est severe.
- Priorite: P1
- Recommandation:
  - resoudre les chemins au demarrage;
  - valider qu'ils appartiennent a une allowlist de racines gerees;
  - refuser le demarrage si un chemin s'echappe de cette boundary.

### F5 - Hygiene temporaire OCR incomplete

- Localisation: `server/services/pdfOcrIo.service.js:62-97`, `server/services/pdfOcrIo.service.js:126-145`, `server/services/pdfTextOcrPageProcessor.service.js:205-240`, `server/utils/fileCleanup.js:222-280`
- Constat:
  - le pipeline OCR cree des fichiers et repertoires timestampes dans `os.tmpdir()`;
  - les fichiers sont souvent supprimes dans le flux nominal, mais les repertoires temporaires restent jusqu'au sweep quotidien.
- Impact:
  - fragmentation du temp systeme;
  - temps de scan plus long pour la purge journaliere;
  - accumulation silencieuse en cas de trafic OCR soutenu ou d'echecs repetes.
- Priorite: P2
- Recommandation:
  - supprimer les repertoires temporaires a la fin de chaque traitement;
  - garder le cleanup quotidien comme rattrapage, pas comme mecanisme principal.

### F6 - Performance: persistance des metriques en O(n) avec I/O synchrones

- Localisation: `server/services/metrics/persistence.js:17-25`, `server/services/metrics/persistence.js:123-149`
- Constat:
  - `appendMetricsHistory` relit tout le fichier historique, le tronque en memoire puis le reecrit entierement;
  - les acces sont synchrones.
- Impact:
  - cout croissant avec l'historique;
  - blocage inutile de l'event loop pour une tache de monitoring;
  - couplage cache entre observabilite et latence applicative.
- Priorite: P2
- Recommandation:
  - passer a un append simple;
  - compacter periodiquement;
  - ou stocker l'historique en rotation journaliere.

### F7 - Couplage architecture: le lifecycle depend d'un module de route pour gerer un cache

- Localisation: `server/config/lifecycle.js:22`, `server/routes/tags.routes.js`
- Constat:
  - `lifecycle.js` importe `invalidateTagsCache`, `destroyTagsCache` et `startTagsCacheCleanup` depuis une route.
- Impact:
  - inversion de dependance route -> infra;
  - testabilite moindre;
  - risque d'effets de bord au chargement de modules.
- Priorite: P2
- Recommandation:
  - extraire le cache tags dans un service dedie;
  - garder les routes comme simple adaptation HTTP.

### F8 - Modules surdimensionnes et responsabilites melangees

- Localisation:
  - `pdf-server/lib/docxGenerator.cjs` (1053 lignes)
  - `server/services/deals.service.js` (571 lignes)
  - `server/routes/pipeline.routes.js` (503 lignes)
  - `server/config/lifecycle.js` (406 lignes)
- Constat:
  - plusieurs modules concentrent orchestration, logique metier, I/O, logging et fallback techniques.
- Impact:
  - complexite de lecture;
  - cout de maintenance eleve;
  - surface de regression plus large a chaque modification.
- Priorite: P2
- Recommandation:
  - decouper par cas d'usage et par type de responsabilite;
  - viser des modules focalises et testables unitairement.

### F9 - Logging potentiellement trop verbeux sur les 400

- Localisation: `server/proxy-server.js:89-102`
- Constat:
  - le middleware loggue `responseBody` sur toutes les reponses 400;
  - selon la route, ce corps peut contenir des donnees fonctionnelles ou des champs saisis.
- Impact:
  - risque de fuite de donnees dans les logs;
  - volume de logs inutilement eleve.
- Priorite: P3
- Recommandation:
  - journaliser des codes d'erreur et metadonnees, pas le corps brut;
  - appliquer une redaction explicite.

### F10 - Surveillance memoire dupliquee et heuristique

- Localisation: `server/config/lifecycle.js:50-107` et `server/services/memoryMonitor.service.js`
- Constat:
  - il existe une logique de monitoring memoire dans `lifecycle.js` alors qu'un service dedie existe aussi;
  - le comportement de cleanup est base sur des seuils hardcodes.
- Impact:
  - duplication de logique;
  - strategie difficile a ajuster;
  - maintenance confuse.
- Priorite: P3
- Recommandation:
  - unifier toute la surveillance memoire dans un seul service configurable.

## Evaluation specifique: suppression planifiee des fichiers

### Points positifs

- `server/utils/fileCleanup.js` couvre plusieurs repertoires et execute aussi un cleanup au demarrage.
- les liens de partage expires sont aussi purges cote base.
- les artefacts OCR ont un sweep dedie.
- les exports batch ont un mecanisme de nettoyage DB + filesystem.

### Points a revoir en priorite

1. securiser les chemins racines geres avant toute suppression;
2. supprimer les repertoires OCR temporaires dans le flux nominal;
3. introduire des verrous simples ou un mecanisme "cleanup in progress" pour eviter les recouvrements si un cleanup dure plus que l'intervalle;
4. exposer des compteurs de taille totale par repertoire, pas seulement le nombre de fichiers supprimes;
5. documenter explicitement les SLA de retention par type d'artefact.

## Backlog de refactoring decoupe

### Workstream A - Securite fichiers et frontieres d'entree

1. Extraire un validateur OOXML strict pour DOCX.
2. Ajouter des tests unitaires pour ZIP malicieux renomme en `.docx`.
3. Centraliser la politique de validation upload dans un module unique.
4. Remplacer les checks extension/mime disperses par une politique declarative commune.
5. Rediger une matrice "type de fichier -> signature -> parser autorise".

### Workstream B - Cleanup et artefacts temporaires

1. Introduire `resolveManagedPath()` pour tous les repertoires geres.
2. Verifier au demarrage chaque repertoire de cleanup contre une allowlist.
3. Ajouter la suppression immediate des repertoires OCR vides en fin de traitement.
4. Ajouter des tests pour chemins hors boundary.
5. Ajouter un flag/metrique `cleanup_overrun` si un cycle depasse son intervalle.
6. Sortir les TTL dans une config centralisee et testee.

### Workstream C - Performance et memoire

1. Refactorer `generateJobExport` en pipeline stream.
2. Mesurer la taille totale en bytes du batch avant generation.
3. Ajouter une limite de taille ZIP finale cote worker.
4. Remplacer `writeFileSync`, `readFileSync`, `existsSync`, `statSync`, `unlinkSync` sur les chemins chauds par des equivalents async.
5. Refaire `appendMetricsHistory` en append + compaction.
6. Ajouter un test de non-regression pour gros export (memoire / temps).

### Workstream D - Architecture

1. Extraire les fonctions de cache tags hors de `tags.routes.js`.
2. Scinder `lifecycle.js` en:
   - startup runtime
   - cleanup orchestration
   - shutdown orchestration
3. Scinder `docxGenerator.cjs` en:
   - construction HTML
   - gestion artefacts temporaires
   - adaptateurs Pandoc/LibreOffice
   - post-processing OOXML
4. Scinder `pipeline.routes.js` par aggregate fonctionnel.
5. Introduire des services purs testables la ou les routes portent encore de la logique metier.

### Workstream E - Observabilite

1. Reduire la verbosite des logs 400.
2. Ajouter redaction standard pour emails, tokens, noms de fichiers sensibles.
3. Publier des compteurs de taille disque temporaire par repertoire.
4. Exposer la duree des cycles de cleanup et leur statut.
5. Standardiser les erreurs techniques vs erreurs fonctionnelles dans les logs.

## Etat des tests

Tests executes apres analyse:

- `npm test` -> OK, `185` fichiers / `2953` tests passes
- `npm run test:pdf` -> OK, `10` fichiers / `306` tests passes

Correction appliquee pendant l'audit:

- isolation des chemins de persistance des metriques pour eviter les collisions inter-tests:
  - `server/services/metrics/persistence.js`
  - `server/tests/services/metrics.persistence.test.js`

