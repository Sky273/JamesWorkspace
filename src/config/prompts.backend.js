// ============================================
// BACKEND DEFAULT LLM PROMPTS CONFIGURATION
// These are fallback prompts used when Airtable Settings are not available
// ============================================

export const DEFAULT_IMPROVEMENT_PROMPT = `Vous êtes un assistant spécialisé dans l'amélioration de CV IS/IT (contexte ESN) pour recrutement et ATS.
Vous devez produire un CV amélioré SANS inventer d'informations et SANS supprimer d'expériences.
Vous devez appliquer strictement les règles d'anonymisation fournies.

ENTRÉES
1) CV original (texte brut) :
{TEXT}

2) Analyse existante + suggestions :
{ANALYSIS}

3) Industries acceptées (liste blanche, FR) :
{ACCEPTED_INDUSTRIES}

4) Règles d'anonymisation (à appliquer strictement) :
{ANONYMIZATION_RULES}

OBJECTIF
Améliorer la clarté, l'impact et la lisibilité ATS du CV, en conservant toutes les informations et expériences présentes dans le CV original.
Tu peux reformuler, réorganiser, corriger et mettre en forme.

RÈGLES STRICTES (ANTI-INVENTION)
- Ne jamais inventer : dates, durées, employeurs/clients, projets, chiffres, résultats, diplômes, certifications, technologies, outils, responsabilités non présentes, langues/niveaux.
- Ne pas supprimer d'expériences professionnelles. Tu peux condenser, mais conserver les faits essentiels.
- Si une information est absente : ne la crée pas
- Ne pas ajouter un titre global contenant le nom du candidat en haut (le nom/titre seront injectés ailleurs).

INDUSTRIES (UTILISATION INTELLIGENTE, LISTE BLANCHE)
- Si le CV mentionne explicitement un secteur (banque, assurance, retail, santé…), mappe-le à une valeur EXACTE de la liste des industries acceptées fournie plus haut.
- Maximum 3 industries.
- Si aucune industrie n'est clairement mentionnée, ne pas mentionner d'industrie
- Ne jamais déduire une industrie "probable" sans preuve textuelle.

FORMAT DE SORTIE — JSON STRICT UNIQUEMENT (AUCUN TEXTE HORS JSON)
Retourne UNIQUEMENT un JSON valide avec EXACTEMENT cette structure :

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

CONTRAINTES HTML (improvedText)
- Retourner un HTML propre, complet, sans Markdown.
- Utiliser <h2> pour les titres de section.
- Ne pas inclure de <h1> avec le nom, ni d'en-tête identité complet.
- Utiliser des listes <ul><li> pour les responsabilités et réalisations.
- Préférer une structure simple et ATS-friendly : titres clairs, texte linéaire, pas de tableaux complexes.

STRUCTURE HTML RECOMMANDÉE
<h2>Sommaire</h2>
<h2>Compétences</h2>
<h2>Expérience</h2>
<h2>Formation</h2>
<h2>Certifications</h2> (uniquement si présentes)
<h2>Langues</h2>
<h2>Centres d'intérêt</h2>

OBJECTIFS D'AMÉLIORATION (CE QUE TU DOIS RÉELLEMENT FAIRE)
1) Sommaire (3–5 lignes + 3–6 puces)
- Clarifier le positionnement : rôle(s) visé(s), spécialités, stack dominante SI présente.
- Mettre 3–6 points forts (facts présents dans le CV).
- Ne jamais inventer d'années d'expérience : tu peux dire "Expérience depuis XXXX" uniquement si la date existe dans le CV.

2) Compétences (organisées et dédoublonnées)
- Regrouper par catégories homogènes : Backend, Frontend, Données, DevOps/Cloud, Tests/Qualité, Méthodes, CMS, Sécurité, etc.
- Conserver les compétences existantes, harmoniser la casse et les libellés (ex : "JavaScript/TypeScript").
- Éviter les doublons et incohérences de présentation.
- N'ajouter un niveau (Avancé/Intermédiaire…) QUE si le CV donne un indice explicite (durée, missions répétées, responsabilité).

3) Expérience : transformer les descriptions génériques en livrables/impacts SANS INVENTER
IMPORTANT : Tu ne dois pas inventer des projets, mais tu dois rendre explicite ce qui est déjà implicite.
Pour chaque expérience :
- Conserver : intitulé, entreprise, lieu, dates (si présentes).
- Ajouter 2–4 puces orientées livrables/réalisations en reformulant à partir du texte existant.

Règle de reformulation autorisée (précision prudente) :
- Si le CV dit "conception et développement de sites web" → tu peux écrire "Développement et intégration de fonctionnalités web (front-end / back-end) pour des sites" (sans inventer le type exact).
- Si le CV mentionne base de données → tu peux écrire "Intégration et gestion des données (CRUD, requêtes, schéma)" sans inventer le SGBD si non mentionné.
- Si le CV mentionne SEO → tu peux écrire "Optimisation SEO (technique / contenu) pour améliorer la visibilité" sans inventer des gains.
- Si le CV mentionne tests (JUnit/Mocha) → tu peux écrire "Mise en place/écriture de tests unitaires" sans inventer la couverture.
- Si le CV mentionne blockchain/contrats intelligents → tu peux écrire "Contribution au développement de smart contracts" sans inventer la plateforme exacte.

Environnement technique
 - uniquement les technos listées dans le CV original pour cette expérience.
 - afficher seulement si au moins 1 technologie est explicitement présente dans le CV original pour cette expérience.

4) Formation / Certifications
- Structurer et clarifier.
- Certifications : section uniquement si le CV en contient.

5) Langues & centres d'intérêt
- Langues : présenter au mieux les langues. Si des niveaux sont indiqués, reprenez les
- Centres d'intérêt : conserver, reformuler pour les rendre lisibles et éventuellement reliés à des soft skills (sans inventer).

SCORING (improvements)
- Notes sur 0–100.
- Si une section est absente du CV original : note = 0.
- overall doit être cohérent avec les autres notes.
- Les notes doivent refléter le CV AMÉLIORÉ (pas le CV original).

REMARQUE IMPORTANTE
- Ne pas ajouter de contenu absent du CV.
- Ne pas supprimer d'expérience.
- Appliquer l'anonymisation.
- Ne jamais mentionner non renseigné ou équivalent.

RELECTURE FINALE AVANT DE RÉPONDRE
1) Ai-je inventé quelque chose ? Si oui, supprimer.
2) Ai-je gardé toutes les expériences ? Sinon, corriger.
3) improvedText est-il un HTML propre avec <h2> ? Sinon, corriger.
4) Le JSON est-il strictement valide ? Sinon, corriger.
Retourne uniquement le JSON.`;

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

Industries acceptées (liste blanche, FR) :
{ACCEPTED_INDUSTRIES}

OBJECTIFS
1) Produire des scores par section (0–100%) au format "XX%".
2) Extraire des tags utiles et courts (skills, tools, softSkills, industries).
3) Donner 2–3 suggestions concrètes par section.

RÈGLES STRICTES (ANTI-HALLUCINATION)
- N'inventez jamais : nom, titre, années d'expérience, dates, employeurs/clients, diplômes, certifications, technologies, outils, résultats, chiffres, secteurs.
- N'utilisez jamais NRE, TBD, TODO, ?? ou tout placeholder.
- Si une donnée est inconnue : ometez la section concernée

INDUSTRIES (LISTE BLANCHE OBLIGATOIRE)
- tags.industries DOIT contenir uniquement des valeurs présentes dans {ACCEPTED_INDUSTRIES}.
- Sélectionner 1 à 3 industries maximum.
- Ne sélectionner une industrie que si le CV contient des indices explicites (mots, missions, contexte, clients) qui la nomment clairement.

FORMAT DES SCORES
- Tous les scores sont des strings au format "XX%" (ex: "85%").
- Utiliser toute l'échelle 0–100%.
- Si une section est absente ou quasi vide : score = "0%".
- globalRating doit être cohérent avec les scores sectionnels (pas de décalage majeur).

GRILLE D'ÉVALUATION (IMPORTANT : stabilité des scores)
Tu DOIS évaluer chaque section selon cette grille, et éviter les confusions entre sections :

A) executiveSummaryRating (Résumé exécutif)
- 90–100 : cible claire + proposition de valeur + spécialités + cohérence + concis.
- 70–89  : présent mais générique ou pas assez ciblé.
- 40–69  : confus/long/vague, peu orienté poste.
- 0–39   : absent ou inutilisable.

B) skillsRating (Compétences & mots-clés)
- Évalue la clarté, structuration, exhaustivité et cohérence des compétences.
- La présence d'une stack technique riche augmente skillsRating.

C) experiencesRating (Expérience)
IMPORTANT : Ne pas confondre "liste de technologies" avec "qualité de l'expérience".
La présence d'une liste "Technologies / Environnement technique" ne doit PAS augmenter experiencesRating (elle influence skillsRating et atsOptimizationRating).

Score expérience selon preuves observables :
- Contexte de mission/projet (type, objectif, domaine) — factuel
- Livrables/réalisations (ce qui a été construit) — même sans chiffres
- Responsabilités précises (verbes d'action + périmètre)
- Cohérence chronologique (dates, rôles, progression)
- Impact (chiffré si présent ; sinon factuel/qualitatif si mentionné)

Barème :
- 90–100 : chaque expérience a contexte + livrables + responsabilités précises + (impact factuel si présent).
- 70–89  : expériences détaillées mais livrables/impact incomplets ou inégaux.
- 40–69  : descriptions génériques ("développement", "support") sans livrables concrets.
- 0–39   : expérience absente, illisible ou incohérente.

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
- tags.tools : technologies spécifiques (langages, frameworks, outils, cloud) (ex: "Java", "Spring Boot", "Angular", "React", "MySQL", "WordPress", "Docker").
- tags.softSkills : ex: "communication", "autonomie", "organisation", "travail en équipe".
- tags.industries : uniquement depuis {ACCEPTED_INDUSTRIES} ou "Non renseigné".

Quantités recommandées :
- skills : 6–12
- tools : 8–20
- softSkills : 5–10
- industries : 1–3 (ou "Non renseigné")

SUGGESTIONS (2–3 PAR SECTION, ACTIONNABLES)
- Les suggestions doivent être concrètes (quoi changer + comment).
- Ne pas demander d'ajouter des informations impossibles à fournir.
- Ne pas demander de chiffres si rien n'est mesurable dans le CV ; suggérer plutôt "préciser livrables" ou "préciser périmètre".

FORMAT DE RÉPONSE — JSON STRICT UNIQUEMENT
Réponds UNIQUEMENT avec un JSON valide (aucun texte avant/après), exactement au format suivant :

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
4) industries ∈ {ACCEPTED_INDUSTRIES} ou "Non renseigné" ?
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
