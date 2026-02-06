// Text extraction utilities (extracted to separate module)
import { 
  extractTextFromPDF, 
  extractTextFromDOCX, 
  extractTextFromDOC 
} from './textExtraction.js';
import { resumeAnalysisService } from './resumeAnalysisService';
import { createAuthOptionsWithCsrf } from './apiInterceptor';
import logger from './logger.frontend';

// Export a unified text extraction function with retry logic
export async function extractResumeText(file) {
  if (!(file instanceof File)) {
    throw new Error('Input must be a File object');
  }

  const MAX_RETRIES = 2;
  let lastError;
  
  logger.log(`Starting text extraction for file: ${file.name} (${file.type}, ${(file.size / 1024).toFixed(2)} KB)`);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      logger.log(`Extraction attempt ${attempt}/${MAX_RETRIES}`);
      
      // PDF extraction
      if (file.type === 'application/pdf') {
        const text = await extractTextFromPDF(file);
        
        // More lenient validation for OCR results
        if (!text || text.trim().length < 50) {
          const errorMsg = text.includes('[Page') 
            ? 'PDF extraction failed on multiple pages. File may be corrupted or protected.'
            : 'PDF extraction returned very little text. File might be empty, corrupted, or heavily encrypted.';
          
          logger.warn(errorMsg);
          
          if (attempt < MAX_RETRIES) {
            throw new Error('Insufficient text extracted from PDF');
          } else {
            // On final attempt, provide detailed error
            throw new Error(`${errorMsg} Extracted ${text.length} characters after ${MAX_RETRIES} attempts.`);
          }
        }
        
        logger.log(`Successfully extracted ${text.length} characters from PDF`);
        return text;
      }
      
      // DOCX extraction
      if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const text = await extractTextFromDOCX(file);
        if (!text || text.trim().length < 50) {
          throw new Error('Insufficient text extracted from DOCX');
        }
        return text;
      }
      
      // DOC extraction (Word 97-2003)
      if (file.type === 'application/msword') {
        try {
          const text = await extractTextFromDOC(file);
          if (!text || text.trim().length < 50) {
            throw new Error('Insufficient text extracted from DOC');
          }
          return text;
        } catch (docError) {
          logger.warn('word-extractor failed for DOC file:', docError.message);
          // Fallback: try treating as DOCX (some .doc files are actually .docx)
          if (attempt === MAX_RETRIES) {
            logger.log('Attempting fallback: treating DOC as DOCX...');
            try {
              return await extractTextFromDOCX(file);
            } catch (fallbackError) {
              logger.error('Fallback extraction also failed:', fallbackError.message);
              throw docError; // Throw original error
            }
          }
          throw docError;
        }
      }
      
      throw new Error(`Unsupported file type: ${file.type}`);
      
    } catch (error) {
      lastError = error;
      logger.error(`Extraction attempt ${attempt} failed:`, error.message);
      
      // Wait before retry (exponential backoff)
      if (attempt < MAX_RETRIES) {
        const waitTime = 1000 * attempt;
        logger.log(`Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  // All retries failed
  const errorMessage = `Failed to extract text after ${MAX_RETRIES} attempts: ${lastError.message}`;
  logger.error(errorMessage);
  throw new Error(errorMessage);
}

// Function to call Claude
async function askClaude(prompt) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  
  try {
    const authOptions = await createAuthOptionsWithCsrf({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        max_tokens: 8192,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });
    const response = await fetch('/api/llm/anthropic', {
      ...authOptions,
      signal: controller.signal
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response from proxy' }));
      logger.error('Error from Anthropic proxy:', errorData);
      throw new Error(`Anthropic API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }

    const message = await response.json();
    return message.content[0].text;

  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Anthropic request timed out after 60s');
    }
    logger.error('Error calling Claude via proxy:', error);
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const analyzeResume = async (text) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 second timeout
  
  try {

    const prompt = `Vous êtes un expert dans le domaine des ressources humaines disposant de compétences avancées dans le domaine des systèmes d'information et des technologies de l'information. Votre mission est d'analyser un CV et de fournir une evaluation detaillée. Analysez ce CV et fournissez une evaluation detaillée.

CV:
${text}

Répondez uniquement en JSON. Le JSON devra respecter le format suivant :
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
    "skills": ["tag1", "tag2"],
    "industries": ["tag1", "tag2"],
    "tools": ["tag1", "tag2"],
    "softSkills": ["tag1", "tag2"]
  },
  "suggestions": {
    "executiveSummary": ["suggestion1", "suggestion2"],
    "skills": ["suggestion1", "suggestion2"],
    "experiences": ["suggestion1", "suggestion2"],
    "education": ["suggestion1", "suggestion2"],
    "hobbiesLanguages": ["suggestion1", "suggestion2"],
    "atsOptimization": ["suggestion1", "suggestion2"]
  }
}

Règles pour l'extraction du nom et du titre:
1. Extraction du nom:
   - Extraire le nom complet du candidat depuis l'en-tête du CV ou les informations de contact
   - Inclure le premier et le dernier nom si disponible
   - Si plusieurs noms sont trouvés, utiliser le nom le plus utilisé
   - Si aucun nom n'est trouvé, renvoyer "Candidat"

2. Détermination du titre:
   - Sur la base du titre associé à la dernière expérience ou au poste actuel
   - Considérez la progression de carrière et le niveau d'expérience
   - Utilisez des titres professionnals couramment utilisés dans le domaine
   - Si le domaine est IT/IS, ajoutez des titres spécifiques
   - Exeples: "Ingénieur logiciel Sénior", "Chef de projet IT", "développeur fullstack"

Règles concernant les notations (0-100%):
- 0%: Composant manquant
- 1-20%: Présent mais avec des issues critiques
- 21-40%: Améliorations significatives requises
- 41-60%: Réponds aux exigences de base mais pourrait être amélioré.
- 61-80%: Bonne qualité, mais il reste des possibilités d'amélioration
- 81-100%: Excellente qualité

Evaluez chaque section du CV selon ces critères:

1. Sommaire (executiveSummaryRating):
Important : assignez 0% si aucun sommaire / executive summary n'existe.
Si présent, evaluatez selon:
- Valeur de proposition claire et objectif professionnel (20%)
- Highlights de carriere et accomplissements (20%)
- Alignement industriel et demonstration de expertise (20%)
- Engagement et passion pour le domaine (20%)
- Profil professionnel clair et objectif (20%)

2. Compétences (skillsRating):
- Compétences techniques et langages de programmation (40%) 
- Catégorie et organisation des compétences (20%)
- Couverture des industries spécialisées (20%)
- Niveau de compétence ou de professionnalisme (15%)
- Inclusion des technologies modernes (20%)

3. Expériences (experiencesRating):
- Quantification des accomplissements avec des indicateurs (25%)
- Progression du rôle et de la croissance (20%)
- Clarte et impact de la responsabilité (20%)
- Résolution des défis techniques (20%)
- Consistance du calendrier et lacunes (15%)

4. Education (educationRating):
- Qualifications IT/IS pertinentes (25%)
- Réussites acadiques et note moyenne si pertinent (20%)
- Certifications professionnelles (25%)
- Formation continue (15%)
- Alignement entre la formation et la carrière (15%)

5. Hobbies & Langues (hobbiesLanguagesRating):
- Relevances industrielles des activités (20%)
- Présentation professionnelle (20%)
- Niveau de langue (25%)
- Démonstration des competences (20%)
- Indication de correspondance culturelle (15%)

6. Optimisation pour ATS (atsOptimizationRating):
- Utilisation des mots-clés de l'industrie (25%)
- Compatibilité et structure du CV (25%)
- Clarté des entêtes de section (20%)
- Terminologie et vocabulaire cohérents (20%)
- Titres de poste standards de l'industrie (15%)

7. Calcul de la note globale (globalRating):
- Note de la section Executive Summary (20%)
- Note de la section Skills (25%)
- Note de la section Experiences (25%)
- Note de la section Education (15%)
- Note de la section Hobbies & Languages (5%)
- Note de la section ATS Optimization (10%)

Pour l'extraction des tags (tags):
- skills: Listez toutes les competences techniques et leslangages de programmation
- industries: Identifiez les secteurs d'activité de l'industrie
- tools: Listez les outils, logicels, frameworks et de l'industrie.
- softSkills: Listez les qualités et habilités de leadership, communication et interpersonnelles, ou autres qualités essentielles.

Merci de fournir des suggestions claires pour chaque section. Toutes les valeurs en pourcentage doivent être au format chaîne (exemple : "85%").`;

    try {
      const authOptions = await createAuthOptionsWithCsrf({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          max_tokens: 4096,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            {
              role: 'system',
              content: 'You are a JSON-only resume analysis API. You must ALWAYS respond with valid JSON matching the requested format. Do not include any explanatory text, comments, or markdown formatting outside the JSON structure.'
            },
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      });
      
      const response = await fetch('/api/llm/openai', {
        ...authOptions,
        signal: controller.signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const analysis = JSON.parse(data.choices[0].message.content);
      
      // Validate the analysis object has all required fields
      const requiredFields = [
        'name',
        'title',
        'globalRating',
        'executiveSummaryRating',
        'skillsRating',
        'experiencesRating',
        'educationRating',
        'hobbiesLanguagesRating',
        'atsOptimizationRating',
        'tags',
        'suggestions'
      ];
      
      const missingFields = requiredFields.filter(field => !(field in analysis));
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields in analysis: ${missingFields.join(', ')}`);
      }

      // Ensure all ratings are strings ending with %
      const ratingFields = requiredFields.filter(field => field.endsWith('Rating'));
      ratingFields.forEach(field => {
        if (typeof analysis[field] === 'number') {
          analysis[field] = `${analysis[field]}%`;
        } else if (!analysis[field].endsWith('%')) {
          analysis[field] = `${analysis[field]}%`;
        }
      });
      
      // Ensure suggestions are arrays
      Object.keys(analysis.suggestions).forEach(key => {
        if (!Array.isArray(analysis.suggestions[key])) {
          analysis.suggestions[key] = [];
        }
      });
      
      // Ensure tags are objects with arrays
      Object.keys(analysis.tags).forEach(key => {
        if (!Array.isArray(analysis.tags[key])) {
          analysis.tags[key] = [];
        }
      });
      
      clearTimeout(timeoutId);
      return analysis;
    } catch (parseError) {
      clearTimeout(timeoutId);
      logger.error('Error parsing analysis JSON:', parseError);
      throw new Error(`Failed to parse analysis response: ${parseError.message}`);
    }
  } catch (error) {
    logger.error('Error analyzing resume:', error);
    throw error;
  }
};

export const improveResume = async (originalText, analysis) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
  
  try {

    const prompt = `En tant qu'expert en ressources humaines doté d'une connaissance approfondie dans le domaine des technologies de l'information (IT) et des systèmes d'information (IS), parlant couramment anglais et français, vous devez améliorer un CV en fonction d'une analyse préalable.

Analyse précédente:
${JSON.stringify(analysis, null, 2)}

CV:
${originalText}

Vos améliorations doivent cibler le fait d'atteindre les meilleurs scores dans chaque catégorie, et ce sans inventer de nouveaux éléments ni en supprimant des éléments par rapport au cv original.

Echelle de notation (0-100%):
- 0%: section manquante ou composant critique manquant
- 1-20%: Présent mais avec des issues critiques
- 21-40%: Améliorations significatives requises
- 41-60%: Réponds aux exigences de base mais pourrait être amélioré.
- 61-80%: Bonne qualité, mais il reste des possibilités d'amélioration
- 81-100%: Excellente qualité

Zones d'attention:

1. Sommaire exécutif (20% du score total):
CRITIQUE : La section exécutive doit toujours exister. (score de 0% si elle est manquante)
Améliorez le sommaire exécutif en focalisant votre attention sur les composants suivants :
- Proposition de valeur claire et objectif professionnel
- Mise en avant de points forts  de la carriere et des accomplissements associés
- Alignement industriel et demonstration d'expertise.
- Impact quantifié (présence de métriques)
- Ton professionel

2. compétences (25% du score total):
- compétences techniques associées au domaine IS/IT
- organisation et catégorie des compétences
- couverture des competences industrielles
- indication du Niveau de competence
- Inclusion des technologies modernes

3. Expérience (25% du score total):
- Quantification des accomplissements avec des métriques
- Progression et croissance du role
- Clarte et impact de la responsabilite
- Technical challenge resolution
- Timeline consistency and gaps

4. Education (15% du score total):
- Qualifications IT/IS pertinents
- Realisations academiques et note moyenne si notable
- Certifications professionnelles
- Formation continue et formation professionnelle
- Alignement formation-carriere

5. Hobbies & Langues (5% du score total):
- Relevances industrielles des activités
- Présentation professionnelle
- Niveau de langue
- Demonstration de soft skills
- Indication de compatibilité culturelle

Règles concernant les améliorations:
1. Traiter les zones critiques identifiées lors de l'analyse précédente en priorité
2. Assurez vous que toutes les sections sont prises en compte, notament le sommaire exécutif (executive summary).
3. Optimiser l'utilisation des mots-clés de l'industrie sans inventer de nouveaux éléments.
5. Utiliser des terminologies et vocabulaire approprié pour l'industrie.
6. Suivez les bonnes pratiques pour un cv moderne et professionnel.
7. Optimisez le CV pour l'utilisation des ATS.
8. Le résultat doit être une réécriture exhaustive et claire du cv original, sans inventer de nouveaux éléments.
9. Assurez-vous de fournir le cv amélioré en réponse.
10. Incluez toutes les expériences professionnelles dans le CV amélioré.

Formatter les titres en utilisant des balises <h2>.

Merci de fournir le cv amélioré au format HTMLen réponse.`;

    const response = await askClaude(prompt);

    if (!response) {
      throw new Error('Invalid response from Claude API');
    }

    return response.trim();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    logger.error('Error improving resume:', error);
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

export async function processResume(input, isImprovement = false) {
    try {
        let text;
        let analysis;
        
        if (isImprovement) {
            // If we're improving, input is already text
            text = input;
            // First analyze the current text
            analysis = await analyzeResume(text);
            // Then get the improved version from Claude
            text = await improveResume(text, analysis);
            // Finally analyze the improved version
            analysis = await analyzeResume(text);
        } else {
            // If we're processing a new file
            if (!(input instanceof File)) {
                throw new Error('Input must be a File object');
            }

            // Extract text based on file type
            if (input.type === 'application/pdf') {
                text = await extractTextFromPDF(input);
            } else if (input.type === 'application/msword' || input.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                text = await extractTextFromDOCX(input);
            } else {
                throw new Error('Unsupported file type');
            }
            
            // Analyze the original resume
            analysis = await analyzeResume(text, false);
        }

        return {
            text,
            analysis
        };
    } catch (error) {
        logger.error('Error processing resume:', error);
        throw error;
    } finally {
        // Cleanup PDF.js worker if it was used
        cleanupWorker();
    }
};
