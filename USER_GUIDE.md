# Guide Utilisateur - ResumeConverter

## Table des Matières

1. [Introduction](#introduction)
2. [Démarrage Rapide](#démarrage-rapide)
3. [Profil Utilisateur](#profil-utilisateur)
4. [Gestion des CV](#gestion-des-cv)
5. [Missions](#missions)
6. [Matching Profils](#matching-profils)
7. [Adaptations de CV](#adaptations-de-cv)
8. [Clients & Prospects](#clients--prospects)
9. [Envoi de CV par Email](#envoi-de-cv-par-email)
10. [Radar Marché](#radar-marché)
11. [Assistant IA](#assistant-ia)
12. [Administration](#administration)
13. [Conformité RGPD](#conformité-rgpd)
14. [Interface et Navigation](#interface-et-navigation)
15. [Bonnes Pratiques](#bonnes-pratiques)
16. [Dépannage](#dépannage)
17. [FAQ](#faq)
18. [Prochaines Étapes](#prochaines-étapes)
19. [Glossaire](#glossaire)
20. [Support](#support)

---

## Introduction

### Qu'est-ce que ResumeConverter ?

**ResumeConverter** est une plateforme de gestion et d'optimisation de CV propulsée par l'intelligence artificielle. Conçue pour les ESN et cabinets de recrutement, elle permet de :

- **Analyser** les CV avec une évaluation détaillée par IA
- **Améliorer** automatiquement la qualité et l'impact des CV
- **Adapter** les CV pour des missions ou postes spécifiques
- **Anonymiser** les CV pour protéger l'identité des candidats
- **Suivre** les performances avec des scores détaillés
- **Exporter** les CV au format PDF

### Pourquoi utiliser ResumeConverter ?

- **Gain de temps** : Automatisation de l'analyse et de l'amélioration
- **Optimisation ATS** : Compatibilité maximale avec les systèmes de recrutement
- **Personnalisation** : Adaptation intelligente pour chaque opportunité
- **Confidentialité** : Mode anonyme avec trigramme pour protéger l'identité
- **Suivi centralisé** : Gestion de tous vos CV en un seul endroit

---

## Démarrage Rapide

### Première Connexion

1. Accédez à l'application via votre navigateur
2. Connectez-vous avec vos identifiants fournis par l'administrateur
3. Découvrez le tableau de bord qui affiche vos statistiques principales

### Workflow Typique

```
1. Importer un CV → 2. Analyser → 3. Améliorer → 4. Créer une mission → 5. Adapter le CV → 6. Exporter
```

---

## Profil Utilisateur

Chaque utilisateur dispose d'un espace personnel pour gérer ses informations et paramètres de sécurité.

### Accéder à son Profil

1. Cliquez sur votre **nom** ou **avatar** en haut à droite de l'écran
2. Sélectionnez **"Mon Profil"** dans le menu déroulant

### Onglet Profil

L'onglet **Profil** permet de consulter et modifier vos informations personnelles :

| Champ | Description |
|-------|-------------|
| **Nom** | Votre nom complet |
| **Email** | Votre adresse email (identifiant de connexion) |
| **Fonction** | Votre poste (utilisé dans les signatures email) |
| **Téléphone** | Votre numéro professionnel |
| **Cabinet** | Votre cabinet de rattachement |

### Onglet Sécurité

L'onglet **Sécurité** permet de configurer l'authentification à deux facteurs (2FA).

#### Qu'est-ce que l'authentification à deux facteurs ?

L'authentification à deux facteurs (2FA) ajoute une couche de sécurité supplémentaire à votre compte. En plus de votre mot de passe, vous devrez saisir un code temporaire généré par une application d'authentification sur votre téléphone.

> **Note importante** : Le 2FA s'applique uniquement à la connexion par email/mot de passe. Si vous vous connectez via Google (OAuth2), la sécurité de votre compte Google s'applique.

#### Applications Compatibles

Vous pouvez utiliser l'une des applications suivantes :
- **Google Authenticator** (Android / iOS)
- **Microsoft Authenticator** (Android / iOS)
- **Authy** (Android / iOS / Desktop)
- Toute application compatible TOTP (RFC 6238)

#### Activer le 2FA

1. Accédez à **Mon Profil** → onglet **Sécurité**
2. Cliquez sur **"Activer 2FA"**
3. Un QR code s'affiche à l'écran
4. Ouvrez votre application d'authentification
5. Scannez le QR code avec l'application
6. Saisissez le code à 6 chiffres affiché par l'application
7. Cliquez sur **"Vérifier"**

Une fois activé, vous recevrez **8 codes de secours**. **Conservez-les précieusement** dans un endroit sûr (gestionnaire de mots de passe, coffre-fort, etc.). Ces codes vous permettront de vous connecter si vous perdez accès à votre application d'authentification.

#### Se Connecter avec le 2FA

1. Saisissez votre email et mot de passe comme d'habitude
2. Un écran de vérification 2FA s'affiche
3. Ouvrez votre application d'authentification
4. Saisissez le code à 6 chiffres affiché
5. Cliquez sur **"Vérifier"**

> **Astuce** : Les codes changent toutes les 30 secondes. Si votre code est refusé, attendez le prochain code.

#### Utiliser un Code de Secours

Si vous n'avez plus accès à votre application d'authentification :

1. Sur l'écran de vérification 2FA, saisissez l'un de vos codes de secours (8 caractères)
2. Cliquez sur **"Vérifier"**

> **Attention** : Chaque code de secours ne peut être utilisé qu'une seule fois.

#### Régénérer les Codes de Secours

Si vous avez utilisé plusieurs codes de secours ou si vous pensez qu'ils ont été compromis :

1. Accédez à **Mon Profil** → onglet **Sécurité**
2. Cliquez sur **"Régénérer les codes de secours"**
3. Saisissez un code 2FA valide pour confirmer
4. De nouveaux codes sont générés (les anciens sont invalidés)
5. **Sauvegardez immédiatement** les nouveaux codes

#### Désactiver le 2FA

1. Accédez à **Mon Profil** → onglet **Sécurité**
2. Cliquez sur **"Désactiver 2FA"**
3. Saisissez un code 2FA valide pour confirmer
4. Le 2FA est désactivé

> **Recommandation** : Nous vous conseillons de garder le 2FA activé pour une sécurité optimale de votre compte.

---

## Gestion des CV

### Importer un CV

#### Formats Supportés

- **PDF** (.pdf) - Recommandé pour la meilleure précision
- **Microsoft Word** (.docx, .doc)
- **Taille maximale** : 50 MB

#### Processus d'Import

1. Accédez à **"CVthèque"** dans le menu latéral
2. Cliquez sur le bouton **"Télécharger un nouveau CV"**
3. Glissez-déposez votre fichier ou cliquez pour sélectionner
4. **Sélectionnez le type de profil** :
   - **Collaborateur** : CV d'un salarié de votre entreprise (pas de consentement requis)
   - **Externe** : CV d'un candidat externe (consentement RGPD requis)
5. Pour les profils **externes**, remplissez le formulaire RGPD :
   - Nom du candidat
   - Email du candidat (pour l'envoi de la demande de consentement)
6. L'analyse démarre automatiquement
7. Pour les profils externes, un email de demande de consentement est envoyé au candidat

> **Note** : Pour plus de détails sur la gestion du consentement RGPD, consultez la section [Conformité RGPD](#conformité-rgpd).

#### Que se passe-t-il après l'import ?

L'IA effectue automatiquement :

1. **Extraction du texte** : Lecture du contenu du document
2. **Analyse structurelle** : Identification des sections (expérience, formation, etc.)
3. **Détection des compétences** : Extraction des compétences techniques et soft skills
4. **Évaluation multi-critères** : Attribution de scores sur 6 dimensions
5. **Génération de suggestions** : Recommandations d'amélioration

**Temps d'analyse** : 10-30 secondes selon la complexité du CV

### Comprendre les Scores

Chaque CV reçoit une évaluation détaillée sur **6 catégories** :

#### 1. Résumé Exécutif
- **Évalue** : Qualité de l'accroche, clarté de la proposition de valeur
- **Critères** : Impact, concision, pertinence

#### 2. Compétences
- **Évalue** : Présentation et pertinence des compétences
- **Critères** : Organisation, équilibre technique/soft skills, mots-clés

#### 3. Expérience Professionnelle
- **Évalue** : Clarté et impact des expériences
- **Critères** : Résultats quantifiés, verbes d'action, progression

#### 4. Formation
- **Évalue** : Présentation du parcours académique
- **Critères** : Clarté, pertinence, certifications

#### 5. Compatibilité ATS
- **Évalue** : Capacité à passer les filtres automatiques des recruteurs
- **Critères** : Mots-clés, formatage, structure

#### 6. Loisirs & Langues
- **Évalue** : Informations complémentaires
- **Critères** : Pertinence, niveau de langues

#### Score Global

Le **score global** est une moyenne pondérée des 6 catégories. Les poids peuvent être configurés par l'administrateur.

**Interprétation** :
- **80-100%** : Excellent - CV optimisé
- **60-79%** : Bon - Quelques améliorations possibles
- **40-59%** : Moyen - Améliorations recommandées
- **0-39%** : Faible - Révision nécessaire

### Consulter un CV

Cliquez sur un CV dans la liste **"CVthèque"** pour accéder à sa fiche détaillée avec plusieurs onglets :

#### Onglet Aperçu
- Scores visuels avec graphiques radar
- Informations principales (nom, titre, client)
- Tags et compétences détectés
- Actions rapides (améliorer, exporter, supprimer)

#### Onglet Compétences & Tags
- Liste complète des compétences détectées
- Catégorisation : compétences techniques, soft skills, outils, industries

#### Onglet Original
- Visualisation du texte extrait du CV original
- Métadonnées du fichier

#### Onglet Amélioré
- Version optimisée générée par l'IA
- **Éditeur riche** avec suggestions IA intégrées
- **Panneau de suggestions** : Recommandations d'amélioration par section
- Possibilité de ré-améliorer le CV avec l'IA
- Export en PDF avec choix du modèle

### Améliorer un CV

1. Ouvrez un CV analysé
2. Cliquez sur le bouton **"Améliorer le CV"**
3. L'IA génère une version optimisée avec :
   - Reformulation pour plus d'impact
   - Optimisation des mots-clés ATS
   - Mise en valeur des réalisations
   - Structure professionnelle

**Note** : En mode anonyme, le CV amélioré ne contiendra pas d'informations personnelles identifiantes.

### Éditer et Affiner un CV Amélioré

Une fois le CV amélioré généré, vous pouvez le personnaliser davantage :

#### Éditeur Riche

L'onglet Amélioré propose un **éditeur WYSIWYG** complet :
- Mise en forme du texte (gras, italique, listes)
- Modification du contenu directement
- Sauvegarde automatique des modifications

#### Suggestions IA Intégrées au Texte

Les suggestions d'amélioration sont affichées **directement au fil du texte** dans l'éditeur :

- **Indicateurs visuels** : Des marqueurs colorés signalent les passages à améliorer
- **Suggestions contextuelles** : En survolant ou cliquant sur un marqueur, la suggestion s'affiche
- **Application facile** : Cliquez pour appliquer la suggestion ou ignorez-la

Cette intégration permet de voir immédiatement où et comment améliorer le CV sans quitter le contexte du texte.

#### Panneau de Suggestions par Section

En complément, un panneau latéral regroupe les **suggestions par section** :

| Section | Type de suggestions |
|---------|---------------------|
| **Résumé** | Reformulations pour plus d'impact |
| **Compétences** | Mots-clés manquants, organisation |
| **Expérience** | Quantification des résultats, verbes d'action |
| **Formation** | Mise en valeur des certifications |
| **ATS** | Optimisations pour les filtres automatiques |

**Utiliser les suggestions** :
1. Consultez les suggestions dans le panneau latéral ou directement dans le texte
2. Cliquez sur une suggestion pour l'appliquer ou vous en inspirer
3. Modifiez manuellement le texte dans l'éditeur si nécessaire

#### Ré-améliorer avec l'IA

Si vous souhaitez une nouvelle version améliorée :
1. Cliquez sur **"Améliorer avec l'IA"** dans l'onglet Amélioré
2. L'IA génère une nouvelle version en tenant compte du contenu actuel
3. Les scores sont recalculés automatiquement

### Exporter un CV

1. Ouvrez un CV (onglet Amélioré)
2. Cliquez sur **"Exporter"**
3. Choisissez le modèle de mise en forme
4. Le fichier PDF se télécharge automatiquement

---

## Missions

### Qu'est-ce qu'une Mission ?

Une **mission** représente une opportunité professionnelle (poste, projet, contrat) pour laquelle vous souhaitez adapter des CV.

### Créer une Mission

1. Accédez à **"Missions"** dans le menu
2. Cliquez sur **"Nouvelle Mission"**
3. Remplissez le formulaire :

| Champ | Description | Obligatoire |
|-------|-------------|-------------|
| **Titre** | Intitulé du poste | Oui |
| **Client** | Entreprise cliente | Oui |
| **Description** | Description détaillée du poste | Oui |

#### Conseils pour une Description Efficace

**À inclure** :
- Description complète du poste
- Responsabilités principales
- Compétences techniques requises
- Soft skills recherchées
- Contexte de l'entreprise

**À éviter** :
- Descriptions trop courtes (< 100 mots)
- Informations vagues ou génériques

### Gérer les Missions

La page Missions affiche toutes vos opportunités avec :
- Titre et entreprise
- Nombre de CV adaptés
- Date de création
- Actions (voir, modifier, supprimer)

---

## Matching Profils

### Qu'est-ce que le Matching Profils ?

Le **Matching Profils** est une fonctionnalité puissante qui permet de trouver automatiquement les meilleurs CV de votre CVthèque pour une mission donnée. L'IA analyse les compétences requises par la mission et les compare aux profils disponibles.

### Accéder au Matching Profils

1. Accédez à **"Matching Profils"** dans le menu latéral
2. Sélectionnez une mission dans la liste déroulante
3. Cliquez sur **"Rechercher"**

### Comment fonctionne le Matching ?

#### Étape 1 : Extraction des Mots-clés

Lors de la première recherche pour une mission, l'IA extrait automatiquement les mots-clés de la description :
- **Compétences techniques** : Langages, frameworks, méthodologies
- **Outils** : Logiciels, plateformes, technologies
- **Secteurs d'activité** : Industries, domaines d'expertise
- **Soft skills** : Qualités personnelles, compétences comportementales

Ces mots-clés sont mis en cache pour accélérer les recherches suivantes.

#### Étape 2 : Scoring des Profils

Chaque CV est évalué selon 4 catégories avec des poids configurables :

| Catégorie | Poids par défaut | Description |
|-----------|------------------|-------------|
| **Compétences** | 40% | Compétences techniques |
| **Outils** | 25% | Logiciels et technologies |
| **Secteurs** | 20% | Expérience sectorielle |
| **Soft Skills** | 15% | Qualités personnelles |

Le score initial est une moyenne pondérée de ces 4 catégories.

#### Étape 3 : Affinement par le Titre du CV

L'IA analyse ensuite le **titre de poste** de chaque candidat par rapport à la mission :

- Un titre très pertinent (ex: "Lead Developer React" pour une mission React senior) peut ajouter jusqu'à **+15 points**
- Un titre peu pertinent (ex: "Chef de projet" pour une mission technique pure) peut retirer jusqu'à **-15 points**
- Un titre générique ("Consultant", "Ingénieur") a un impact neutre

Cet ajustement permet de mieux classer les candidats dont le profil correspond au poste recherché. L'ajustement est visible sur chaque carte de profil avec un badge coloré (vert = bonus, rouge = malus) et une explication.

### Personnaliser les Pondérations

1. Cliquez sur **"Options avancées"** sous le sélecteur de mission
2. Ajustez les curseurs pour chaque catégorie
3. Les poids se rééquilibrent automatiquement pour totaliser 100%
4. Relancez la recherche pour appliquer les nouvelles pondérations

### Comprendre les Résultats

#### Carte de Profil

Chaque profil trouvé affiche :
- **Nom et titre** du candidat
- **Score global** (pourcentage de correspondance)
- **Scores par catégorie** : Compétences, Outils, Secteurs, Soft Skills

#### Détails du Profil

Cliquez sur une carte pour voir les détails :

**Compétences correspondantes** (en vert) :
- Tags du CV qui correspondent aux exigences de la mission
- Organisés par catégorie (Compétences, Outils, Secteurs, Soft Skills)

**Compétences manquantes** (en rouge) :
- Tags requis par la mission mais absents du CV
- Permet d'identifier les lacunes du candidat

### Analyse Détaillée IA

Pour aller plus loin, vous pouvez demander une **analyse approfondie** par l'IA :

1. Cliquez sur **"Analyser le profil"** sur une carte de profil
2. L'IA génère un rapport complet comprenant :

| Section | Description |
|---------|-------------|
| **Verdict** | Évaluation globale (Très bon match, Bon match, etc.) |
| **Résumé** | Synthèse de l'adéquation en 2-3 phrases |
| **Points forts** | Atouts du candidat pour cette mission |
| **Lacunes** | Compétences manquantes avec niveau de criticité |
| **Recommandations** | Conseils pour le candidat ou le recruteur |
| **Questions d'entretien** | Suggestions de questions pour valider les points incertains |
| **Niveau de risque** | Évaluation du risque de recrutement |

#### Niveaux de Criticité des Lacunes

- **Critical** (rouge) : Compétence essentielle manquante
- **Important** (orange) : Compétence importante mais non bloquante
- **Minor** (jaune) : Compétence secondaire, facile à acquérir

#### Types de Recommandations

- **Highlight** (vert) : Points à mettre en avant lors de l'entretien
- **Develop** (bleu) : Compétences à développer rapidement
- **Acquire** (violet) : Formations ou certifications recommandées

### Actions Disponibles

Depuis un profil, vous pouvez :
- **Analyser le profil** : Lancer l'analyse détaillée IA
- **Voir le CV** : Accéder à la fiche complète du CV

### Actualiser les Mots-clés

Si vous modifiez la description d'une mission, cliquez sur le bouton **"Actualiser"** (icône de rafraîchissement) pour forcer l'IA à ré-extraire les mots-clés.

### Bonnes Pratiques

1. **Descriptions détaillées** : Plus la mission est détaillée, plus le matching sera précis
2. **Ajustez les poids** : Adaptez les pondérations selon l'importance relative des critères
3. **Analysez les top profils** : Utilisez l'analyse détaillée pour les 3-5 meilleurs candidats
4. **Vérifiez les lacunes** : Les compétences manquantes peuvent être des points de discussion en entretien

---

## Adaptations de CV

### Qu'est-ce qu'une Adaptation ?

Une **adaptation** est une version personnalisée d'un CV, optimisée pour une mission spécifique. L'IA analyse l'adéquation entre le profil et l'offre, puis génère un CV sur-mesure.

### Créer une Adaptation

#### Depuis un CV

1. Ouvrez un CV dans la CVthèque
2. Cliquez sur **"Adapter à une mission"**
3. Sélectionnez la mission cible
4. Cliquez sur **"Générer l'adaptation"**

#### Depuis une Mission

1. Ouvrez une mission
2. Cliquez sur **"Adapter un CV"**
3. Sélectionnez le CV à adapter
4. Cliquez sur **"Générer l'adaptation"**

### Analyse d'Adéquation

L'IA effectue une analyse en plusieurs étapes :

1. **Matching des Compétences** : Comparaison avec les compétences requises
2. **Analyse Contextuelle** : Évaluation de l'expérience pertinente
3. **Score d'Adéquation** : Note de 0 à 100

**Interprétation du score** :
- **80-100** : Excellent match
- **60-79** : Bon match
- **40-59** : Match moyen
- **0-39** : Faible match

### Contenu d'une Adaptation

- **CV Adapté** : Version personnalisée avec résumé reformulé, expériences réorganisées, compétences alignées
- **Rapport d'Analyse** : Score détaillé, points forts, axes d'amélioration

---

## Clients & Prospects

### Qu'est-ce que la Gestion Clients & Prospects ?

La fonctionnalité **Clients & Prospects** permet de gérer votre portefeuille commercial : entreprises clientes, prospects, et leurs contacts. Ces informations sont utilisées pour le suivi des envois de CV et la personnalisation des emails.

### Accéder à la Gestion Clients & Prospects

1. Accédez à **"Clients & Prospects"** dans le menu latéral
2. Visualisez la liste de vos clients et prospects avec leurs contacts

### Types d'Entreprises

| Type | Description | Icône |
|------|-------------|-------|
| **Client** | Entreprise avec laquelle vous avez une relation commerciale établie | Bleu |
| **Prospect** | Entreprise potentielle, en cours de prospection | Orange |

### Créer un Client ou Prospect

1. Cliquez sur **"Ajouter un client/prospect"**
2. Remplissez le formulaire :

| Champ | Description | Obligatoire |
|-------|-------------|-------------|
| **Nom** | Nom de l'entreprise | Oui |
| **Type** | Client ou Prospect | Oui |
| **Secteur** | Secteur d'activité (Banque, Santé, etc.) | Non |

3. Cliquez sur **"Enregistrer"**

### Gérer les Contacts

Chaque client/prospect peut avoir plusieurs contacts (interlocuteurs).

#### Ajouter un Contact

1. Ouvrez la fiche d'un client/prospect
2. Dans la section **"Contacts"**, cliquez sur **"Ajouter un contact"**
3. Remplissez les informations :

| Champ | Description | Obligatoire |
|-------|-------------|-------------|
| **Nom** | Nom complet du contact | Oui |
| **Email** | Adresse email professionnelle | Oui |
| **Fonction** | Poste occupé (DRH, Manager, etc.) | Non |
| **Téléphone** | Numéro de téléphone | Non |

#### Modifier ou Supprimer un Contact

- Cliquez sur l'icône **crayon** pour modifier
- Cliquez sur l'icône **corbeille** pour supprimer

### Historique des Envois

Pour chaque client/prospect, vous pouvez consulter l'historique des CV envoyés :

1. Ouvrez la fiche du client/prospect
2. Consultez la section **"Envois"**
3. Visualisez les CV envoyés avec la date, le contact destinataire et le statut

### Bonnes Pratiques

- **Qualifiez vos contacts** : Renseignez la fonction pour personnaliser vos emails
- **Mettez à jour régulièrement** : Supprimez les contacts obsolètes
- **Convertissez vos prospects** : Changez le type en "Client" après signature

---

## Envoi de CV par Email

### Présentation

La fonctionnalité d'**envoi de CV par email** permet de créer des brouillons d'email professionnels directement depuis l'application, avec le CV en pièce jointe. Les emails sont personnalisés grâce à des templates et des mots-clés dynamiques.

### Prérequis

1. **Connexion Gmail** : Connectez votre compte Gmail pour créer des brouillons
2. **Client/Prospect** : Créez au moins un client ou prospect avec un contact
3. **Template email** : Un template par défaut est disponible, ou créez le vôtre

### Connecter Gmail

1. Ouvrez un CV dans la CVthèque
2. Cliquez sur **"Envoyer par email"**
3. Cliquez sur **"Connecter Gmail"**
4. Autorisez l'application à accéder à votre compte Gmail
5. Une fois connecté, votre adresse email s'affiche

### Envoyer un CV

#### Étape 1 : Ouvrir le Modal d'Envoi

1. Ouvrez un CV (onglet Amélioré)
2. Cliquez sur le bouton **"Envoyer par email"** (icône enveloppe)

#### Étape 2 : Sélectionner le Destinataire

1. Choisissez un **Client ou Prospect** dans la liste déroulante
2. Sélectionnez un **Contact** parmi ceux associés au client
3. L'adresse email du contact s'affiche automatiquement

#### Étape 3 : Choisir le Template

1. Sélectionnez un **template d'email** dans la liste
2. Cliquez sur **"Prévisualiser"** pour voir le rendu avec vos données
3. Le sujet et le corps de l'email sont générés automatiquement

#### Étape 4 : Créer le Brouillon

1. Vérifiez les informations
2. Cliquez sur **"Créer le brouillon"**
3. Le brouillon est créé dans votre boîte Gmail
4. Ouvrez Gmail pour relire et envoyer l'email

### Templates Email

#### Qu'est-ce qu'un Template ?

Un **template email** est un modèle de message pré-formaté avec des mots-clés dynamiques qui sont remplacés automatiquement par les vraies valeurs lors de l'envoi.

#### Mots-clés Disponibles

| Catégorie | Mot-clé | Description |
|-----------|---------|-------------|
| **Client** | `{{client.name}}` | Nom du client/prospect |
| **Client** | `{{client.type}}` | Type (Client ou Prospect) |
| **Contact** | `{{contact.name}}` | Nom complet du contact |
| **Contact** | `{{contact.firstName}}` | Prénom du contact |
| **Contact** | `{{contact.role}}` | Fonction du contact |
| **CV** | `{{resume.name}}` | Nom du candidat |
| **CV** | `{{resume.title}}` | Titre du poste du candidat |
| **CV** | `{{resume.version}}` | Numéro de version du CV |
| **Cabinet** | `{{firm.name}}` | Nom de votre cabinet |
| **Cabinet** | `{{firm.logo}}` | Logo de votre cabinet |
| **Utilisateur** | `{{user.name}}` | Votre nom |
| **Utilisateur** | `{{user.email}}` | Votre email |
| **Utilisateur** | `{{user.jobTitle}}` | Votre fonction |
| **Utilisateur** | `{{user.phone}}` | Votre téléphone |
| **Date** | `{{date.today}}` | Date du jour (format court) |
| **Date** | `{{date.todayLong}}` | Date du jour (format long) |

#### Exemple de Template

**Sujet** : `Candidature - {{client.name}} - {{resume.title}}`

**Corps** :
```
Bonjour {{contact.firstName}},

Je me permets de vous adresser le profil de {{resume.name}}, {{resume.title}}, qui pourrait correspondre aux besoins de {{client.name}}.

Vous trouverez son CV en pièce jointe (version {{resume.version}}).

Je reste à votre entière disposition pour organiser un échange ou vous fournir des informations complémentaires.

Cordialement,

{{user.name}}
{{user.jobTitle}}
{{user.email}}
{{user.phone}}

{{date.todayLong}}
```

### Gérer les Templates (Admin)

Les administrateurs peuvent créer et gérer les templates email.

#### Accéder à la Gestion des Templates

1. Accédez à **"Templates Email"** dans le menu admin
2. Visualisez la liste des templates existants

#### Créer un Template

1. Cliquez sur **"Nouveau template"**
2. Remplissez le formulaire :

| Champ | Description |
|-------|-------------|
| **Nom** | Nom du template (ex: "Candidature standard") |
| **Sujet** | Objet de l'email avec mots-clés |
| **Contenu** | Corps de l'email avec blocs visuels |

#### Éditeur Visuel de Templates

L'éditeur propose des **blocs** pour structurer votre email :

| Bloc | Description | Utilisation |
|------|-------------|-------------|
| **Logo** | Logo de votre cabinet | En-tête de l'email |
| **En-tête** | Titre ou nom du cabinet | Identification |
| **Paragraphe** | Texte libre | Corps du message |
| **Signature** | Bloc de signature | Coordonnées de l'expéditeur |
| **Pied de page** | Informations complémentaires | Date, mentions légales |

#### Insérer des Mots-clés

1. Placez le curseur dans un bloc de texte
2. Cliquez sur l'icône **"Tag"** (étiquette)
3. Sélectionnez la catégorie (Client, Contact, CV, etc.)
4. Cliquez sur le mot-clé souhaité
5. Le mot-clé est inséré à la position du curseur

#### Retours à la Ligne

Pour ajouter des retours à la ligne dans un bloc (notamment la signature), appuyez simplement sur **Entrée** dans le textarea. Les sauts de ligne sont automatiquement convertis en `<br>` dans l'email HTML.

#### Prévisualiser un Template

1. Cliquez sur **"Prévisualiser"**
2. Le rendu HTML s'affiche avec des données d'exemple
3. Vérifiez la mise en forme et les substitutions

### Suivi des Envois

Chaque envoi de CV est enregistré dans l'historique :

- **CV envoyé** : Référence du CV
- **Destinataire** : Client/prospect et contact
- **Date** : Date et heure de l'envoi
- **Template** : Template utilisé
- **Statut** : Brouillon créé, envoyé, etc.

Consultez l'historique depuis :
- La fiche du CV (section "Envois")
- La fiche du client/prospect (section "Envois")

### Bonnes Pratiques

1. **Personnalisez vos templates** : Adaptez le ton à votre image
2. **Renseignez votre profil** : Fonction et téléphone pour une signature complète
3. **Vérifiez avant envoi** : Relisez toujours le brouillon dans Gmail
4. **Utilisez les bons mots-clés** : Évitez les mots-clés non renseignés (affichage vide)

---

## Radar Marché

### Qu'est-ce que le Radar Marché ?

Le **Radar Marché** est un outil de veille et d'analyse du marché de l'emploi IT en France. Il permet de visualiser les tendances, les salaires, les offres d'emploi et les tensions par région et par métier.

### Accéder au Radar Marché

1. Accédez à **"Radar Marché"** dans le menu latéral
2. Choisissez l'onglet souhaité : Carte, Données, Tendances ou Métiers

### Les Onglets du Radar Marché

#### Onglet Carte France

Visualisation interactive des données par région :

- **Sélection du type de données** : Tension, Salaire, Offres, Dynamique emploi, Demandeurs
- **Carte interactive** : Cliquez sur une région pour voir les détails
- **Répartition par métier** : Liste des métiers avec leurs indicateurs pour la région sélectionnée
- **Détails on-demand** : Cliquez sur un métier pour voir les métadonnées détaillées

**Types de données disponibles** :

| Type | Description |
|------|-------------|
| **Tension** | Ratio offres/demandeurs (plus c'est élevé, plus le métier est en tension) |
| **Salaire** | Salaire médian ou moyen par métier et région |
| **Offres** | Nombre d'offres d'emploi disponibles |
| **Dynamique emploi** | Évolution du nombre d'emplois |
| **Demandeurs** | Nombre de demandeurs d'emploi |

#### Onglet Données

Tableau détaillé des données marché collectées :

- **Filtres** : Source, Région, Mot-clé/Métier
- **Pagination** : Navigation dans les résultats
- **Export** : Possibilité de consulter les données brutes

#### Onglet Tendances

Analyse des tendances du marché :

- **Évolution temporelle** : Graphiques de tendances
- **Comparaison régionale** : Différences entre régions
- **Indicateurs clés** : Synthèse des métriques importantes

#### Onglet Métiers

Liste des métiers IT référencés :

- **Référentiel ROME 4.0** : Métiers officiels France Travail
- **Compétences associées** : Savoir-faire et savoir-être
- **Enjeux** : Défis et opportunités du métier

### Collecte des Données (Admin)

Les administrateurs peuvent déclencher une collecte de données :

1. Cliquez sur le bouton **"Collecter"**
2. Sélectionnez les sources à interroger
3. Attendez la fin de la collecte
4. Les nouvelles données apparaissent dans les onglets

**Sources de données** :
- France Travail (offres, demandeurs, tensions)
- Études de marché IT
- Données salariales

### Bonnes Pratiques

- **Consultez régulièrement** : Les données sont mises à jour périodiquement
- **Comparez les régions** : Identifiez les opportunités géographiques
- **Analysez les tensions** : Les métiers en tension offrent plus d'opportunités
- **Croisez avec vos CV** : Utilisez ces insights pour le matching profils

---

## Assistant IA

### Accéder à l'Assistant

L'assistant IA est disponible via le **bouton de chat** (icône de bulle) en bas à droite de l'écran.

**Note** : L'assistant peut être désactivé par un administrateur. Si vous ne voyez pas le bouton, contactez votre administrateur.

### Fonctionnalités

#### Aide Contextuelle
- Explications sur les fonctionnalités de l'application
- Guide pas-à-pas pour les tâches
- Réponses aux questions fréquentes

#### Conseils Personnalisés
- Recommandations pour améliorer vos CV
- Suggestions de compétences
- Conseils de rédaction

### Exemples de Questions

**Sur l'utilisation** :
- "Comment analyser un CV ?"
- "Comment créer une adaptation ?"
- "Comment exporter en PDF ?"

**Sur les scores** :
- "Pourquoi mon score ATS est faible ?"
- "Comment améliorer le score de compétences ?"

**Questions techniques** :
- "Quels formats de fichiers sont supportés ?"
- "Combien de temps prend l'analyse ?"

### Limitations

L'assistant est conçu pour répondre aux questions sur **ResumeConverter** uniquement. Il ne peut pas :
- Répondre à des questions hors sujet
- Donner des conseils généraux de carrière
- Rédiger des CV complets
- Accéder à vos données personnelles

---

## Administration

*Ces fonctionnalités sont réservées aux utilisateurs avec le rôle "Admin".*

### Gestion des Utilisateurs

#### Créer un Utilisateur

1. Accédez à **"Utilisateurs"** dans le menu admin
2. Cliquez sur **"Nouvel utilisateur"**
3. Remplissez le formulaire :

| Champ | Description | Obligatoire |
|-------|-------------|-------------|
| **Nom** | Nom complet de l'utilisateur | Oui |
| **Email** | Adresse email (identifiant de connexion) | Oui |
| **Mot de passe** | Mot de passe (min. 8 caractères) | Oui |
| **Fonction** | Poste occupé (ex: Consultant, Manager) | Non |
| **Téléphone** | Numéro de téléphone professionnel | Non |
| **Cabinet** | Cabinet de rattachement | Non |
| **Rôle** | User ou Admin | Oui |
| **Statut** | Actif, Inactif ou En attente | Oui |

**Note** : Les champs **Fonction** et **Téléphone** sont utilisés dans les templates email pour personnaliser la signature de l'utilisateur.

#### Rôles et Permissions

| Rôle | Permissions |
|------|-------------|
| **User** | Gérer ses CV, missions, adaptations |
| **Admin** | Toutes les permissions + gestion utilisateurs, modèles, paramètres |

### Gestion des Cabinets

Les cabinets représentent les entreprises utilisatrices de l'application.

#### Créer un Cabinet

1. Accédez à **"Utilisateurs"** dans le menu admin
2. Dans l'onglet **"Cabinets"**, cliquez sur **"Ajouter un cabinet"**
3. Remplissez le nom du cabinet
4. Cliquez sur **"Enregistrer"**

#### Ajouter un Logo

Chaque cabinet peut avoir un logo qui sera affiché dans les templates email.

1. Ouvrez la fiche d'un cabinet (icône crayon)
2. Dans la section **"Logo"**, cliquez sur **"Choisir un logo"**
3. Sélectionnez une image (JPEG, PNG, GIF, WebP ou SVG, max 2 Mo)
4. Le logo s'affiche en prévisualisation
5. Cliquez sur **"Enregistrer"**

**Utilisation** : Le logo est accessible via le mot-clé `{{firm.logo}}` dans les templates email.

### Gestion des Templates Email

Les templates email permettent de standardiser les communications avec les clients.

#### Accéder aux Templates

1. Accédez à **"Templates Email"** dans le menu admin
2. Visualisez la liste des templates par cabinet

#### Créer un Template

1. Cliquez sur **"Nouveau template"**
2. Remplissez :
   - **Nom** : Identifiant du template
   - **Sujet** : Objet de l'email (avec mots-clés)
   - **Contenu** : Corps de l'email via l'éditeur visuel

3. Utilisez l'éditeur de blocs pour structurer le contenu
4. Cliquez sur **"Enregistrer"**

#### Template par Défaut

Un template peut être défini comme **"Par défaut"** pour être pré-sélectionné lors de l'envoi d'emails.

### Gestion des Modèles de CV

Les modèles définissent la structure et le style des CV exportés.

1. Accédez à **"Modèles de CV"**
2. Créez ou modifiez un modèle avec l'éditeur HTML/CSS
3. Définissez un modèle par défaut

### Paramètres Système

#### Onglet Modèle LLM

**Choix du Modèle IA** :
- GPT-4o (OpenAI) - Recommandé
- GPT-4o-mini (OpenAI) - Plus rapide
- Claude 3.5 Sonnet (Anthropic)
- Autres modèles disponibles

**Mode CV** :
- **Nominatif** : Les CV conservent toutes les informations personnelles du candidat
- **Anonyme** : Les informations personnelles sont remplacées par un trigramme (ex: "JDU" pour Jean Dupont)

Le mode anonyme supprime automatiquement :
- Nom et prénom (remplacés par le trigramme)
- Adresses email
- Numéros de téléphone
- Liens LinkedIn, GitHub, portfolio
- Adresse postale

#### Onglet Pondération

Ajustez l'importance de chaque critère dans le score global :

| Catégorie | Poids par défaut |
|-----------|------------------|
| Résumé Exécutif | 20% |
| Compétences | 20% |
| Expérience | 20% |
| Formation | 15% |
| ATS | 15% |
| Loisirs & Langues | 10% |

#### Onglet Chatbot

Activez ou désactivez l'assistant IA pour tous les utilisateurs.

#### Onglet RGPD

Configurez l'envoi des emails de consentement RGPD :

1. **Connecter Gmail** : Autorisez l'application à envoyer des emails via votre compte Gmail
2. **Tester l'envoi** : Envoyez un email test pour vérifier la configuration
3. **Statut de connexion** : Visualisez l'état de la connexion Gmail

> **Recommandation** : Utilisez un compte Gmail dédié pour les emails RGPD (ex: `rgpd@votreentreprise.com`), différent de votre compte de connexion SSO.

Pour plus de détails, consultez la section [Conformité RGPD](#conformité-rgpd).

### Logs de Sécurité

Consultez les événements de sécurité :
- Connexions réussies et échouées
- Modifications de permissions
- Actions sensibles

### Métriques

Visualisez les statistiques d'utilisation :
- Nombre de CV analysés
- Adaptations créées
- Utilisation des tokens LLM

### Gestion des Tags

La gestion des tags permet de nettoyer et standardiser les compétences extraites des CV.

#### Accéder à la Gestion des Tags

1. Accédez à **"Tags"** dans le menu admin (Dashboard > Tags)
2. Visualisez les tags par catégorie

#### Catégories de Tags

| Catégorie | Description | Exemples |
|-----------|-------------|----------|
| **Compétences** | Savoir-faire techniques | API REST, Tests automatisés |
| **Outils** | Technologies et logiciels | Java, React, Docker |
| **Industries** | Secteurs d'activité | Banque, Santé, E-commerce |
| **Soft Skills** | Compétences comportementales | Communication, Leadership |

#### Nettoyage des Tags

Le nettoyage permet de standardiser les tags extraits :

1. Sélectionnez les CV à traiter
2. Cliquez sur **"Nettoyer les tags"**
3. L'IA normalise les tags (suppression des doublons, correction orthographique, standardisation)

**Exemple** :
- "java" → "Java"
- "React.js", "ReactJS", "React JS" → "React"

#### Mapping ESCO

L'intégration ESCO (European Skills, Competences, Qualifications and Occupations) permet d'aligner les tags sur le référentiel européen :

1. Sélectionnez les CV à traiter
2. Cliquez sur **"Mapper vers ESCO"**
3. Les tags sont associés aux compétences ESCO officielles

**Avantages** :
- Compatibilité avec France Travail
- Standardisation européenne
- Meilleure interopérabilité

### Gestion des Métiers (ROME 4.0)

Le référentiel ROME 4.0 contient les métiers officiels de France Travail.

#### Accéder aux Métiers

1. Accédez à **"Métiers"** dans le menu admin
2. Parcourez ou recherchez les métiers IT

#### Fonctionnalités

- **Recherche** : Trouvez un métier par nom ou code ROME
- **Détails** : Consultez les compétences, savoir-faire et enjeux de chaque métier
- **Collecte** : Actualisez le référentiel depuis l'API France Travail

#### Structure d'un Métier

Chaque métier contient :

| Élément | Description |
|---------|-------------|
| **Code ROME** | Identifiant unique (ex: M1805) |
| **Libellé** | Nom du métier |
| **Compétences** | Savoir-faire requis |
| **Savoirs** | Connaissances théoriques |
| **Enjeux** | Défis et évolutions du métier |

---

## Conformité RGPD

ResumeConverter intègre un système complet de gestion du consentement RGPD pour les CV de candidats externes, garantissant la conformité avec le Règlement Général sur la Protection des Données.

### Principes Fondamentaux

#### Types de Profils

L'application distingue deux types de profils lors de l'import d'un CV :

| Type | Description | Consentement requis |
|------|-------------|---------------------|
| **Collaborateur** | Salarié de votre entreprise | Non requis |
| **Externe** | Candidat externe (freelance, consultant, etc.) | **Obligatoire** |

#### Pourquoi le Consentement ?

Le RGPD impose d'obtenir le consentement explicite des personnes dont vous traitez les données personnelles. Un CV contient de nombreuses données personnelles :
- Nom, prénom, coordonnées
- Parcours professionnel
- Formation
- Compétences

### Import d'un CV Externe

#### Processus d'Import

1. **Sélection du fichier** : Glissez-déposez ou sélectionnez le CV
2. **Formulaire RGPD** : Remplissez les informations du candidat
   - **Nom du candidat** (obligatoire)
   - **Email du candidat** (obligatoire pour l'envoi de la demande)
3. **Envoi automatique** : Un email de demande de consentement est envoyé au candidat

#### Email de Consentement

L'email envoyé au candidat contient :
- L'identité de votre entreprise
- La finalité du traitement (gestion de candidature)
- Un lien pour **accepter** le consentement
- Un lien pour **refuser** le consentement
- La durée de conservation prévue

**Délai de réponse** : Le candidat dispose de **14 jours** pour répondre.

### Statuts de Consentement

Le badge RGPD affiché sur chaque CV indique son statut :

| Badge | Statut | Description |
|-------|--------|-------------|
| 🟢 **Consenti** | `active` | Le candidat a accepté le traitement de ses données |
| 🟡 **En attente** | `pending_consent` | Demande envoyée, en attente de réponse |
| 🔴 **Refusé** | `refused` | Le candidat a refusé - CV sera supprimé |
| 🟠 **Expiré** | `expired` | Délai de réponse dépassé - CV sera supprimé |
| ⚪ **Non requis** | `not_required` | CV d'un collaborateur interne |
| 🔴 **Erreur** | `error` | Échec de l'envoi de l'email |

### Badge RGPD

#### Affichage

Le badge RGPD est visible :
- Dans la **liste des CV** (CVthèque)
- Sur la page d'**analyse** du CV
- Sur la page d'**amélioration** du CV
- Sur la page d'**export** du CV

#### Tooltip Détaillé

En survolant le badge, vous accédez aux informations détaillées :
- **Nom du candidat**
- **Email du candidat**
- **Date limite de réponse** (pour les demandes en attente)
- **Date de conservation** (pour les consentements actifs)

### Gestion Automatique

#### Suppression Automatique

L'application gère automatiquement le cycle de vie des CV :

1. **Consentement refusé** : Le CV est supprimé sous 24 heures
2. **Délai expiré** : Si le candidat ne répond pas dans les 14 jours, le CV est supprimé
3. **Fin de conservation** : À l'expiration de la période de conservation (2 ans par défaut)

#### Rappels Automatiques

Un email de rappel est envoyé automatiquement si le candidat n'a pas répondu après 7 jours.

### Configuration Gmail RGPD

Pour envoyer les emails de consentement, vous devez connecter un compte Gmail.

#### Connexion

1. Accédez à **Paramètres** → **RGPD**
2. Cliquez sur **Connecter Gmail**
3. Autorisez l'application à envoyer des emails en votre nom
4. Testez l'envoi avec le bouton **Envoyer un email test**

#### Compte Dédié Recommandé

**Important** : Nous recommandons d'utiliser un compte Gmail dédié pour les emails RGPD (ex: `rgpd@votreentreprise.com`), différent de votre compte de connexion SSO, pour éviter les conflits de tokens OAuth.

#### Dépannage

Si l'envoi d'email échoue avec le statut "Erreur" :
1. Vérifiez la connexion Gmail dans **Paramètres → RGPD**
2. Si le statut indique "Reconnexion requise", cliquez sur **Reconnecter Gmail**
3. Réessayez l'envoi en cliquant sur **Renvoyer la demande** dans le badge RGPD

### Bonnes Pratiques RGPD

#### Avant l'Import

- ✅ Vérifiez que vous avez l'email correct du candidat
- ✅ Informez le candidat qu'il va recevoir une demande de consentement
- ✅ Utilisez un compte Gmail dédié pour les envois RGPD

#### Suivi des Consentements

- ✅ Consultez régulièrement les CV en attente de consentement
- ✅ Relancez manuellement si nécessaire (bouton "Renvoyer")
- ✅ N'utilisez pas un CV tant que le consentement n'est pas obtenu

#### Conservation des Données

- ✅ Respectez la durée de conservation définie (2 ans par défaut)
- ✅ Les CV sont automatiquement supprimés à expiration
- ✅ Le candidat peut demander la suppression à tout moment

### Droits des Candidats

Conformément au RGPD, les candidats disposent des droits suivants :

| Droit | Description | Mise en œuvre |
|-------|-------------|---------------|
| **Accès** | Consulter ses données | Contacter le DPO |
| **Rectification** | Corriger ses données | Contacter le DPO |
| **Effacement** | Supprimer ses données | Lien dans l'email ou contact DPO |
| **Opposition** | Refuser le traitement | Lien "Refuser" dans l'email |
| **Portabilité** | Récupérer ses données | Contacter le DPO |

### Registre des Traitements

L'application conserve un historique des actions RGPD :
- Date d'envoi de la demande de consentement
- Date de réponse du candidat
- Statut du consentement
- Date de suppression (le cas échéant)

Ces informations sont accessibles aux administrateurs pour répondre aux demandes de la CNIL.

---

## Interface et Navigation

### Thèmes Visuels

- **Mode Clair** : Interface lumineuse
- **Mode Sombre** : Interface sombre, réduit la fatigue oculaire

Cliquez sur l'icône soleil/lune dans la barre supérieure pour changer de thème.

### Langues

L'application est disponible en :
- Français
- English

Utilisez le sélecteur de langue dans la barre supérieure.

### Structure de Navigation

#### Menu Latéral

**Section Principale** :
- Accueil (tableau de bord)
- CVthèque
- Missions
- Adaptations
- Matching Profils
- Radar Marché
- Modèles de CV

**Section Admin** (si autorisé) :
- Utilisateurs
- Tags (nettoyage et ESCO)
- Métiers (ROME 4.0)
- Logs de Sécurité
- Métriques
- Paramètres

#### Barre Supérieure

- Logo : Retour à l'accueil
- Thème : Basculer clair/sombre
- Langue : FR/EN
- À propos : Informations et changelog
- Profil et déconnexion

---

## Bonnes Pratiques

### Pour des CV de Qualité

#### Avant l'Import

- Utilisez le format PDF de préférence
- Évitez les colonnes complexes et tableaux
- Assurez-vous que le texte est sélectionnable (pas un scan)
- Utilisez des polices standard

#### Structure Recommandée

1. En-tête (nom, contact)
2. Résumé professionnel
3. Expérience (ordre antichronologique)
4. Formation
5. Compétences
6. Langues et certifications

### Pour des Adaptations Efficaces

- Créez des missions avec des descriptions détaillées
- Incluez toutes les compétences requises
- Précisez le contexte de l'entreprise
- Relisez et personnalisez les adaptations générées

### Workflow Recommandé

```
1. Import du CV original
   ↓
2. Analyse automatique
   ↓
3. Amélioration par l'IA
   ↓
4. Révision manuelle si nécessaire
   ↓
5. Création de missions ciblées
   ↓
6. Génération d'adaptations
   ↓
7. Export et envoi
```

---

## Dépannage

### Problèmes Courants

#### Le CV ne s'importe pas

**Causes possibles** :
- Format non supporté (utilisez PDF ou DOCX)
- Fichier corrompu ou protégé par mot de passe
- Taille supérieure à 50 MB
- PDF scanné (image sans texte)

**Solutions** :
- Vérifiez le format du fichier
- Réexportez le CV depuis l'application d'origine
- Utilisez un PDF avec texte sélectionnable

#### L'analyse prend trop de temps

**Temps normal** : 10-30 secondes

**Si > 1 minute** :
- Rafraîchissez la page
- Vérifiez votre connexion internet
- Réessayez l'analyse

#### Les scores semblent incorrects

- Vérifiez que le CV est bien structuré
- Consultez le texte extrait (onglet Original)
- Réorganisez le CV si nécessaire et relancez l'analyse

#### Impossible de se connecter

- Vérifiez vos identifiants (email et mot de passe)
- Vérifiez que votre compte est actif
- Contactez un administrateur

#### L'export PDF ne fonctionne pas

- Vérifiez que le CV amélioré est bien généré
- Essayez un autre navigateur
- Désactivez les bloqueurs de pop-up

### Signaler un Bug

1. Notez ce que vous faisiez et le message d'erreur
2. Faites une capture d'écran si possible
3. Contactez votre administrateur

### Conseils de Performance

- Utilisez Chrome, Firefox ou Edge (versions récentes)
- Connexion internet stable
- Videz le cache si problèmes d'affichage

---

## FAQ

### Questions Générales

**Q : Combien de CV puis-je importer ?**
R : Aucune limite. Vous pouvez importer autant de CV que nécessaire.

**Q : Mes données sont-elles sécurisées ?**
R : Oui, toutes les données sont stockées de manière sécurisée et accessibles uniquement aux utilisateurs autorisés.

**Q : L'application fonctionne-t-elle hors ligne ?**
R : Non, une connexion internet est nécessaire.

### Questions sur l'Analyse

**Q : Comment l'IA analyse-t-elle les CV ?**
R : L'IA utilise des modèles de langage avancés pour extraire, analyser et évaluer le contenu selon les meilleures pratiques de recrutement.

**Q : Puis-je modifier les critères d'évaluation ?**
R : Les administrateurs peuvent ajuster les poids des catégories dans les paramètres.

**Q : Pourquoi mon score ATS est faible ?**
R : Un score ATS faible indique généralement un formatage complexe, un manque de mots-clés, ou une structure non standard.

### Questions sur le Mode Anonyme

**Q : Qu'est-ce que le mode anonyme ?**
R : Le mode anonyme remplace les informations personnelles du candidat par un trigramme (3 lettres) et supprime les coordonnées.

**Q : Comment est généré le trigramme ?**
R : Le trigramme est composé de la première lettre du prénom et des deux premières lettres du nom (ex: "JDU" pour Jean Dupont).

**Q : Puis-je basculer entre mode nominatif et anonyme ?**
R : Oui, l'administrateur peut changer le mode dans les paramètres. Le changement s'applique aux nouvelles analyses et améliorations.

### Questions sur le Chatbot

**Q : Je ne vois pas le bouton du chatbot, pourquoi ?**
R : L'assistant peut être désactivé par un administrateur. Contactez votre administrateur pour l'activer.

**Q : Les conversations sont-elles sauvegardées ?**
R : Non, les conversations sont effacées lorsque vous fermez la fenêtre de chat.

### Questions Techniques

**Q : Quels navigateurs sont supportés ?**
R : Chrome, Firefox, Safari, Edge (versions récentes).

**Q : L'application est-elle mobile-friendly ?**
R : Oui, l'interface s'adapte aux tablettes et smartphones.

---

## Prochaines Étapes

L'application ResumeConverter est en constante évolution. Voici les améliorations prévues pour les prochaines versions :

### Intégration ESCO

L'intégration du référentiel **ESCO** (European Skills, Competences, Qualifications and Occupations) est en cours de réflexion. Cette évolution permettra :

- **Compatibilité France Travail** : Utilisation de compétences alignées avec le référentiel officiel
- **Standardisation européenne** : Compétences reconnues dans toute l'Union Européenne
- **Meilleure interopérabilité** : Facilitation des échanges avec les systèmes de recrutement institutionnels

### Gestion Avancée des Compétences

Une refonte de la gestion des compétences CV est envisagée pour mieux distinguer :

- **Environnement technique** : Technologies, outils et plateformes maîtrisés (langages, frameworks, logiciels)
- **Compétences métier** : Savoir-faire et expertises fonctionnelles
- **Soft skills** : Compétences comportementales et relationnelles

Cette distinction permettra une analyse plus fine et des recommandations plus pertinentes.

### Optimisations Techniques

Des améliorations de performance sont prévues :

- **Chargement server-side** : Optimisation du chargement des données volumineuses
- **Pagination avancée** : Amélioration de la navigation dans les listes longues
- **Filtrage performant** : Filtres côté serveur pour une meilleure réactivité

### Corrections et Améliorations Continues

L'équipe travaille en permanence sur :

- **Correction de bugs** : Résolution des problèmes signalés par les utilisateurs
- **Amélioration de l'expérience utilisateur** : Interface plus intuitive et fluide
- **Nouvelles fonctionnalités** : Basées sur les retours utilisateurs

### Vos Retours Sont Précieux !

Nous encourageons vivement les utilisateurs à partager leurs remarques, critiques et suggestions d'amélioration. Chaque retour contribue à rendre l'application meilleure pour tous.

N'hésitez pas à contacter votre administrateur ou à utiliser l'assistant IA pour transmettre vos idées !

---

## Glossaire

**ATS (Applicant Tracking System)** : Système de suivi des candidatures utilisé par les recruteurs pour filtrer automatiquement les CV.

**Adaptation** : Version personnalisée d'un CV optimisée pour une mission spécifique.

**Trigramme** : Code de 3 lettres représentant un candidat en mode anonyme.

**Score d'adéquation** : Mesure (0-100) de la correspondance entre un profil et une mission.

**LLM (Large Language Model)** : Modèle d'IA de traitement du langage (GPT-4o, Claude, etc.).

**Mode Nominatif** : Mode où le CV conserve toutes les informations personnelles.

**Mode Anonyme** : Mode où les informations personnelles sont remplacées par un trigramme.

**Soft Skills** : Compétences comportementales (communication, leadership, etc.).

**Hard Skills** : Compétences techniques mesurables (programmation, langues, etc.).

**ESCO** : European Skills, Competences, Qualifications and Occupations - Référentiel européen des compétences et métiers.

**RGPD** : Règlement Général sur la Protection des Données - Réglementation européenne encadrant le traitement des données personnelles.

**Consentement RGPD** : Accord explicite d'une personne pour le traitement de ses données personnelles.

**DPO (Data Protection Officer)** : Délégué à la Protection des Données - Responsable de la conformité RGPD dans l'organisation.

**ROME** : Répertoire Opérationnel des Métiers et des Emplois - Classification française des métiers (France Travail).

**Tags Cleaned** : Tags nettoyés et standardisés par l'IA pour améliorer la précision du matching.

**Radar Marché** : Outil de veille du marché de l'emploi IT avec visualisation par région et métier.

**Tension** : Ratio entre offres d'emploi et demandeurs - indicateur de difficulté de recrutement.

**Template Email** : Modèle de message pré-formaté avec mots-clés dynamiques pour l'envoi de CV.

**MJML** : Markup language pour créer des emails HTML responsifs, utilisé par l'éditeur de templates.

**Client** : Entreprise avec laquelle une relation commerciale est établie.

**Prospect** : Entreprise potentielle, en cours de prospection commerciale.

**Cabinet** : Entreprise utilisatrice de l'application (ESN, cabinet de recrutement).

**Brouillon Gmail** : Email pré-rempli créé dans la boîte Gmail de l'utilisateur, prêt à être envoyé.

---

## Support

### Obtenir de l'Aide

1. **Assistant IA** : Disponible 24/7 via le bouton de chat
2. **Ce guide** : Documentation complète
3. **Administrateur** : Pour les questions spécifiques à votre organisation

### Ressources

- **Changelog** : Consultez les nouveautés dans "À propos"
- **Documentation API** : Swagger disponible pour les développeurs

---

**Dernière mise à jour** : Version 1.6.2 - Février 2026

**Nouveautés récentes** :
- **Conformité RGPD complète** : Gestion automatisée du consentement pour les CV externes
- **Badge RGPD** : Indicateur visuel du statut de consentement sur chaque CV
- **Envoi automatique** : Email de demande de consentement envoyé à l'import
- **Suppression automatique** : CV supprimés si consentement refusé ou expiré
- **Templates Email MJML** : Éditeur visuel de templates avec blocs (Logo, En-tête, Paragraphe, Signature, Pied de page)
- **Gestion Clients & Prospects** : Portefeuille commercial avec contacts et historique des envois
- **Envoi de CV par Email** : Création de brouillons Gmail avec CV en pièce jointe et templates personnalisés

**Versions précédentes** :
- v1.6.0 : Logo Cabinet, Profils Utilisateurs Enrichis, Mots-clés Email Étendus
- v1.5.x : Migration PostgreSQL, sécurité renforcée, logs de sécurité, Swagger/OpenAPI, prompts LLM améliorés
- v1.4.x : Radar Marché complet, gestion des Tags, référentiel ROME 4.0
- v1.3.0 : Mode CV anonyme avec trigramme, overlay de progression
- v1.2.x : Matching profils, Radar Marché France, navigation par URL

---

*Pour toute question concernant cette documentation, contactez votre administrateur système.*
