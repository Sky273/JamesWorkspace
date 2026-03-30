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
7. reason: 1 phrase courte maximum, factuelle, sans formulation longue
8. keyStrengths: 1-2 points forts maximum
9. keyGaps: 0-1 lacune principale (vide si aucune lacune majeure)
10. Réduisez au strict minimum la verbosité pour chaque candidat afin de préserver un JSON compact`;

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
