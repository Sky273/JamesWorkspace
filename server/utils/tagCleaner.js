/**
 * Tag Cleaner Utility
 * Cleans and normalizes tags extracted from resume analysis
 * - trim
 * - preserve full technical terms (no splitting)
 * - preserve original case
 * 
 * Note: This function is kept for future intelligence additions
 */

/**
 * Clean a single tag - trim only, preserve original case
 * @param {string} tag - The tag to clean
 * @returns {string} - Cleaned tag
 */
function cleanTag(tag) {
    if (!tag || typeof tag !== 'string') return '';
    
    // Simple trim only - preserve original case for future processing
    const normalized = tag.trim();
    
    return normalized;
}

/**
 * Clean all tags in an array
 * @param {string[]} tags - Array of tags to clean
 * @returns {string[]} - Array of cleaned, unique, sorted tags
 */
function cleanTagsArray(tags) {
    if (!Array.isArray(tags)) return [];
    
    const allCleaned = [];
    
    for (const tag of tags) {
        const cleaned = cleanTag(tag);
        if (cleaned) {
            allCleaned.push(cleaned);
        }
    }
    
    // Remove duplicates and sort
    return [...new Set(allCleaned)].sort();
}

/**
 * Clean tags object with multiple categories
 * @param {Object} tagsObj - Object with category keys and tag arrays
 * @returns {Object} - Object with cleaned tags for each category
 */
function cleanTagsObject(tagsObj) {
    if (!tagsObj || typeof tagsObj !== 'object') return {};
    
    const result = {};
    
    for (const [category, tags] of Object.entries(tagsObj)) {
        if (Array.isArray(tags)) {
            result[category] = cleanTagsArray(tags);
        }
    }
    
    return result;
}

/**
 * Clean tags from analysis data and return both raw and cleaned versions
 * @param {Object} analysisData - The analysis data containing tags
 * @returns {Object} - Object with rawTags and cleanedTags
 */
function processAnalysisTags(analysisData) {
    // Always return objects with all expected properties as arrays
    const emptyTags = {
        skills: [],
        industries: [],
        tools: [],
        softSkills: []
    };
    
    if (!analysisData || !analysisData.tags) {
        return { rawTags: emptyTags, cleanedTags: emptyTags };
    }
    
    const rawTags = {
        skills: Array.isArray(analysisData.tags.skills) ? analysisData.tags.skills : [],
        industries: Array.isArray(analysisData.tags.industries) ? analysisData.tags.industries : [],
        tools: Array.isArray(analysisData.tags.tools) ? analysisData.tags.tools : [],
        softSkills: Array.isArray(analysisData.tags.softSkills) ? analysisData.tags.softSkills : []
    };
    
    const cleanedTags = {
        skills: cleanTagsArray(rawTags.skills),
        industries: cleanTagsArray(rawTags.industries),
        tools: cleanTagsArray(rawTags.tools),
        softSkills: cleanTagsArray(rawTags.softSkills)
    };
    
    return { rawTags, cleanedTags };
}

export {
    cleanTag,
    cleanTagsArray,
    cleanTagsObject,
    processAnalysisTags
};
