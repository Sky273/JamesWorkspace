# Rapport QA - ResumeConverter Live

Date: 2026-05-01
Environnement: https://resumeconverter.net
Mode de test: parcours navigateur Playwright authentifie, puis parcours CRUD controle sur donnees de test.

## Addendum front-only - 2026-05-01 19:29-19:45

Mode de test: interactions exclusivement via le front navigateur, sans appel direct aux API.  
Marqueur donnees de test: `QA-FRONT-20260501172935`.  
Fichier CV teste: `C:\cvs\CV_SEHLI_Dorra_FR.pdf`.

### Parcours valides via l'interface

- Connexion utilisateur.
- Creation puis modification d'un prospect CRM.
- Creation d'une affaire CRM rattachee au prospect cree.
- Upload du CV `CV_SEHLI_Dorra_FR.pdf` depuis la CVtheque.
- Analyse du CV: le CV `SEHLI Dorra` apparait dans la CVtheque avec score `72%`.
- Ouverture de l'aperçu CV depuis la CVtheque.
- Ouverture de l'analyse complete depuis l'aperçu.
- Lancement de l'amélioration depuis l'ecran d'analyse.
- Verification du job `Amélioration`: termine a `100%`.
- Verification du resultat: ecran d'amélioration accessible, score `72%` -> `81%`, contenu améliore visible.

### Nouvelles anomalies / confirmations

### Correctifs appliques localement - 2026-05-01 20:02

- `FRONT-02`: la modale mission affiche maintenant une erreur inline en cas d'echec d'enregistrement et bloque les actions pendant la sauvegarde.
- `FRONT-03`: l'aperçu CV parse et aplatit les suggestions JSON/object en liste lisible.
- `FRONT-04`: les CV recuperes par la CVtheque passent par la normalisation commune; l'etat `improved` et le score ameliore sont deduits des alias API `improved_text` / `improved_global_rating`.
- `FRONT-01`: les extractions de texte du dernier parcours QA contiennent des accents valides; les valeurs deja persistées avec `?` ne peuvent pas etre reconstruites automatiquement sans ressaisie ou nettoyage cible des donnees live.

#### FRONT-01 - Mojibake encore visible sur les champs CRM crees depuis le front

Severite: High

Constat:
Les accents saisis dans le formulaire front CRM sont encore corrompus apres enregistrement:

- `Client modifié` apparait `Client modifi?`.
- `Affaire créée` / notes `créées` apparaissent avec `cr??e` / `cr??es`.

Impact:
La correction d'encodage doit couvrir le parcours front reel, pas seulement les payloads testes hors UI.

#### FRONT-02 - Creation de mission depuis la modale front non concluante

Severite: Medium / High a confirmer

Constat:
Depuis `/missions`, la modale `Ajouter une mission` a ete remplie avec titre, affaire, client et description, puis le bouton `Créer` a ete actionne. La modale est restee ouverte, sans creation visible de mission dans la liste et sans erreur claire visible.

Impact:
Le parcours utilisateur de creation de mission peut paraitre bloque ou silencieux. L'absence de message d'erreur rend le diagnostic difficile.

Recommandation:
Verifier le binding des champs dans la modale mission et afficher les erreurs de validation ou serveur dans la modale.

#### FRONT-03 - Aperçu CV: les ameliorations cles affichent du JSON brut

Severite: Medium

Constat:
Dans l'aperçu du CV analyse, le bloc `Améliorations clés` affiche une structure JSON brute (`{"executiveSummary":[...],"skills":[...]...}`) au lieu d'une liste formatee.

Impact:
Rendu peu lisible pour l'utilisateur et impression de donnees techniques exposees.

Recommandation:
Normaliser le rendu de `improvements`/`suggestions` avant affichage: parser les structures objet/tableau et afficher des sections lisibles.

#### FRONT-04 - CVtheque: etat de carte incoherent apres amelioration terminee

Severite: Medium

Constat:
Le job d'amélioration du CV est termine a 100% et l'ecran detail affiche `CV Amélioré`, score `81%`. En revanche, la carte CV dans la CVtheque reste badgee `ANALYSÉ`, score `72%`, et le compteur `AMÉLIORÉS` ne semble pas inclure le nouveau CV.

Impact:
L'utilisateur peut croire que l'amélioration n'a pas ete prise en compte, alors que le detail contient bien la version amélioree.

Recommandation:
Invalider/rafraichir les donnees CVtheque apres completion du job d'amélioration, et verifier la normalisation des champs `status`, `improved_score` et compteur.

### Donnees de test encore presentes

Suppression non executee a ce stade car elle touche des donnees live. Confirmation utilisateur requise avant action destructive.

- Prospect: `QA-FRONT-20260501172935 Client modifié` (affiche actuellement `modifi?`).
- Affaire: `QA-FRONT-20260501172935 Affaire créée` (affiche actuellement partiellement avec mojibake).
- CV uploadé/amélioré: `SEHLI Dorra`, upload du 1 mai 2026.
- Mission: aucune creation confirmee pour le marqueur.

## Perimetre teste

- Connexion avec un compte existant.
- Navigation principale authentifiee.
- Pages liste et tableaux de bord:
  - Accueil
  - CVtheque
  - Missions
  - Matching Profils
  - Adaptations
  - CRM / Clients & Prospects
  - Radar du Marche
  - Administration
  - Metriques
  - Parametres
  - Jobs
  - Sauvegarde
  - Logs de securite
  - Journal RGPD
  - Guide Utilisateur
- Parcours profonds non destructifs:
  - ouverture d'un CV depuis la CVtheque
  - ouverture d'une mission
  - bascule onglet Affaires dans le CRM
  - tentative d'ouverture version / changelog
- Controle console et reseau.
- Parcours CRUD live avec marqueur `QA-Codex-20260501162546`:
  - creation/modification client-prospect CRM
  - creation/modification contact
  - creation/modification affaire
  - creation/modification mission
  - association mission -> client -> affaire
  - tentative d'upload CV fournie par l'utilisateur
- Detection automatique de contrastes faibles sur les textes visibles.

Les captures et JSON temporaires generes pendant l'execution ont ete supprimes pour ne pas polluer le depot. Le present rapport conserve la synthese exploitable.

## Synthese

L'application est globalement navigable apres authentification. Les principales pages metier chargeent, les donnees principales sont visibles, et les parcours liste CV / liste missions / CRM restent accessibles.

Les points a revoir concernent surtout:

1. des contrastes encore trop faibles sur beaucoup de libelles secondaires,
2. une route morte `/crm`,
3. des erreurs console lors de parcours profonds ou de navigation rapide,
4. la modale version/changelog qui n'a pas ete verifiee comme visible au clic dans le test automatise,
5. quelques controles dont le ciblage/accessibilite peut etre renforce,
6. des erreurs serveur 500 sur certains payloads CRM/mission,
7. des problemes d'encodage UTF-8 visibles sur les textes accentues envoyes via API,
8. un blocage attendu de l'upload CV par credits insuffisants.

## Points a revoir

### QA-01 - Contrastes faibles sur de nombreux libelles secondaires

Severite: Medium

Constat:
La detection automatique remonte des ratios inferieurs aux seuils WCAG sur plusieurs pages, en particulier pour les petits libelles gris.

Pages touchees:

- `/resumes`: `AFFICHAGE`, `Par affaire`, `TOTAL CVS`, `AMELIORES`, `EN COURS`, `SCORE MOYEN`, `RESULTATS`, metadonnees de CV.
- `/missions`: `AFFICHAGE`, tuiles statistiques, etat `ACTIVE`, metadonnees.
- `/adaptations`: `AFFICHAGE`, dates.
- `/clients`: `SECTIONS`, `TYPE`, metadonnees cabinet.
- `/admin`: `RUBRIQUE`, tuiles statistiques.
- `/facts`: `SECTIONS`, source de donnees.
- `/settings`: `SECTIONS`.
- `/dashboard/security-logs`: `SECTIONS`.
- `/dashboard/backup`: `SECTIONS`.

Recommandation:
Centraliser les couleurs de texte secondaire par theme et relever les tokens gris trop faibles. Les libelles de section et de tuiles devraient viser au moins 4.5:1 pour le texte normal.

### QA-02 - Route `/crm` non reconnue

Severite: Medium

Constat:
La navigation officielle CRM pointe vers `/clients`, mais un acces direct a `/crm` produit une page vide et l'avertissement console:

`No routes matched location "/crm"`

Impact:
Risque de lien casse si des favoris, anciens liens ou documentations utilisent encore `/crm`.

Recommandation:
Ajouter une redirection `/crm -> /clients` ou conserver un alias de route.

### QA-03 - Erreurs console lors de l'ouverture d'une mission / navigation

Severite: Medium a confirmer

Constat:
Des erreurs console ont ete capturees autour du parcours mission:

- `[ResumeEntryPage] Failed to resolve resume entry route {}`
- `[API Interceptor] Fetch error`
- `Failed to fetch, url: /api/pipeline/mission/...`
- `Failed to fetch, url: /api/pipeline/stages`
- `Failed to fetch, url: /api/missions/.../adaptations`
- `[MissionPipelineKanban] Error loading data: {}`

Impact:
Ces erreurs peuvent etre dues a des requetes annulees lors d'une navigation rapide, mais elles polluent la console et peuvent masquer de vrais incidents.

Recommandation:
Verifier si les `AbortError`/navigations annulees sont journalisees comme erreurs. Si oui, les filtrer comme annulations attendues. Si non, corriger les endpoints ou les conditions de chargement.

### QA-04 - Version / changelog non confirme au clic dans le test automatise

Severite: Low / Medium

Constat:
Le bouton version est present dans l'interface, mais le test automatise n'a pas confirme l'apparition visible de `v1.9.3` ou du changelog apres clic.

Recommandation:
Verifier manuellement la modale, puis ajouter un test UI cible: clic sur le bouton `Afficher la version et le changelog`, attente d'une modale/dialogue, assertion de `v1.9.3` et d'une entree de changelog.

### QA-05 - Console bruitee sur les pages publiques non authentifiees

Severite: Low

Constat:
Sur `/welcome`, `/signin`, `/register`, `/privacy`, `/terms`, les appels initiaux `/api/auth/me` et `/api/auth/refresh` retournent `401`, ce qui apparait en erreur console.

Impact:
Fonctionnellement attendu pour un visiteur non connecte, mais cela degrade la lisibilite console et complique le diagnostic QA.

Recommandation:
Eviter de logger les `401` attendus de bootstrap session comme erreurs applicatives, ou degrader ces logs en debug silencieux cote client.

### QA-06 - Page register: alertes Trusted Types / CSP / Cloudflare

Severite: Low a confirmer

Constat:
En visite non authentifiee de `/register`, des messages console ont ete observes:

- `This document requires 'TrustedHTML' assignment. The action has been blocked.`
- `This document requires 'TrustedScript' assignment. The action has been blocked.`
- `Executing inline script violates ... script-src ...`
- `Permissions policy violation: xr-spatial-tracking is not allowed`

Impact:
Le formulaire etait visible, mais ces erreurs indiquent une incompatibilite potentielle entre CSP/Trusted Types et scripts tiers, probablement Cloudflare/Turnstile.

Recommandation:
Verifier le fonctionnement inscription complet dans un navigateur manuel. Si Turnstile fonctionne, classer le bruit console; sinon corriger la politique CSP/Trusted Types pour le script tiers attendu.

### QA-07 - Creation mission avec associations completes en une fois renvoie 500

Severite: Medium

Constat:
`POST /api/missions` avec `title`, `content`, `status`, `clientId`, `dealId`, `keywords`, `requiredSkills`, `preferredSkills` a renvoye `500 {"error":"Failed to create mission"}`.

Le meme parcours fonctionne si la mission est d'abord creee avec un payload minimal, puis associee progressivement:

- creation mission minimale: `200`
- update titre/contenu: `200`
- association au client seul: `200`
- association a l'affaire seule: `200`

Impact:
Le formulaire ou la vue detail affaire peuvent echouer selon l'ordre exact des champs envoyes, avec une erreur serveur generique au lieu d'une erreur metier exploitable.

Recommandation:
Ajouter un test backend couvrant creation mission + client + deal dans un seul payload. Corriger la cause serveur et retourner `400/403` explicite en cas d'association invalide.

### QA-08 - Textes accentues mal encodes via API CRM/mission

Severite: Medium

Constat:
Des textes envoyes en JSON avec accents ressortent mal encodes dans les reponses API et l'interface:

- `créée` devient `cr??e`
- `modifiées` devient `modifi?es`
- `modifiée` devient `modifi?e`

Endpoints observes:

- `GET /api/deals/:id`
- `GET /api/clients/:id`
- `GET /api/missions/:id`

Impact:
Perte de qualite visible sur les notes, descriptions et contenus metier; risque de degradation plus large sur les champs libres.

Recommandation:
Verifier l'encodage de bout en bout: client fetch, Express body parser, helpers SQL, colonnes PostgreSQL et sanitization. Ajouter un test d'integration avec caracteres accentues sur client/deal/mission.

### QA-09 - Upload CV bloque par credits insuffisants

Severite: Low / Expected behavior

Constat:
L'upload du fichier `Ismail-ELAISSAOUI.pdf` via `POST /api/batch-jobs` a ete refuse avec:

`402 INSUFFICIENT_CREDITS`, disponible `10`, requis `25`, `actionType: resume.upload`.

Impact:
Le blocage semble coherent avec le modele de credits. Le workflow upload n'a pas pu etre valide plus loin sans toucher aux credits ou aux parametres, ce qui etait exclu.

Recommandation:
Verifier cote UI que ce cas affiche une erreur claire et propose le parcours d'achat/credits prevu, sans laisser croire que l'upload est en cours.

### QA-10 - Suppression des donnees de test executee

Severite: Resolu

Constat:
Des donnees de test live ont ete creees pour couvrir le parcours CRUD, puis supprimees apres confirmation utilisateur.

Elements crees puis supprimes:

- Client: `8593c8bd-7944-4613-be48-58564fa9dc93`, `QA-Codex-20260501162546 Client MOD`
- Contact: `8584be85-bf61-4520-8b3c-1e55819f57bc`, `QA-Codex-20260501162546 Contact MOD`
- Affaire: `2e9cefd7-d9a2-4a68-b8ae-dc8b39bce38c`, `QA-Codex-20260501162546 Affaire MOD`
- Mission: `03d250eb-4819-4c98-9433-cac0baf29117`, `QA-Codex-20260501162546 Mission MOD`

Verification:

- `GET /api/clients/:id`: `404`
- `GET /api/deals/:id`: `404`
- `GET /api/missions/:id`: `404`
- recherches API par marqueur sur clients, deals et missions: listes vides
- verification UI sur `/clients`, `/clients?tab=deals`, `/missions`: marqueur absent

## Parcours valides

- Authentification API: `200`.
- Creation client/prospect CRM: `201`, modification: `200`.
- Creation contact client: `201`, modification: `200`.
- Creation affaire: `201`, modification: `200`.
- Creation mission minimale: `200`, modification: `200`.
- Association mission au client puis a l'affaire: `200`.
- Suppression contact, mission, affaire, client: `200`.
- Verification post-suppression API et UI: OK.
- Vue `/clients`: marqueur de test visible.
- Vue `/clients?tab=deals`: marqueur de test visible.
- Vue `/deals/:id`: affaire et mission associee visibles.
- Vue `/missions`: mission de test visible.
- `/resumes`: charge, liste 4 CV visibles.
- `/missions`: charge, une mission visible.
- `/profile-matching`: charge.
- `/adaptations`: charge.
- `/clients`: charge, onglets CRM accessibles.
- `/facts`: carte marche chargee.
- `/dashboard/metrics`: charge.
- `/settings`: charge.
- `/batch-jobs`: charge.
- `/dashboard/backup`: charge.
- `/dashboard/security-logs`: charge.
- `/dashboard/gdpr-audit`: charge.
- `/guide`: charge.
- Ouverture d'un CV depuis la CVtheque: navigation vers une route detail CV observee.
- Ouverture d'une mission: navigation vers une route detail mission observee.
- CRM onglet Affaires: contenu affiche.

## Limites du test

- Upload CV tente mais bloque par credits insuffisants; aucun CV n'a ete cree.
- Aucun partage, envoi email ou export lance volontairement.
- Pas de validation fonctionnelle de workflows longs IA/PDF.
- Les tests ont ete faits en headless; certaines erreurs console peuvent etre liees aux navigations rapides automatisees.
- Les captures locales peuvent contenir des donnees applicatives visibles du compte teste et restent dans `tmp/qa-live-crud/screenshots` jusqu'a la fin de l'analyse.
