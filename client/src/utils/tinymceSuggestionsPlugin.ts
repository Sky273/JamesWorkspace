/**
 * TinyMCE Suggestions Plugin
 * Displays improvement suggestions as inline annotations in the editor
 */

import { TinyMCEEditor } from '../types/tinymce.d';
import logger from './logger.frontend';

interface SuggestionsBySection {
  executiveSummary?: string[];
  skills?: string[];
  experiences?: string[];
  education?: string[];
  hobbiesLanguages?: string[];
  atsOptimization?: string[];
}

interface SuggestionsPluginConfig {
  suggestions: SuggestionsBySection;
  onToggle?: (visible: boolean) => void;
}

// Section markers to identify where to place suggestions
const SECTION_MARKERS: Record<string, string[]> = {
  executiveSummary: ['profil', 'résumé', 'summary', 'profile', 'présentation', 'introduction', 'objectif'],
  skills: ['compétences', 'skills', 'technologies', 'outils', 'expertise', 'savoir-faire'],
  experiences: ['expérience', 'experience', 'parcours', 'missions', 'postes', 'emplois'],
  education: ['formation', 'education', 'diplômes', 'études', 'certifications', 'académique'],
  hobbiesLanguages: ['langues', 'languages', 'loisirs', 'hobbies', 'centres d\'intérêt', 'interests'],
  atsOptimization: [] // Global suggestions, shown at top
};

// CSS styles for suggestion markers
const SUGGESTION_STYLES = `
  .suggestion-marker {
    display: inline-flex;
    align-items: center;
    margin-left: 4px;
    cursor: help;
  }
  .suggestion-marker-warning {
    color: #D97706;
  }
  .suggestion-marker-error {
    color: #DC2626;
  }
  .suggestion-marker-info {
    color: #2563EB;
  }
  .suggestion-section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }
  .suggestion-section-icon {
    width: 16px;
    height: 16px;
    display: inline-block;
  }
  .suggestion-tooltip {
    position: absolute;
    background: #1F2937;
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    max-width: 300px;
    z-index: 10000;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  }
`;

// Unicode icons for markers (TinyMCE filters SVG for security)
const ICONS = {
  warning: '💡',
  error: '❌',
  info: 'ℹ️'
};

// Styles for highlighted sections
const HIGHLIGHT_STYLE = 'background: linear-gradient(to right, #FEF9C3, #FFFBEB); border-left: 3px solid #F59E0B; padding-left: 8px; margin-left: -11px; display: flex; align-items: flex-start;';

// Lightbulb style that adapts to text size
const LIGHTBULB_STYLE = 'margin-right: 6px; font-size: 0.9em; line-height: inherit;';

let suggestionsVisible = true; // Show suggestions by default
let originalContent = '';

/**
 * Find section headers in the content and return their positions
 */
function findSectionPositions(content: string): Map<string, number> {
  const positions = new Map<string, number>();
  const lowerContent = content.toLowerCase();
  
  for (const [section, markers] of Object.entries(SECTION_MARKERS)) {
    for (const marker of markers) {
      const index = lowerContent.indexOf(marker);
      if (index !== -1) {
        positions.set(section, index);
        break;
      }
    }
  }
  
  return positions;
}

/**
 * Create suggestion marker HTML
 */
function createSuggestionMarker(suggestion: string, type: 'warning' | 'error' | 'info' = 'warning'): string {
  const icon = ICONS[type];
  // Use simple span with inline styles (TinyMCE may strip classes)
  const color = type === 'error' ? '#DC2626' : type === 'info' ? '#2563EB' : '#D97706';
  return `<span style="cursor:help;color:${color};margin-left:4px;" title="${suggestion.replace(/"/g, '&quot;')}">${icon}</span>`;
}

/**
 * Insert suggestions into content near relevant sections
 * Wraps the section header line with highlight styling and adds lightbulb icon at the start
 */
function insertSuggestionsIntoContent(content: string, suggestions: SuggestionsBySection): string {
  let modifiedContent = content;
  const sectionPositions = findSectionPositions(content);
  
  logger.info('[SuggestionsPlugin] Section positions found:', Array.from(sectionPositions.entries()));
  logger.info('[SuggestionsPlugin] Suggestions to insert:', suggestions);
  
  // If no sections found, add suggestions at the beginning
  if (sectionPositions.size === 0) {
    logger.info('[SuggestionsPlugin] No sections found, adding global suggestions panel');
    const allSuggestions = Object.values(suggestions).flat().filter(Boolean);
    if (allSuggestions.length > 0) {
      const suggestionsPanel = createSuggestionsPanel(allSuggestions);
      modifiedContent = suggestionsPanel + modifiedContent;
    }
    return modifiedContent;
  }
  
  // Sort sections by position (descending) to insert from end to start
  const sortedSections = Array.from(sectionPositions.entries())
    .sort((a, b) => b[1] - a[1]);
  
  for (const [section, position] of sortedSections) {
    const sectionSuggestions = suggestions[section as keyof SuggestionsBySection];
    logger.info(`[SuggestionsPlugin] Section ${section} at position ${position}:`, sectionSuggestions);
    
    if (!sectionSuggestions || sectionSuggestions.length === 0) continue;
    
    // Find the last opening tag before this position
    const beforePosition = modifiedContent.substring(0, position);
    const lastOpenTagIndex = beforePosition.lastIndexOf('<');
    
    if (lastOpenTagIndex === -1) {
      logger.info(`[SuggestionsPlugin] No opening tag found for section ${section}`);
      continue;
    }
    
    // Find the closing tag after this position (look for </tagname>)
    const afterPosition = modifiedContent.substring(position);
    const closeTagMatch = afterPosition.match(/<\/[a-z][a-z0-9]*>/i);
    
    if (!closeTagMatch || closeTagMatch.index === undefined) {
      logger.info(`[SuggestionsPlugin] No closing tag found for section ${section}`);
      continue;
    }
    
    const tagEndPos = position + closeTagMatch.index + closeTagMatch[0].length;
    
    // Get the full element
    const fullElement = modifiedContent.substring(lastOpenTagIndex, tagEndPos);
    logger.info(`[SuggestionsPlugin] Full element for ${section}:`, fullElement.substring(0, 100));
    
    // Create tooltip with all suggestions for this section
    const tooltipText = sectionSuggestions.join(' | ').replace(/"/g, '&quot;');
    
    // Wrap with highlight div and add lightbulb at the start
    const highlightedElement = `<div style="${HIGHLIGHT_STYLE}" class="suggestion-highlight" title="${tooltipText}"><span style="${LIGHTBULB_STYLE}">💡</span>${fullElement}</div>`;
    
    logger.info(`[SuggestionsPlugin] Wrapping element from ${lastOpenTagIndex} to ${tagEndPos}`);
    
    modifiedContent = 
      modifiedContent.slice(0, lastOpenTagIndex) + 
      highlightedElement + 
      modifiedContent.slice(tagEndPos);
  }
  
  return modifiedContent;
}

/**
 * Create a suggestions panel to display at the top of the content
 */
function createSuggestionsPanel(suggestions: string[]): string {
  const items = suggestions.slice(0, 6).map(s => 
    `<li style="margin-bottom: 4px; color: #D97706;">${ICONS.warning} ${s}</li>`
  ).join('');
  
  return `
    <div style="background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
      <div style="font-weight: bold; color: #92400E; margin-bottom: 8px;">💡 Suggestions d'amélioration</div>
      <ul style="margin: 0; padding-left: 20px; list-style: none;">${items}</ul>
    </div>
  `;
}

/**
 * Remove all suggestion markers from content
 */
function removeSuggestionMarkers(content: string): string {
  // Remove highlight wrappers but keep inner content
  let cleaned = content.replace(/<div[^>]*class="suggestion-highlight"[^>]*><span[^>]*>💡<\/span>/g, '');
  cleaned = cleaned.replace(/<\/div>(\s*<\/div>)?/g, (match, group1) => group1 ? '</div>' : '');
  // Remove suggestions panel
  cleaned = cleaned.replace(/<div style="background: #FEF3C7[^>]*>[\s\S]*?<\/div>\s*<\/div>/g, '');
  // Remove any remaining lightbulb spans
  cleaned = cleaned.replace(/<span[^>]*>💡<\/span>/g, '');
  return cleaned;
}

/**
 * Register the suggestions plugin with TinyMCE
 */
export function registerSuggestionsPlugin(
  editor: TinyMCEEditor, 
  config: SuggestionsPluginConfig
): void {
  // Add custom styles to editor
  editor.on('init', () => {
    const doc = editor.getDoc();
    if (doc) {
      const style = doc.createElement('style');
      style.textContent = SUGGESTION_STYLES;
      doc.head.appendChild(style);
    }
    
    // Apply suggestions by default after a short delay to ensure content is loaded
    if (suggestionsVisible && Object.keys(config.suggestions).length > 0) {
      setTimeout(() => {
        originalContent = editor.getContent();
        if (originalContent) {
          const contentWithSuggestions = insertSuggestionsIntoContent(originalContent, config.suggestions);
          if (contentWithSuggestions !== originalContent) {
            editor.setContent(contentWithSuggestions);
            logger.info('[SuggestionsPlugin] Applied suggestions on init');
          }
        }
      }, 100);
    }
  });
  
  // Register toggle button
  editor.ui.registry.addToggleButton('suggestions', {
    text: suggestionsVisible ? '✓ Suggestions' : 'Suggestions',
    tooltip: 'Afficher/masquer les suggestions d\'amélioration',
    onAction: () => {
      suggestionsVisible = !suggestionsVisible;
      
      logger.info('[SuggestionsPlugin] Toggle suggestions:', { 
        visible: suggestionsVisible, 
        suggestionsCount: Object.keys(config.suggestions).length,
        suggestions: config.suggestions
      });
      
      if (suggestionsVisible) {
        // Store original content and insert suggestions
        originalContent = editor.getContent();
        logger.info('[SuggestionsPlugin] Original content length:', originalContent.length);
        
        const contentWithSuggestions = insertSuggestionsIntoContent(
          originalContent, 
          config.suggestions
        );
        logger.info('[SuggestionsPlugin] Content with suggestions length:', contentWithSuggestions.length);
        logger.info('[SuggestionsPlugin] Content changed:', originalContent !== contentWithSuggestions);
        
        editor.setContent(contentWithSuggestions);
      } else {
        // Restore original content (without markers)
        const currentContent = editor.getContent();
        const cleanContent = removeSuggestionMarkers(currentContent);
        editor.setContent(cleanContent);
      }
      
      config.onToggle?.(suggestionsVisible);
    },
    onSetup: (api) => {
      api.setActive(suggestionsVisible);
      return () => {};
    }
  });
  
  // Add tooltip behavior for suggestion markers
  editor.on('mouseover', (e: unknown) => {
    const event = e as MouseEvent;
    const target = event.target as HTMLElement;
    if (target.classList?.contains('suggestion-marker')) {
      const suggestion = decodeURIComponent(target.dataset.suggestion || '');
      if (suggestion) {
        // Show tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'suggestion-tooltip';
        tooltip.textContent = suggestion;
        tooltip.style.left = `${event.pageX + 10}px`;
        tooltip.style.top = `${event.pageY + 10}px`;
        document.body.appendChild(tooltip);
        
        target.addEventListener('mouseout', () => {
          tooltip.remove();
        }, { once: true });
      }
    }
  });
}

/**
 * Parse suggestions from JSON string
 */
export function parseSuggestions(suggestionsJson: string | undefined): SuggestionsBySection {
  if (!suggestionsJson) return {};
  
  try {
    const parsed = typeof suggestionsJson === 'string' 
      ? JSON.parse(suggestionsJson) 
      : suggestionsJson;
    
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as SuggestionsBySection;
    }
  } catch {
    // Ignore parsing errors
  }
  
  return {};
}

export type { SuggestionsBySection, SuggestionsPluginConfig };
