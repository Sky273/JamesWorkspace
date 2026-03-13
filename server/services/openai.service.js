import axios from 'axios';
import { OPENAI_API_KEY, MAX_PROMPT_LENGTH } from '../config/constants.js';
import { buildOpenAIParams } from './llm.service.js';
import { metrics } from './metrics.service.js';
import { safeLog } from '../utils/logger.backend.js';
import { validatePromptSize } from '../utils/postgresHelpers.js';
import { securityLog, LOG_LEVELS, SECURITY_EVENTS } from './security.service.js';
import { withRetry, getCircuitBreakerStates } from './retry.service.js';

const OPENAI_CHAT_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_RESPONSES_API_URL = 'https://api.openai.com/v1/responses';

/**
 * Centralized OpenAI service to eliminate code duplication
 */

/**
 * Call OpenAI API with common error handling and metrics tracking
 * @param {Object} params - Request parameters
 * @param {string} params.model - OpenAI model to use
 * @param {Array} params.messages - Array of message objects
 * @param {number} params.maxTokens - Maximum tokens in response
 * @param {number} params.temperature - Temperature for response
 * @param {Object} params.responseFormat - Response format (e.g., { type: "json_object" })
 * @param {number} params.timeout - Request timeout in milliseconds
 * @param {number} params.maxPromptLength - Maximum prompt length for validation
 * @returns {Promise<Object>} - OpenAI response data
 */
export async function callOpenAI({
    model,
    messages,
    maxTokens = 4096,
    temperature = 0,
    topP = 1,
    responseFormat = null,
    timeout = 90000,
    maxPromptLength = MAX_PROMPT_LENGTH,
    userMetadata = null,  // Optional: { email, ip, action } for security logging
    operationType = 'OpenAI Service API request'  // Description for logging
}) {
    if (!OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured on server');
    }

    if (!model) {
        throw new Error('Model is required');
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        throw new Error('Messages array is required and must not be empty');
    }

    // Validate prompt size if maxPromptLength is specified
    if (maxPromptLength) {
        const combinedPrompt = messages.map(m => m.content).join('\n');
        const promptValidation = validatePromptSize(combinedPrompt, maxPromptLength);
        if (!promptValidation.valid) {
            const error = new Error(promptValidation.error);
            error.estimatedTokens = promptValidation.estimatedTokens;
            throw error;
        }
    }

    // Log LLM request for security monitoring
    securityLog(LOG_LEVELS.INFO, SECURITY_EVENTS.LLM_REQUEST, {
        email: userMetadata?.email || 'system',
        ip: userMetadata?.ip || 'internal',
        action: userMetadata?.action || `POST /openai-service`,
        message: operationType,
        metadata: { 
            model: model,
            messageCount: messages.length,
            maxTokens: maxTokens
        }
    });

    try {
        // Check if this is a GPT-5 model - they require the Responses API
        const isGPT5Model = model.match(/^gpt-5/i);
        
        let apiUrl;
        let requestParams;
        
        if (isGPT5Model) {
            // GPT-5 models use the Responses API
            apiUrl = OPENAI_RESPONSES_API_URL;
            
            // gpt-5.x-pro models only support: 'medium', 'high', 'xhigh'
            // gpt-5.x (non-pro) supports: 'none', 'low', 'medium', 'high', 'xhigh'
            const isProModel = model.match(/gpt-5\.\d+-pro/i);
            const reasoningEffort = isProModel ? "medium" : "none";
            
            requestParams = {
                model: model,
                input: messages,
                reasoning: { effort: reasoningEffort },
                max_output_tokens: maxTokens
            };
            
            // In Responses API, response_format has moved to text.format
            if (responseFormat) {
                requestParams.text = { format: responseFormat };
            }
            
            // Temperature only supported with reasoning.effort = "none"
            if (!isProModel && temperature !== undefined) {
                requestParams.temperature = temperature;
            }
            
            // top_p is supported for GPT-5 models
            if (topP !== undefined) {
                requestParams.top_p = topP;
            }
            
            safeLog('info', 'LLM Request', { model, messageCount: messages.length, maxTokens, reasoningEffort, temperature, topP });
        } else {
            // Standard models use Chat Completions API
            apiUrl = OPENAI_CHAT_API_URL;
            
            requestParams = buildOpenAIParams(model, {
                maxTokens,
                temperature,
                topP,
                additionalParams: {
                    messages,
                    ...(responseFormat && { response_format: responseFormat })
                }
            });
            
            safeLog('info', 'LLM Request', { model, messageCount: messages.length, maxTokens, temperature, topP });
        }

        const response = await axios.post(apiUrl, requestParams, {
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: isGPT5Model ? Math.max(timeout, 180000) : timeout, // GPT-5 models need longer timeout
            validateStatus: function (status) {
                return status < 500; // Resolve for all non-5xx status codes to capture error details
            }
        });
        
        // Check if response indicates an error (4xx status)
        if (response.status >= 400) {
            safeLog('error', 'OpenAI API returned error', {
                status: response.status,
                errorMessage: response.data?.error?.message || 'Unknown error',
                model
            });
            const error = new Error(response.data?.error?.message || 'OpenAI API error');
            error.response = response;
            throw error;
        }

        const usage = response.data?.usage || {};
        // Responses API uses input_tokens/output_tokens, Chat Completions uses prompt_tokens/completion_tokens
        const inputTokens = usage.input_tokens || usage.prompt_tokens || 0;
        const outputTokens = usage.output_tokens || usage.completion_tokens || 0;
        const totalTokens = usage.total_tokens || (inputTokens + outputTokens);
        
        safeLog('info', 'LLM Token usage', { inputTokens, outputTokens, totalTokens });
        metrics.trackLLMRequest(model, totalTokens, true, inputTokens, outputTokens);

        // Transform Responses API format to Chat Completions API format for consistency
        if (isGPT5Model && response.data?.output) {
            const outputItems = response.data.output || [];
            const messageItem = outputItems.find(item => item.type === 'message');
            const textContent = messageItem?.content?.find(c => c.type === 'output_text')?.text || 
                               messageItem?.content?.[0]?.text ||
                               (typeof messageItem?.content === 'string' ? messageItem.content : '');
            
            const transformedResponse = {
                id: response.data.id,
                object: 'chat.completion',
                created: Date.now(),
                model: model,
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: textContent
                    },
                    finish_reason: response.data.status === 'completed' ? 'stop' : response.data.status
                }],
                usage: response.data.usage
            };
            
            safeLog('debug', 'Transformed Responses API response to Chat Completions format');
            return transformedResponse;
        }

        return response.data;
    } catch (error) {
        metrics.trackLLMRequest(model, 0, false, 0, 0);
        safeLog('error', 'OpenAI API call failed', {
            error: error.message,
            status: error.response?.status,
            errorDetails: error.response?.data?.error?.message,
            model
        });
        throw error;
    }
}

/**
 * Normalize analysis response to ensure consistent format regardless of model
 * GPT-5 models sometimes return different field names than expected
 * @param {Object} analysis - Raw analysis from LLM
 * @returns {Object} - Normalized analysis object
 */
function normalizeAnalysisResponse(analysis) {
    // Normalize field names (GPT-5 sometimes uses different formats)
    // Check multiple possible key names for hobbies/languages rating
    const hobbiesRating = analysis.hobbiesLanguagesRating 
        || analysis['Hobbies Languages'] 
        || analysis['hobbiesLanguages']
        || analysis['Hobbies & Languages']
        || analysis['hobbies_languages']
        || analysis['Languages & Hobbies']
        || analysis['languagesHobbiesRating']
        || '0%';
    
    const normalized = {
        name: analysis.name || analysis.Name || 'Candidat',
        title: analysis.title || analysis.Title || analysis['Professional Title'] || '',
        globalRating: analysis.globalRating || analysis['Global Rating'] || '0%',
        executiveSummaryRating: analysis.executiveSummaryRating || analysis['Executive Summary'] || '0%',
        skillsRating: analysis.skillsRating || analysis['Skills'] || '0%',
        experiencesRating: analysis.experiencesRating || analysis['Experience'] || '0%',
        educationRating: analysis.educationRating || analysis['Education'] || '0%',
        hobbiesLanguagesRating: hobbiesRating,
        atsOptimizationRating: analysis.atsOptimizationRating || analysis['ATS Compatibility'] || analysis['ATS'] || '0%',
        tags: analysis.tags || {
            skills: analysis['Top Skills'] || [],
            industries: analysis['Top Industries'] || [],
            tools: analysis['Top Tools'] || [],
            softSkills: analysis['Top Soft Skills'] || []
        },
        suggestions: analysis.suggestions || {
            executiveSummary: [],
            skills: [],
            experiences: [],
            education: [],
            hobbiesLanguages: [],
            atsOptimization: []
        }
    };
    
    // Also preserve the original flat format for backward compatibility
    normalized['Global Rating'] = normalized.globalRating;
    normalized['Executive Summary'] = normalized.executiveSummaryRating;
    normalized['Skills'] = normalized.skillsRating;
    normalized['Experience'] = normalized.experiencesRating;
    normalized['Education'] = normalized.educationRating;
    normalized['Hobbies Languages'] = normalized.hobbiesLanguagesRating;
    normalized['ATS Compatibility'] = normalized.atsOptimizationRating;
    normalized['Top Skills'] = normalized.tags.skills;
    normalized['Top Industries'] = normalized.tags.industries;
    normalized['Top Tools'] = normalized.tags.tools;
    normalized['Top Soft Skills'] = normalized.tags.softSkills;
    // Preserve suggestions structure by section for display in OverviewTab
    normalized['Key Improvements'] = normalized.suggestions;
    normalized['Summary'] = analysis['Summary'] || analysis.summary || '';
    
    // Preserve structuredText if provided by LLM (HTML-formatted version of the CV)
    if (analysis.structuredText) {
        normalized.structuredText = analysis.structuredText;
    }
    
    return normalized;
}

/**
 * Analyze a resume using OpenAI
 * @param {string} resumeText - The resume text to analyze
 * @param {string} model - OpenAI model to use
 * @param {string} analysisPrompt - The analysis prompt template
 * @param {Object} userMetadata - User metadata for logging
 * @param {boolean} isImprovedCV - Whether this is an improved CV (for logging purposes only)
 * @param {string} originalFileName - Original file name for name extraction hint
 * @returns {Promise<Object>} - Parsed analysis result
 */
export async function analyzeResume(resumeText, model, analysisPrompt, userMetadata = null, isImprovedCV = false, originalFileName = null) {
    let prompt = analysisPrompt.replace('{TEXT}', resumeText);
    
    // Inject original filename if available (helps LLM determine candidate name)
    if (originalFileName) {
        prompt = prompt.replace('{FILENAME}', originalFileName);
    } else {
        prompt = prompt.replace('{FILENAME}', 'Non disponible');
    }
    
    // Agnostic system message - same for all CVs
    const systemMessage = 'You are a JSON-only resume analysis API. Respond with valid JSON only.';

    const response = await callOpenAI({
        model,
        messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: prompt }
        ],
        maxTokens: 16000,
        temperature: 0.3,
        responseFormat: { type: "json_object" },
        maxPromptLength: 120000,
        userMetadata,
        operationType: isImprovedCV ? 'Improved Resume Analysis' : 'Resume Analysis'
    });

    let rawAnalysis;
    try {
        rawAnalysis = JSON.parse(response.choices[0].message.content);
    } catch (parseError) {
        safeLog('error', 'Failed to parse LLM analysis response as JSON', {
            error: parseError.message,
            responsePreview: response.choices[0].message.content.substring(0, 500)
        });
        throw new Error('Le modèle LLM a retourné une réponse invalide. Veuillez réessayer ou contacter le support si le problème persiste.');
    }
    
    // Debug logging to track tags and ratings
    safeLog('debug', 'Raw analysis from LLM', {
        allKeys: Object.keys(rawAnalysis),
        hasTags: !!rawAnalysis.tags,
        tagsContent: rawAnalysis.tags,
        hasTopSkills: !!rawAnalysis['Top Skills'],
        topSkillsContent: rawAnalysis['Top Skills'],
        hasSkills: !!rawAnalysis.skills,
        skillsContent: rawAnalysis.skills
    });
    
    const normalized = normalizeAnalysisResponse(rawAnalysis);
    
    safeLog('debug', 'Normalized analysis', {
        hasTags: !!normalized.tags,
        tagsSkillsCount: normalized.tags?.skills?.length || 0,
        tagsIndustriesCount: normalized.tags?.industries?.length || 0,
        tagsToolsCount: normalized.tags?.tools?.length || 0,
        tagsSoftSkillsCount: normalized.tags?.softSkills?.length || 0,
        tagsSkillsPreview: normalized.tags?.skills?.slice(0, 3),
        tagsToolsPreview: normalized.tags?.tools?.slice(0, 3)
    });
    
    return normalized;
}

/**
 * Improve resume text using OpenAI
 * @param {string} text - Resume text to improve
 * @param {Object} analysis - Analysis data
 * @param {string} model - OpenAI model to use
 * @param {string} improvementPromptTemplate - Improvement prompt template
 * @param {string} originalFileName - Original file name for name extraction hint
 * @param {Object} userMetadata - User metadata for logging
 * @returns {Promise<string>} - Improved resume text
 */
export async function improveResume(text, analysis, model, improvementPromptTemplate, originalFileName = null, userMetadata = null) {
    const analysisJson = JSON.stringify(analysis, null, 2);
    const fileNameValue = originalFileName || 'Non disponible';
    const improvementPrompt = improvementPromptTemplate
        .replace(/{ANALYSIS}/g, analysisJson)
        .replace(/{analysis}/g, analysisJson)
        .replace(/{TEXT}/g, text)
        .replace(/{text}/g, text)
        .replace(/{FILENAME}/g, fileNameValue)
        .replace(/{filename}/g, fileNameValue);

    // Debug: Log the full prompt sent to LLM (dev mode only)
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG_LLM === 'true') {
        safeLog('debug', '========== LLM IMPROVEMENT PROMPT DEBUG ==========');
        safeLog('debug', 'Model:', { model });
        safeLog('debug', 'Prompt length:', { length: improvementPrompt.length });
        safeLog('debug', '--- FULL PROMPT ---');
        safeLog('debug', improvementPrompt);
        safeLog('debug', '--- END PROMPT ---');
    }

    // Validate input text before calling LLM
    if (!text || text.trim().length < 100) {
        safeLog('error', 'Improvement input text too short', { 
            textLength: text?.length || 0,
            minRequired: 100
        });
        throw new Error('Le texte du CV est trop court pour être amélioré (minimum 100 caractères).');
    }

    const response = await callOpenAI({
        model,
        messages: [
            { role: 'system', content: 'You are a professional resume improvement assistant. You MUST respond with valid JSON only, following the exact structure specified in the user prompt. Do not include any text outside the JSON object.' },
            { role: 'user', content: improvementPrompt }
        ],
        maxTokens: 16384,  // Increased from 8192 to handle longer CVs
        temperature: 0.3,
        timeout: 300000,   // 5 minutes for complex CVs
        userMetadata,
        operationType: 'Resume Improvement'
    });

    let rawContent = response.choices[0].message.content
        .replace(/^```html\s*/i, '')
        .replace(/\s*```$/i, '')
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .trim();

    safeLog('info', 'LLM Improvement raw response preview:', { 
        isJSON: rawContent.startsWith('{'),
        hasImprovedText: rawContent.includes('"improvedText"'),
        preview: rawContent.substring(0, 300)
    });

    // Check if the response is JSON with improvedText field
    // The prompt asks for JSON format with improvedText, improvements, summary
    if (rawContent.startsWith('{') && rawContent.includes('"improvedText"')) {
        try {
            const parsed = JSON.parse(rawContent);
            
            // Clean up the HTML content
            const cleanedText = cleanupHtml(parsed.improvedText || '');
            
            // Validate that we have actual content
            if (!cleanedText || cleanedText.trim().length === 0) {
                safeLog('error', 'LLM returned empty improvedText in JSON response', {
                    hasImprovedText: !!parsed.improvedText,
                    improvedTextLength: parsed.improvedText?.length || 0,
                    cleanedTextLength: cleanedText?.length || 0
                });
                throw new Error('Le modèle LLM a retourné un CV amélioré vide. Veuillez réessayer.');
            }
            
            // Build analysis object from improvements
            const improvements = parsed.improvements || {};
            const summary = parsed.summary || {};
            
            // Return structured response for frontend
            const result = {
                text: cleanedText,
                analysis: {
                    globalRating: improvements.overall || 0,
                    executiveSummaryRating: improvements.executiveSummary || 0,
                    skillsRating: improvements.skills || 0,
                    experiencesRating: improvements.experience || 0,
                    educationRating: improvements.education || 0,
                    atsOptimizationRating: improvements.atsOptimization || 0,
                    hobbiesLanguagesRating: improvements.languagesInterests || 0,
                    suggestions: {}, // Post-improvement has no new suggestions
                    tags: {
                        skills: [],
                        industries: summary.industries || [],
                        tools: [],
                        softSkills: []
                    },
                    name: summary.title || analysis?.name || '',
                    title: summary.targetRole || analysis?.title || ''
                }
            };
            
            safeLog('info', 'Parsed improvement result:', {
                hasText: !!result.text,
                textLength: result.text?.length,
                analysis: result.analysis
            });
            
            return result;
        } catch (parseError) {
            safeLog('error', 'Failed to parse LLM improvement response as JSON', {
                error: parseError.message,
                responsePreview: rawContent.substring(0, 500)
            });
            throw new Error('Le modèle LLM a retourné une réponse JSON invalide pour l\'amélioration. Veuillez réessayer ou contacter le support si le problème persiste.');
        }
    }

    // Fallback: if response is plain HTML, return with empty analysis
    const cleanedText = cleanupHtml(rawContent);
    
    // Validate fallback content is not empty
    if (!cleanedText || cleanedText.trim().length === 0) {
        safeLog('error', 'LLM returned empty content in fallback (non-JSON) response', {
            rawContentLength: rawContent?.length || 0,
            cleanedTextLength: cleanedText?.length || 0,
            rawContentPreview: rawContent?.substring(0, 200)
        });
        throw new Error('Le modèle LLM a retourné une réponse vide. Veuillez réessayer.');
    }
    
    return {
        text: cleanedText,
        analysis: {
            globalRating: 0,
            executiveSummaryRating: 0,
            skillsRating: 0,
            experiencesRating: 0,
            educationRating: 0,
            atsOptimizationRating: 0,
            hobbiesLanguagesRating: 0,
            suggestions: {},
            tags: { skills: [], industries: [], tools: [], softSkills: [] },
            name: '',
            title: ''
        }
    };
}

/**
 * HTML entities mapping for text cleanup
 */
const HTML_ENTITIES = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&laquo;': '«',
    '&raquo;': '»',
    '&ldquo;': '\u201C',
    '&rdquo;': '\u201D',
    '&lsquo;': '\u2018',
    '&rsquo;': '\u2019',
    '&ndash;': '–',
    '&mdash;': '—',
    '&hellip;': '…',
    '&bull;': '•',
    '&middot;': '·',
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™',
    '&euro;': '€',
    '&pound;': '£',
    '&yen;': '¥',
    '&cent;': '¢',
    '&deg;': '°',
    '&plusmn;': '±',
    '&times;': '×',
    '&divide;': '÷',
    '&frac12;': '½',
    '&frac14;': '¼',
    '&frac34;': '¾',
    '&sup2;': '²',
    '&sup3;': '³',
    '&acute;': '´',
    '&cedil;': '¸',
    '&iexcl;': '¡',
    '&iquest;': '¿',
    '&sect;': '§',
    '&para;': '¶',
    '&dagger;': '†',
    '&Dagger;': '‡',
    '&permil;': '‰'
};

/**
 * Convert HTML entities to their corresponding characters
 * @param {string} text - Text with HTML entities
 * @returns {string} - Text with entities converted
 */
function decodeHtmlEntities(text) {
    if (!text) return text;
    
    let decoded = text;
    
    // Replace named HTML entities
    for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
        decoded = decoded.replace(new RegExp(entity, 'gi'), char);
    }
    
    // Replace numeric HTML entities (decimal: &#123; and hex: &#x7B;)
    decoded = decoded.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(parseInt(dec, 10)));
    decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
    
    return decoded;
}

/**
 * Clean up text by removing HTML tags and normalizing whitespace
 * Used before analysis to get cleaner text for LLM processing
 * @param {string} text - Text to clean (may contain HTML)
 * @returns {string} - Clean plain text
 */
export function cleanupText(text) {
    if (!text) return text;
    
    let cleaned = text;
    
    // Convert HTML entities first
    cleaned = decodeHtmlEntities(cleaned);
    
    // Convert <br> and </p> to newlines before removing tags
    cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n');
    cleaned = cleaned.replace(/<\/p>/gi, '\n');
    cleaned = cleaned.replace(/<\/li>/gi, '\n');
    cleaned = cleaned.replace(/<\/h[1-6]>/gi, '\n\n');
    
    // Remove all HTML tags
    cleaned = cleaned.replace(/<[^>]*>/g, '');
    
    // Normalize whitespace
    cleaned = cleaned.replace(/[ \t]+/g, ' ');  // Multiple spaces/tabs to single space
    cleaned = cleaned.replace(/\n[ \t]+/g, '\n');  // Remove leading spaces on lines
    cleaned = cleaned.replace(/[ \t]+\n/g, '\n');  // Remove trailing spaces on lines
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');  // Max 2 consecutive newlines
    
    return cleaned.trim();
}

/**
 * Clean up common HTML formatting issues from AI-generated content
 * Preserves HTML tags but fixes structural issues
 * Used after improvement to clean the improved_text field
 * @param {string} html - HTML content to clean
 * @returns {string} - Cleaned HTML
 */
function cleanupHtml(html) {
    if (!html) return html;
    
    let cleaned = html;
    
    // Convert HTML entities to their corresponding characters
    cleaned = decodeHtmlEntities(cleaned);
    
    // Remove nested <p> tags inside <li> elements
    cleaned = cleaned.replace(/<li>\s*<p>(.*?)<\/p>\s*<\/li>/gi, '<li>$1</li>');
    
    // Remove <p> tags wrapping <ul> or <ol> lists
    cleaned = cleaned.replace(/<p>\s*(<ul[^>]*>)/gi, '$1');
    cleaned = cleaned.replace(/(<\/ul>)\s*<\/p>/gi, '$1');
    cleaned = cleaned.replace(/<p>\s*(<ol[^>]*>)/gi, '$1');
    cleaned = cleaned.replace(/(<\/ol>)\s*<\/p>/gi, '$1');
    
    // Remove <p> tags wrapping headings
    cleaned = cleaned.replace(/<p>\s*(<h[1-6][^>]*>)/gi, '$1');
    cleaned = cleaned.replace(/(<\/h[1-6]>)\s*<\/p>/gi, '$1');
    
    // Remove empty <p> tags
    cleaned = cleaned.replace(/<p>\s*<\/p>/gi, '');
    
    // Remove <p> tags inside <p> tags (nested paragraphs)
    cleaned = cleaned.replace(/<p>\s*<p>/gi, '<p>');
    cleaned = cleaned.replace(/<\/p>\s*<\/p>/gi, '</p>');
    
    // Clean up multiple consecutive <br> tags
    cleaned = cleaned.replace(/(<br\s*\/?>\s*){3,}/gi, '<br><br>');
    
    // Remove <p> tags wrapping only whitespace and <br>
    cleaned = cleaned.replace(/<p>\s*(<br\s*\/?>\s*)*<\/p>/gi, '');
    
    return cleaned;
}

/**
 * Match resume with mission using OpenAI
 * @param {string} resumeText - Resume text
 * @param {string} missionTitle - Mission title
 * @param {string} missionContent - Mission content
 * @param {string} model - OpenAI model to use
 * @param {string} matchAnalysisPrompt - Match analysis prompt template
 * @returns {Promise<Object>} - Parsed match analysis result
 */
export async function matchResumeWithMission(resumeText, missionTitle, missionContent, model, matchAnalysisPrompt, userMetadata = null) {
    const prompt = matchAnalysisPrompt
        .replace('{RESUME_TEXT}', resumeText)
        .replace('{MISSION_TITLE}', missionTitle)
        .replace('{MISSION_CONTENT}', missionContent);

    const response = await callOpenAI({
        model,
        messages: [
            { role: 'system', content: 'You are a JSON-only resume-mission matching API. Respond with valid JSON only.' },
            { role: 'user', content: prompt }
        ],
        maxTokens: 2048,
        temperature: 0.3,
        responseFormat: { type: "json_object" },
        userMetadata,
        operationType: 'Resume-Mission Matching'
    });

    try {
        return JSON.parse(response.choices[0].message.content);
    } catch (parseError) {
        safeLog('error', 'Failed to parse LLM matching response as JSON', {
            error: parseError.message,
            responsePreview: response.choices[0].message.content.substring(0, 500)
        });
        throw new Error('Le modèle LLM a retourné une réponse invalide pour le matching. Veuillez réessayer ou contacter le support si le problème persiste.');
    }
}

/**
 * Adapt resume to mission using OpenAI
 * @param {Object} params - Adaptation parameters
 * @param {string} params.resumeText - Resume text
 * @param {string} params.resumeAnalysis - Resume analysis
 * @param {string} params.missionTitle - Mission title
 * @param {string} params.missionContent - Mission content
 * @param {Object} params.matchAnalysis - Match analysis result
 * @param {string} params.model - OpenAI model to use
 * @param {string} params.adaptationPrompt - Adaptation prompt template
 * @returns {Promise<string>} - Adapted resume text
 */
export async function adaptResumeToMission({
    resumeText,
    resumeAnalysis,
    missionTitle,
    missionContent,
    matchAnalysis,
    model,
    adaptationPrompt,
    userMetadata = null
}) {
    const prompt = adaptationPrompt
        .replace('{RESUME_TEXT}', resumeText)
        .replace('{RESUME_ANALYSIS}', resumeAnalysis || 'No analysis available')
        .replace('{MISSION_TITLE}', missionTitle)
        .replace('{MISSION_CONTENT}', missionContent)
        .replace('{MATCH_ANALYSIS}', JSON.stringify(matchAnalysis, null, 2));

    const response = await callOpenAI({
        model,
        messages: [
            { role: 'system', content: 'You are an expert HR consultant. Provide adapted resumes in clean HTML format. Do NOT wrap your response in markdown code blocks.' },
            { role: 'user', content: prompt }
        ],
        maxTokens: 4096,
        temperature: 0.4,
        timeout: 120000,
        userMetadata,
        operationType: 'Resume Adaptation'
    });

    // Clean markdown code blocks if present
    let content = response.choices[0].message.content;
    content = content.replace(/^```html\s*/i, '').replace(/```\s*$/i, '').trim();
    return content;
}

// ============================================
// CIRCUIT BREAKER WRAPPED FUNCTIONS
// ============================================

/**
 * Call OpenAI API with circuit breaker protection
 * Wraps callOpenAI with retry logic and circuit breaker pattern
 * @param {Object} params - Same parameters as callOpenAI
 * @returns {Promise<Object>} - OpenAI response data
 */
export async function callOpenAIWithCircuitBreaker(params) {
    const operationName = params.operationType || 'OpenAI API call';
    
    return withRetry(
        () => callOpenAI(params),
        {
            serviceName: 'openai',
            operationName,
            retryConfig: {
                maxRetries: 2,
                initialDelayMs: 2000,
                maxDelayMs: 30000
            }
        }
    );
}

/**
 * Get OpenAI circuit breaker status
 * @returns {Object} Circuit breaker state for OpenAI
 */
export function getOpenAICircuitBreakerStatus() {
    const states = getCircuitBreakerStates();
    return states.openai || { state: 'UNKNOWN', failures: 0 };
}
