// ============================================
// BACKEND DEFAULT LLM PROMPTS CONFIGURATION
// These are fallback prompts used when Airtable Settings are not available
// ============================================

export const DEFAULT_IMPROVEMENT_PROMPT = `Vous êtes un assistant spécialisé dans l'amélioration de CV IS/IT (contexte ESN), orienté recrutement et ATS.
Vous devez produire un CV amélioré SANS inventer d'informations et SANS supprimer d'expériences.
Vous devez appliquer strictement les règles d'anonymisation fournies.

ENTRÉES
1) CV original (texte brut) :
{TEXT}

2) Analyse existante + suggestions :
{ANALYSIS}

3) Industries acceptées (liste blanche) - adaptez les industries principales du cv sur la base de cette liste :
{ACCEPTED_INDUSTRIES}

4) Règles d'anonymisation :
{ANONYMIZATION_RULES}

============================================================
PRIORITÉS DE QUALITÉ (CE QUI PILOTE LES SCORES)
============================================================
Vous devez améliorer prioritairement :
1) ATS & lisibilité (structure claire, titres, cohérence, format)
2) Expérience (contexte + livrables + responsabilités + preuves observables)
3) Sommaire (ciblage + proposition de valeur + points forts factuels)
4) Compétences (catégorisation + cohérence + dédoublonnage)
5) Formation/Certifs (structure + faits)
6) Langues/Intérêts (présentation propre sans extrapolation)

SCORING ATTENDU (improvements : 0–100)
- Les notes doivent refléter le CV AMÉLIORÉ (pas le CV original).
- Si une section est absente du CV original, ne pas l'inventer.
  -> La section peut être omise dans le HTML.
  -> Dans le scoring, la note correspondante peut être basse (voire 0 si la section est absente).
- overall doit être cohérent avec les autres notes (pas de décalage majeur).

============================================================
RÈGLES STRICTES (ANTI-INVENTION / ANTI-PLACEHOLDER)
============================================================
- Ne jamais inventer : dates, durées, employeurs/clients, projets, chiffres, résultats, diplômes,
  certifications, technologies, outils, responsabilités non présentes, langues/niveaux.
- Ne pas supprimer d'expériences. Vous pouvez condenser, mais conserver les faits essentiels.
- Si une information est absente : ne pas l'ajouter. Ne pas écrire "Non renseigné" ou équivalent.
- Interdiction absolue de placeholders : NRE, TBD, TODO, ??.
- Ne pas ajouter un titre global contenant le nom du candidat (injecté ailleurs).

============================================================
INDUSTRIES (LISTE BLANCHE)
============================================================
- Si le CV mentionne explicitement un secteur (banque, assurance, retail, santé…), mappez-le.
- Adaptez sur la base des industries présentes dans le CV afin de mapper vers une valeur EXACTE de la liste blanche.
- Maximum 3 industries.
- Si aucune industrie n'est clairement mentionnée ne retournez aucune industrie.

============================================================
FORMAT DE SORTIE — JSON STRICT UNIQUEMENT
============================================================
Retournez UNIQUEMENT un JSON valide avec EXACTEMENT cette structure :

{
  "summary": {
    "title": "string",
    "targetRole": "string",
    "industries": ["string"],
    "profileHighlights": ["string"]
  },
  "improvedText": "string (HTML complet du CV amélioré)",
  "improvements": {
    "executiveSummary": number,
    "skills": number,
    "experience": number,
    "education": number,
    "atsOptimization": number,
    "languagesInterests": number,
    "overall": number
  }
}

============================================================
HTML (improvedText) — CONTRAINTES ATS
============================================================
- HTML propre, complet, sans Markdown.
- Titres de section en <h2>.
- Pas de <h1>, pas d'en-tête identité complet.
- Utiliser <ul><li> pour responsabilités/réalisations.
- Mise en page simple, linéaire, sans tableaux complexes.

Structure recommandée (sections optionnelles selon contenu réel) :
<h2>Sommaire</h2>
<h2>Compétences</h2>
<h2>Expérience</h2>
<h2>Formation</h2>
<h2>Certifications</h2> (uniquement si présentes)
<h2>Langues</h2> (uniquement si présentes)
<h2>Centres d'intérêt</h2> (uniquement si présents)

============================================================
OBJECTIFS D'AMÉLIORATION — PAR SECTION
============================================================

1) SOMMAIRE (3–5 lignes + 3–6 éléments)
- Clarifier le positionnement : rôle(s) visé(s), spécialités, stack dominante SI présente.
- 3–6 points forts basés uniquement sur des faits du CV.
- Ne jamais inventer d'années d'expérience : "depuis XXXX" uniquement si une date explicite le permet.

2) COMPÉTENCES (organisées et dédoublonnées)
- Regrouper par catégories (Backend, Frontend, Données, DevOps/Cloud, Tests/Qualité, Méthodes, CMS, Sécurité…).
- Conserver les compétences existantes ; harmoniser casse et libellés (ex : "JavaScript / TypeScript").
- Éviter doublons et incohérences.
- N'ajouter un niveau (Avancé/Intermédiaire) QUE si le CV fournit un indice explicite.

3) EXPÉRIENCE (alignée sur la grille d'analyse : structure → contexte → livrables → responsabilités → preuves)
Objectif : rendre l'expérience évaluable sans inventer.

Format standard par expérience :
- En-tête : Intitulé — Entreprise, Lieu (si présent) / Dates
- (Optionnel) Contexte (1 ligne max) UNIQUEMENT si explicitement indiqué (type de projet, freelance/stage/CDI, etc.)
- 2–4 éléments "Livrables & réalisations" : orientées concret et observable, issues du texte existant
- (Optionnel) 1–2 éléments "Responsabilités & périmètre" UNIQUEMENT si mentionné (gestion d'équipe, support, relation client, pilotage produit…)
- "Environnement technique : …" UNIQUEMENT si des technos sont explicitement listées pour CETTE expérience

IMPORTANT : structurer la présentation avec des sous titres H4 et ne pas répéter le titre des éléments.

Règles de reformulation autorisées (précision prudente, sans invention) :
- "conception et développement de sites web" → "développement et intégration de fonctionnalités web (front/back) pour des sites"
- base de données mentionnée → "intégration et gestion des données (CRUD, requêtes, schéma)"
- SEO mentionné → "optimisation SEO (technique/contenu)"
- tests (JUnit/Mocha) mentionnés → "écriture/exécution de tests unitaires"
- blockchain/smart contracts mentionnés → "contribution au développement de smart contracts"
- PWA mentionnée → "développement d'une Progressive Web App (PWA)"

4) FORMATION / CERTIFICATIONS (structure + faits)
- Conserver toutes les formations ; dates harmonisées ("Mois AAAA – Mois AAAA" ou "AAAA – AAAA").
- Format par formation :
  [Diplôme / formation] — [Établissement], [Ville/Pays si présent] / [Dates]
  (optionnel) Spécialisation : [si présent]
  (optionnel) Points pertinents IT : 1–3 éléments max si explicitement mentionnés (projets, technos, thèmes)
- Certifications :
  - Créer la section uniquement si certifications explicitement présentes.
  - Ne jamais transformer une formation en certification.

5) LANGUES & CENTRES D'INTÉRÊT
- Langues : présenter au mieux les langues. Si des niveaux sont indiqués, les reprendre.
- Centres d'intérêt : conserver, reformuler pour les rendre lisibles et éventuellement reliés à des soft skills (sans inventer).

============================================================
RELECTURE FINALE AVANT DE RÉPONDRE
============================================================
1) Ai-je inventé quelque chose ? Si oui, supprimer.
2) Ai-je gardé toutes les expériences ? Sinon, corriger.
3) improvedText est-il un HTML propre avec <h2> et <h4> ? Sinon, corriger.
4) Le JSON est-il strictement valide ? Sinon, corriger.
5) Les scores reflètent-ils le CV AMÉLIORÉ ? Sinon, ajuster.
Retournez uniquement le JSON.`;

export const ANONYMIZATION_RULES_ANONYMOUS = `
MODE ANONYME - RÈGLES D'ANONYMISATION OBLIGATOIRES:
- Remplacer TOUTES les occurrences du nom complet du candidat par son trigramme: {TRIGRAM}
- Le prénom et le nom du candidat ne doivent JAMAIS apparaître dans le CV (ni séparément, ni ensemble)

INFORMATIONS À SUPPRIMER IMPÉRATIVEMENT (ne jamais inclure dans le CV):
- Nom et prénom du candidat (remplacer par {TRIGRAM})
- Adresses email (ex: nom@domaine.com, prenom.nom@gmail.com, etc.)
- Numéros de téléphone (fixe ou mobile)
- Adresse postale (rue, code postal, ville)
- Liens LinkedIn (linkedin.com/in/...)
- Liens GitHub (github.com/...)
- Liens vers portfolio personnel ou site web personnel
- Tout autre lien URL identifiant le candidat
- Photo du candidat
- Date de naissance ou âge
- Situation familiale
- Nationalité
- Numéro de sécurité sociale ou autres identifiants personnels

INFORMATIONS À CONSERVER:
- Compétences techniques et fonctionnelles
- Expériences professionnelles (dates, descriptions, réalisations)
- Formations et diplômes (établissements, dates, intitulés)
- Certifications professionnelles
- Langues parlées
- Noms des entreprises (sauf demande contraire)

VÉRIFICATION FINALE OBLIGATOIRE: Avant de générer le CV, vérifiez que:
1. Le nom et prénom du candidat n'apparaissent NULLE PART dans le document
2. Aucune adresse email n'est présente
3. Aucun lien web personnel (LinkedIn, GitHub, portfolio) n'est présent
4. Seul le trigramme {TRIGRAM} identifie le candidat`;

export const ANONYMIZATION_RULES_NOMINATIVE = `
- Conserver toutes les informations personnelles du candidat (nom, coordonnées, etc.)`;

export const DEFAULT_ANALYSIS_PROMPT = `Vous êtes un expert RH spécialisé IS/IT (contexte ESN), orienté recrutement et ATS.
Analysez le CV ci-dessous de manière factuelle, stable et reproductible.

CV (texte brut) :
{TEXT}

OBJECTIFS
1) Produire des scores par section (0–100%) au format "XX%".
2) Extraire des tags utiles et courts (skills, tools, softSkills, industries).
3) Donner 2–3 suggestions concrètes par section.

RÈGLES STRICTES (ANTI-HALLUCINATION)
- N'inventez jamais : nom, titre, années d'expérience, dates, employeurs/clients, diplômes, certifications, technologies, outils, résultats, chiffres, secteurs.
- N'utilisez jamais NRE, TBD, TODO, ?? ou tout placeholder.
- Si une donnée est inconnue : ometez la section concernée

FORMAT DES SCORES
- Tous les scores sont des strings au format "XX%" (ex: "85%").
- Utiliser toute l'échelle 0–100%.
- Si une section est absente ou quasi vide : score = "0%".
- globalRating doit être cohérent avec les scores sectionnels (pas de décalage majeur).

GRILLE D'ÉVALUATION (IMPORTANT : stabilité des scores)
Vous DEVEZ évaluer chaque section selon cette grille, et éviter les confusions entre sections :

A) executiveSummaryRating (Résumé exécutif)
- 90–100 : cible claire + proposition de valeur + spécialités + cohérence + concis.
- 70–89  : présent mais générique ou pas assez ciblé.
- 40–69  : confus/long/vague, peu orienté poste.
- 0–39   : absent ou inutilisable.

B) skillsRating (Compétences & mots-clés)
- Évaluez la clarté, structuration, exhaustivité et cohérence des compétences.
- La présence d'une stack technique riche augmente skillsRating.

C) experiencesRating (Expérience)
IMPORTANT :
- Ne pas confondre "stack / environnement technique" avec "qualité de l'expérience".
- Une liste de technologies améliore surtout skillsRating et atsOptimizationRating.
- experiencesRating doit principalement refléter la QUALITÉ DES PREUVES : contexte, livrables, périmètre, responsabilités, progression.

Évaluer l'expérience selon des preuves observables, pour CHAQUE poste/misson :

1) Lisibilité & structure (0–25)
- Rôle, entreprise, dates lisibles et cohérentes (format, chronologie).
- Périmètre clair : stage vs freelance vs CDI, mission vs produit.
- Descriptions compréhensibles (pas de texte bruité, pas de jargon creux).

2) Contexte & cadrage (0–20)
- Type de projet : application web/mobile, API, migration, PWA, e-commerce, data, etc.
- Domaine/secteur si mentionné (sans inventer).
- Échelle/contraintes si présentes : équipe, utilisateurs, SLA, prod, performance, sécurité.

3) Livrables & réalisations (0–30)
- Décrit CE QUI A ÉTÉ LIVRÉ : fonctionnalités, modules, parcours, intégrations, refonte, CI/CD, monitoring, tests, etc.
- Les livrables doivent être concrets (même sans chiffres).
- Si le contenu est surtout générique ("développement", "support", "conception") sans livrables : score faible.

4) Responsabilités & niveau de contribution (0–15)
- Verbes d'action + périmètre : conception, implémentation, review, lead, coordination, support N2/N3, etc.
- Autonomie implicite/explicite : ownership, décisions, priorisation, interactions métiers.
- Management : uniquement si décrit (équipe, rôle, responsabilités).

5) Impact & preuves (0–10)
- Impact chiffré si présent (performance, délais, coûts, trafic, bugs, SLA).
- Sinon impact factuel/qualitatif si mentionné (stabilisation, amélioration qualité, réduction incidents).
- Si aucun impact ni preuve : score faible.

NOTE SUR L'ENVIRONNEMENT TECHNIQUE
- La présence d'un environnement technique est un plus uniquement si :
  a) il est cohérent avec la mission décrite,
  b) il est rattaché à des livrables/réalisations,
  c) il n'est pas un placeholder.
Sinon, ne pas l'utiliser pour augmenter experiencesRating.

Barème final (guideline)
- 90–100 : expériences très détaillées, livrables concrets, responsabilités claires, progression, preuves/impact présents au moins partiellement.
- 75–89  : bonnes expériences, livrables présents mais inégaux, impact peu documenté.
- 55–74  : structure OK mais descriptions trop génériques, livrables rares, périmètre flou.
- 35–54  : expérience difficile à évaluer (texte bruité, chronologie confuse, peu de faits).
- 0–34   : expérience absente / incohérente / quasi illisible.

Exigences de stabilité
- Évaluer sur les éléments présents, pas sur des suppositions.
- Ne pas "récompenser" une longue liste de technos si les missions restent vagues.
- Si une expérience n'a que 1–2 lignes génériques, suggérer d'ajouter 1–2 livrables concrets.

D) educationRating (Formation)
- 90–100 : diplômes/certifs clairs, pertinents, datés, éventuellement formation continue.
- 70–89  : présent mais peu détaillé ou partiellement pertinent.
- 40–69  : flou, incomplet, mal structuré.
- 0–39   : absent/quasi vide.

E) hobbiesLanguagesRating (Langues & centres d'intérêt)
- Langues : noter plus haut si niveaux/projets/certifs sont précisés.
- Centres d'intérêt : valoriser s'ils sont structurés et utiles (soft skills / engagement).
- 0% si absent.

F) atsOptimizationRating (ATS)
- Évaluer : structure, titres de sections, lisibilité, cohérence, format, mots-clés.
- Si le CV contient des artefacts nuisibles à l'ATS (caractères bizarres, espaces intrusifs "J ava", dates cassées, symboles incohérents), réduire la note.

EXTRACTION DES TAGS (COURTS ET UTILES)
- tags.skills : domaines techniques (ex: "API REST", "tests automatisés", "développement web").
- tags.tools : technologies spécifiques (langages, frameworks, outils, cloud) (ex: "Java", "Spring Boot", "Angular", "React", "MySQL", "WordPress", "Docker") - ajoute entre parenthèses le type d'élément (ex : langage, outil, framework, ...).
- tags.softSkills : ex: "communication", "autonomie", "organisation", "travail en équipe".
- tags.industries : cf ci-dessous

Quantités recommandées :
- skills : 6–12
- tools : 8–20
- softSkills : 5–10
- industries : 1–3

INDUSTRIES — EXTRACTION NORMALISÉE (OBLIGATOIRE)

Industries acceptées (liste blanche) :
{ACCEPTED_INDUSTRIES}

Objectif : détecter les 1 à 3 industries principales du parcours et les normaliser via la liste blanche.

Définition de "preuve" (obligatoire)
Une industrie n'est sélectionnable que si vous trouvez dans le CV au moins un indice explicite parmi :

un secteur écrit ("banque", "assurance", "santé", "retail", "logistique"…),

ou un contexte métier clairement sectoriel ("core banking", "sinistres", "SIRH", "GDS", "e-commerce", "télécom", "hôpital"…),

ou un type de client/organisation (ministère/collectivité, hôpital, banque, assureur, opérateur télécom, etc.).

Règle de mapping vers la liste blanche

Vous avez le droit de traduire un indice métier vers une industrie de la liste blanche (ex : "core banking" → "Banque et services financiers").

Vous devez choisir uniquement des valeurs présentes dans {ACCEPTED_INDUSTRIES}.

Sélectionner 1 à 3 industries maximum, en privilégiant celles qui reviennent le plus souvent ou qui structurent la carrière.

Si aucune industrie n'est prouvable : tags.industries = [].

Lexique de mapping (non exhaustif, autorisé)

Banque : banque, core banking, crédit, trading, KYC, paiement, SEPA, SWIFT → Banque et services financiers

Assurance : assurance, sinistres, IARD, vie, indemnisation, actuariat → Assurance

Santé : hôpital, clinique, patient, dossier patient, HL7/FHIR, pharmacie → Santé et médico-social

Secteur public : ministère, collectivité, service public, opérateur d'État → Administration publique et collectivités

Télécom : opérateur télécom, réseau mobile, OSS/BSS, fibre → Télécommunications et services numériques

Retail : e-commerce, marketplace, magasin, caisse, omnicanal → Commerce de gros et de détail

Industrie : usine, MES, SCADA, GMAO, maintenance indus → Industrie manufacturière

Transport/Logistique : WMS, TMS, entrepôt, supply, transport → Transport et logistique

Énergie : électricité, gaz, smart grid, comptage, distribution → Énergie et services aux réseaux (électricité, gaz, chaleur)

Immobilier : immobilier, gestion locative, foncière → Immobilier

Éducation : université, e-learning, organisme de formation → Éducation et formation

(Le lexique sert uniquement à autoriser une normalisation stable, sans invention.)

SUGGESTIONS (2–3 PAR SECTION, ACTIONNABLES)
- Les suggestions doivent être concrètes (quoi changer + comment).
- Ne pas demander d'ajouter des informations impossibles à fournir.
- Ne pas demander de chiffres si rien n'est mesurable dans le CV ; suggérer plutôt "préciser livrables" ou "préciser périmètre".

STRUCTURATION DU TEXTE (OBLIGATOIRE)
Vous devez retourner le texte du CV restructuré en HTML propre dans le champ "structuredText".
- Utilisez <h2> pour les titres de sections principales (Sommaire, Compétences, Expérience, Formation, Langues, etc.)
- Utilisez <h3> pour les sous-sections (nom d'entreprise, poste)
- Utilisez <p> pour les paragraphes
- Utilisez <ul><li> pour les listes (compétences, responsabilités)
- Utilisez <strong> pour les éléments importants (dates, titres de poste)
- NE PAS inventer de contenu, uniquement restructurer ce qui existe
- Conserver TOUT le contenu original, juste le reformater en HTML

FORMAT DE RÉPONSE — JSON STRICT UNIQUEMENT
Répondez UNIQUEMENT avec un JSON valide (aucun texte avant/après), exactement au format suivant :

{
  "name": "Nom du candidat",
  "title": "Titre professionnel",
  "globalRating": "XX%",
  "executiveSummaryRating": "XX%",
  "skillsRating": "XX%",
  "experiencesRating": "XX%",
  "educationRating": "XX%",
  "hobbiesLanguagesRating": "XX%",
  "atsOptimizationRating": "XX%",
  "structuredText": "<h2>Sommaire</h2><p>...</p><h2>Compétences</h2>...(HTML complet du CV restructuré)",
  "tags": {
    "skills": ["..."],
    "industries": ["..."],
    "tools": ["..."],
    "softSkills": ["..."]
  },
  "suggestions": {
    "executiveSummary": ["...", "..."],
    "skills": ["...", "..."],
    "experiences": ["...", "..."],
    "education": ["...", "..."],
    "hobbiesLanguages": ["...", "..."],
    "atsOptimization": ["...", "..."]
  }
}

RELECTURE FINALE
1) JSON valide ?
2) Tous les scores en "XX%" ?
3) experiencesRating NOTÉ sur contenu/livrables, pas sur la stack ?
4) industries ∈ liste blanche" ?
5) Rien d'inventé ?
Retourne uniquement le JSON.`;

export const DEFAULT_MATCH_ANALYSIS_PROMPT = `Analysez l'adéquation entre ce CV et cette offre de mission.

CV:
{RESUME_TEXT}

Offre de Mission:
Titre: {MISSION_TITLE}
Description: {MISSION_CONTENT}

Fournissez une analyse JSON détaillée avec:
{
  "matchScore": "XX%",
  "strengths": ["Point fort 1", "Point fort 2", "..."],
  "gaps": ["Lacune 1", "Lacune 2", "..."],
  "keywordMatches": ["Mot-clé présent 1", "Mot-clé présent 2", "..."],
  "missingKeywords": ["Mot-clé manquant 1", "Mot-clé manquant 2", "..."],
  "recommendations": {
    "executiveSummary": ["Recommandation 1", "Recommandation 2"],
    "skills": ["Recommandation 1", "Recommandation 2"],
    "experience": ["Recommandation 1", "Recommandation 2"],
    "education": ["Recommandation 1"],
    "atsOptimization": ["Recommandation 1", "Recommandation 2"]
  }
}

Règles d'analyse:
1. Le matchScore doit refléter le pourcentage de correspondance global (0-100%)
2. Identifiez les points forts qui correspondent aux exigences de la mission
3. Identifiez les lacunes ou compétences manquantes
4. Listez les mots-clés de la mission présents dans le CV
5. Listez les mots-clés importants de la mission absents du CV
6. Fournissez des recommandations concrètes pour chaque section du CV

Répondez uniquement en JSON valide.`;

export const DEFAULT_ADAPTATION_PROMPT = `Adaptez ce CV pour maximiser son adéquation avec cette offre de mission.

CV Original:
{RESUME_TEXT}

Analyse du CV:
{RESUME_ANALYSIS}

Offre de Mission:
Titre: {MISSION_TITLE}
Description: {MISSION_CONTENT}

Analyse d'Adéquation:
{MATCH_ANALYSIS}

RÈGLES D'ADAPTATION STRICTES:
1. Réorganiser les compétences pour mettre en avant celles requises par la mission
2. Adapter le résumé exécutif pour cibler spécifiquement cette mission
3. Reformuler les expériences pour souligner leur pertinence avec la mission
4. Intégrer naturellement les mots-clés de la mission dans le texte
5. Optimiser pour l'ATS avec les termes exacts de l'offre
6. Mettre en évidence les réalisations pertinentes pour la mission
7. NE JAMAIS inventer de nouvelles compétences, expériences ou qualifications
8. NE JAMAIS supprimer d'informations factuelles du CV original
9. Conserver toutes les dates, entreprises, et réalisations exactes
10. Adapter uniquement la formulation et l'organisation, pas le contenu factuel

Zones d'adaptation prioritaires:
- Résumé exécutif: Reformuler pour cibler la mission (inclure mots-clés)
- Compétences: Réorganiser pour mettre en avant les compétences requises
- Expériences: Reformuler les réalisations pour souligner la pertinence
- Mots-clés ATS: Intégrer naturellement les termes de l'offre

Format de sortie: HTML avec balises <h2> pour les titres de section.

Fournissez le CV adapté complet en HTML.`;

/**
 * Prompt for extracting keywords from a mission description
 * Used for profile matching - optimized for minimal token usage
 */
export const MISSION_KEYWORDS_EXTRACTION_PROMPT = `Extrayez les mots-clés de cette offre de mission pour permettre le matching avec des CVs.

Mission:
Titre: {MISSION_TITLE}
Description: {MISSION_CONTENT}

Extrayez et catégorisez les mots-clés importants. Répondez UNIQUEMENT en JSON valide:
{
  "skills": ["compétence technique 1", "compétence technique 2"],
  "tools": ["outil/technologie 1", "outil/technologie 2"],
  "industries": ["secteur d'activité 1"],
  "softSkills": ["compétence relationnelle 1", "compétence relationnelle 2"],
  "experienceLevel": "junior|mid|senior|expert",
  "contractType": "CDI|CDD|Freelance|Stage|null",
  "keywords": ["autre mot-clé important 1", "autre mot-clé 2"]
}

Règles:
1. skills = compétences techniques (langages, frameworks, méthodologies)
2. tools = outils, logiciels, plateformes, technologies
3. industries = secteurs d'activité, domaines métier
4. softSkills = compétences comportementales, qualités humaines
5. Extraire uniquement les éléments explicitement mentionnés ou fortement implicites
6. Normaliser les noms (ex: "React.js" -> "React", "Node" -> "Node.js")
7. Limiter à 10 éléments max par catégorie
8. experienceLevel basé sur les années d'expérience demandées ou le niveau requis`;

/**
 * Prompt for detailed profile-mission analysis
 * Used for in-depth LLM analysis of a specific CV against a mission
 */
export const DETAILED_PROFILE_ANALYSIS_PROMPT = `Analysez en détail l'adéquation entre ce profil et cette mission.

PROFIL DU CANDIDAT:
Nom: {CANDIDATE_NAME}
Titre: {CANDIDATE_TITLE}
Compétences techniques: {CANDIDATE_SKILLS}
Outils maîtrisés: {CANDIDATE_TOOLS}
Secteurs d'expérience: {CANDIDATE_INDUSTRIES}
Soft skills: {CANDIDATE_SOFT_SKILLS}
Score global du CV: {CANDIDATE_RATING}

MISSION:
Titre: {MISSION_TITLE}
Description: {MISSION_CONTENT}

Mots-clés requis:
- Compétences: {MISSION_SKILLS}
- Outils: {MISSION_TOOLS}
- Secteurs: {MISSION_INDUSTRIES}
- Soft skills: {MISSION_SOFT_SKILLS}

Fournissez une analyse détaillée en JSON:
{
  "overallScore": 85,
  "verdict": "Très bon match | Bon match | Match partiel | Faible match",
  "summary": "Résumé en 2-3 phrases de l'adéquation globale",
  "strengths": [
    {"category": "skills|tools|industries|softSkills|experience", "item": "élément fort", "explanation": "pourquoi c'est un atout"}
  ],
  "gaps": [
    {"category": "skills|tools|industries|softSkills|experience", "item": "élément manquant", "severity": "critical|important|minor", "explanation": "impact sur la candidature"}
  ],
  "recommendations": [
    {"type": "highlight|develop|acquire", "suggestion": "recommandation concrète pour le candidat ou le recruteur"}
  ],
  "interviewQuestions": [
    "Question pertinente à poser en entretien pour valider un point"
  ],
  "riskAssessment": {
    "level": "low|medium|high",
    "factors": ["facteur de risque 1", "facteur de risque 2"]
  }
}

Règles d'analyse:
1. overallScore: 0-100, basé sur l'adéquation globale
2. strengths: points forts du candidat par rapport à la mission (max 5)
3. gaps: lacunes ou compétences manquantes (max 5), avec niveau de criticité
4. recommendations: conseils actionnables (max 4)
5. interviewQuestions: questions pour approfondir les points incertains (max 3)
6. riskAssessment: évaluation des risques de recrutement

Répondez UNIQUEMENT en JSON valide.`;

/**
 * Prompt for batch title matching refinement
 * Used to refine match scores based on candidate titles vs mission requirements
 * Single LLM call for all candidates to optimize costs
 */
export const TITLE_MATCHING_REFINEMENT_PROMPT = `Analysez la pertinence des titres de poste des candidats par rapport à cette mission.

MISSION:
Titre: {MISSION_TITLE}
Description résumée: {MISSION_SUMMARY}
Niveau d'expérience recherché: {EXPERIENCE_LEVEL}

CANDIDATS (ID: Titre actuel):
{CANDIDATES_LIST}

Pour chaque candidat, évaluez si son titre de poste actuel est pertinent pour la mission.
Attribuez un ajustement de score entre -15 et +15 points:
- +10 à +15: Titre très pertinent (ex: "Lead Developer React" pour une mission React senior)
- +5 à +9: Titre pertinent (ex: "Développeur Full Stack" pour une mission React)
- 0 à +4: Titre neutre ou légèrement pertinent
- -5 à -1: Titre peu pertinent mais pas bloquant
- -10 à -15: Titre non pertinent (ex: "Chef de projet" pour une mission technique pure)

Répondez en JSON avec ce format exact:
{
  "adjustments": {
    "candidateId1": {"adjustment": 10, "reason": "Titre très aligné avec la mission"},
    "candidateId2": {"adjustment": -5, "reason": "Titre orienté management, mission technique"}
  }
}

Règles:
1. Évaluez UNIQUEMENT la pertinence du titre, pas les compétences
2. Tenez compte du niveau hiérarchique (junior/senior/lead/manager)
3. Tenez compte du domaine fonctionnel vs technique
4. Un titre générique ("Consultant", "Ingénieur") = ajustement proche de 0
5. Répondez UNIQUEMENT en JSON valide`;

/**
 * Prompt for intelligent batch profile scoring using LLM
 * Replaces the text-based fuzzyMatch with semantic understanding
 * Processes multiple candidates in a single call for cost efficiency
 */
export const BATCH_PROFILE_SCORING_PROMPT = `Vous êtes un expert RH spécialisé dans le matching de profils IT/IS (contexte ESN/cabinet de recrutement).

MISSION À POURVOIR:
Titre: {MISSION_TITLE}
Compétences techniques requises: {MISSION_SKILLS}
Outils/Technologies requis: {MISSION_TOOLS}
Secteurs d'activité: {MISSION_INDUSTRIES}
Soft skills recherchés: {MISSION_SOFT_SKILLS}
Niveau d'expérience: {EXPERIENCE_LEVEL}

CANDIDATS À ÉVALUER:
{CANDIDATES_JSON}

Pour chaque candidat, évaluez l'adéquation globale avec la mission en tenant compte de:
1. La correspondance des compétences techniques (poids: 40%)
2. La maîtrise des outils/technologies (poids: 25%)
3. L'expérience dans les secteurs concernés (poids: 20%)
4. Les soft skills (poids: 15%)
5. La pertinence du titre/poste actuel

BARÈME DE SCORING (0-100):
- 85-100: Match excellent - Profil idéal, répond à tous les critères clés
- 70-84: Bon match - Profil solide, quelques ajustements mineurs possibles
- 50-69: Match partiel - Potentiel intéressant, montée en compétence nécessaire
- 30-49: Match faible - Écarts significatifs sur des critères importants
- 0-29: Profil non adapté - Compétences trop éloignées des besoins

Répondez UNIQUEMENT en JSON valide avec ce format:
{
  "scores": {
    "candidateId1": {
      "score": 85,
      "confidence": "high",
      "reason": "Profil senior React/Node parfaitement aligné avec les besoins techniques. Expérience bancaire valorisante.",
      "keyStrengths": ["Maîtrise React avancée", "Expérience secteur bancaire"],
      "keyGaps": ["Pas d'expérience Kubernetes mentionnée"]
    },
    "candidateId2": {
      "score": 62,
      "confidence": "medium",
      "reason": "Compétences backend solides mais manque d'expérience frontend React demandée.",
      "keyStrengths": ["Expert Node.js", "Bonne culture DevOps"],
      "keyGaps": ["React non maîtrisé", "Secteur retail vs banque demandé"]
    }
  }
}

RÈGLES D'ÉVALUATION:
1. Évaluez la PERTINENCE SÉMANTIQUE, pas la correspondance textuelle exacte
   - "Java" ≠ "JavaScript" (langages différents)
   - "React" ≈ "React.js" ≈ "ReactJS" (même technologie)
   - "AWS" ≈ "Amazon Web Services" (même plateforme)
2. Valorisez les compétences transférables et l'expérience connexe
3. Un profil senior peut convenir pour un poste mid-level (surqualification légère OK)
4. Un profil junior ne convient PAS pour un poste senior (sous-qualification pénalisante)
5. Le titre du candidat doit être cohérent avec le poste (Dev vs Chef de projet)
6. confidence: "high" si les données sont complètes, "medium" si partielles, "low" si insuffisantes
7. reason: 1-2 phrases maximum, factuel et actionnable
8. keyStrengths: 2-3 points forts maximum
9. keyGaps: 1-2 lacunes principales (vide si aucune lacune majeure)`;

/**
 * Helper function to normalize weights to sum to 100%
 */
export function normalizeWeights(data) {
    const weightFields = [
        'Executive Summary Weight',
        'Skills Weight',
        'Experience Weight',
        'Education Weight',
        'ATS Weight',
        'Hobbies Languages Weight'
    ];

    const hasWeights = weightFields.some(field => data[field] !== undefined);
    
    if (!hasWeights) {
        return data;
    }

    const weights = weightFields.map(field => parseFloat(data[field]) || 0);
    const total = weights.reduce((sum, w) => sum + w, 0);

    if (total === 0) {
        const equalWeight = Math.round((100 / weights.length) * 100) / 100;
        weightFields.forEach(field => {
            data[field] = equalWeight;
        });
    } else if (total !== 100) {
        const normalized = weights.map(w => {
            const norm = (w / total) * 100;
            return Math.round(norm * 100) / 100;
        });

        const normalizedTotal = normalized.reduce((sum, w) => sum + w, 0);
        if (normalizedTotal !== 100) {
            const diff = 100 - normalizedTotal;
            const maxIndex = normalized.indexOf(Math.max(...normalized));
            normalized[maxIndex] = Math.round((normalized[maxIndex] + diff) * 100) / 100;
        }

        weightFields.forEach((field, index) => {
            data[field] = normalized[index];
        });
    }

    return data;
}
