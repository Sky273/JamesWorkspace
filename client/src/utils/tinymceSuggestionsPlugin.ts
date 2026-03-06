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

// Section markers to identify where to place suggestions (expanded for better detection)
const SECTION_MARKERS: Record<string, string[]> = {
  executiveSummary: ['profil', 'résumé', 'summary', 'profile', 'présentation', 'introduction', 'objectif', 'sommaire', 'à propos', 'about'],
  skills: ['compétences', 'skills', 'technologies', 'outils', 'expertise', 'savoir-faire', 'compétences techniques', 'technical skills', 'stack technique', 'environnement technique'],
  experiences: ['expérience', 'experience', 'parcours', 'missions', 'postes', 'emplois', 'expériences professionnelles', 'professional experience', 'work experience', 'historique'],
  education: ['formation', 'education', 'diplômes', 'études', 'certifications', 'académique', 'cursus', 'scolarité', 'diplôme'],
  hobbiesLanguages: ['langues', 'languages', 'loisirs', 'hobbies', 'centres d\'intérêt', 'interests', 'activités', 'divers', 'autres'],
  atsOptimization: [] // Global suggestions, shown in panel at top
};

// Section labels for display in the global panel
const SECTION_LABELS: Record<string, string> = {
  executiveSummary: 'Résumé exécutif',
  skills: 'Compétences',
  experiences: 'Expérience',
  education: 'Formation',
  hobbiesLanguages: 'Langues & Loisirs',
  atsOptimization: 'Optimisation ATS'
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
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 13px;
    max-width: 400px;
    z-index: 10000;
    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    line-height: 1.5;
  }
  .suggestion-panel {
    background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);
    border: 1px solid #F59E0B;
    border-radius: 12px;
    padding: 16px 20px;
    margin-bottom: 20px;
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.15);
  }
  .suggestion-panel-header {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 600;
    color: #92400E;
    font-size: 15px;
    margin-bottom: 12px;
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(146, 64, 14, 0.2);
  }
  .suggestion-panel-list {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .suggestion-panel-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 8px 12px;
    margin-bottom: 6px;
    background: rgba(255, 255, 255, 0.6);
    border-radius: 8px;
    color: #78350F;
    font-size: 13px;
    line-height: 1.4;
    transition: background 0.2s;
  }
  .suggestion-panel-item:hover {
    background: rgba(255, 255, 255, 0.9);
  }
  .suggestion-panel-item-icon {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #F59E0B;
    color: white;
    border-radius: 50%;
    font-size: 11px;
    font-weight: bold;
  }
  .suggestion-panel-item-text {
    flex: 1;
  }
  .suggestion-section-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);
    border: 1px solid #F59E0B;
    border-radius: 20px;
    padding: 4px 12px;
    font-size: 12px;
    color: #92400E;
    font-weight: 500;
    margin-left: 8px;
    cursor: help;
    box-shadow: 0 2px 4px rgba(245, 158, 11, 0.2);
  }
  .suggestion-highlight-wrapper {
    position: relative;
    background: linear-gradient(to right, rgba(254, 249, 195, 0.5), rgba(255, 251, 235, 0.3));
    border-left: 4px solid #F59E0B;
    padding-left: 12px;
    margin-left: -16px;
    border-radius: 0 8px 8px 0;
  }
`;

// Unicode icons for markers (TinyMCE filters SVG for security)
const ICONS = {
  warning: '💡',
  error: '❌',
  info: 'ℹ️'
};

// Styles for highlighted sections - clean design without emoji, using only border accent
const HIGHLIGHT_STYLE = 'background: linear-gradient(to right, rgba(254, 249, 195, 0.6), rgba(255, 251, 235, 0.2)); border-left: 4px solid #F59E0B; padding: 8px 12px 8px 16px; margin: 4px 0 4px -16px; border-radius: 0 8px 8px 0; box-shadow: 0 2px 8px rgba(245, 158, 11, 0.1);';

// Badge style for suggestion count - now includes the lightbulb icon
const BADGE_STYLE = 'display: inline-flex; align-items: center; gap: 4px; background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); color: white; border-radius: 12px; padding: 3px 10px; font-size: 11px; font-weight: 600; margin-left: 10px; box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3); cursor: help; vertical-align: middle;';

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
 * Adds badges on detected section headers with tooltips showing suggestions
 */
function insertSuggestionsIntoContent(content: string, suggestions: SuggestionsBySection): string {
  let modifiedContent = content;
  const sectionPositions = findSectionPositions(content);
  
  logger.info('[SuggestionsPlugin] Section positions found:', Array.from(sectionPositions.entries()));
  logger.info('[SuggestionsPlugin] Suggestions to insert:', suggestions);
  
  // Count total suggestions
  const totalSuggestions = Object.values(suggestions).flat().filter(Boolean).length;
  
  if (totalSuggestions === 0) {
    logger.info('[SuggestionsPlugin] No suggestions to display');
    return modifiedContent;
  }
  
  // If no sections found in content, add a global suggestions panel at the top
  if (sectionPositions.size === 0) {
    logger.info('[SuggestionsPlugin] No sections found in content, adding global suggestions panel');
    const globalPanel = createGroupedSuggestionsPanel(suggestions);
    if (globalPanel) {
      return globalPanel + modifiedContent;
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
    
    // Create tooltip with all suggestions for this section - formatted as list
    const tooltipLines = sectionSuggestions.map((s, i) => `${i + 1}. ${s}`).join('&#10;');
    const tooltipText = tooltipLines.replace(/"/g, '&quot;');
    
    // Create a badge showing suggestion count
    const suggestionBadge = `<span style="${BADGE_STYLE}" title="${tooltipText}">💡 ${sectionSuggestions.length}</span>`;
    
    // Wrap with highlight div and badge after the header (no emoji on the left, just the border accent)
    // Insert badge right after the closing tag of the header element
    const elementWithBadge = fullElement.replace(/(<\/[a-z][a-z0-9]*>)$/i, `${suggestionBadge}$1`);
    const highlightedElement = `<div style="${HIGHLIGHT_STYLE}" class="suggestion-highlight" title="${tooltipText}">${elementWithBadge}</div>`;
    
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
 * Displays suggestions grouped by section with improved styling
 */
function createSuggestionsPanel(suggestions: string[], sectionKey?: string): string {
  // Display ALL suggestions
  const items = suggestions.map((s, index) => 
    `<li style="display: flex; align-items: flex-start; gap: 10px; padding: 8px 12px; margin-bottom: 6px; background: rgba(255, 255, 255, 0.6); border-radius: 8px; color: #78350F; font-size: 13px; line-height: 1.4;">
      <span style="flex-shrink: 0; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; background: #F59E0B; color: white; border-radius: 50%; font-size: 11px; font-weight: bold;">${index + 1}</span>
      <span style="flex: 1;">${s}</span>
    </li>`
  ).join('');
  
  const title = sectionKey ? SECTION_LABELS[sectionKey] || 'Suggestions' : 'Suggestions d\'amélioration';
  
  return `
    <div class="suggestion-panel" style="background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%); border: 1px solid #F59E0B; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.15);">
      <div style="display: flex; align-items: center; gap: 10px; font-weight: 600; color: #92400E; font-size: 15px; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid rgba(146, 64, 14, 0.2);">
        <span style="font-size: 1.3em;">💡</span>
        <span>${title}</span>
        <span style="background: #92400E; color: white; border-radius: 10px; padding: 2px 8px; font-size: 12px; margin-left: auto;">${suggestions.length}</span>
      </div>
      <ul style="margin: 0; padding: 0; list-style: none;">${items}</ul>
    </div>
  `;
}

/**
 * Create a comprehensive suggestions panel grouped by section
 */
function createGroupedSuggestionsPanel(suggestions: SuggestionsBySection): string {
  const sections: string[] = [];
  let totalCount = 0;
  
  // Order of sections to display
  const sectionOrder: (keyof SuggestionsBySection)[] = [
    'executiveSummary', 'skills', 'experiences', 'education', 'hobbiesLanguages', 'atsOptimization'
  ];
  
  for (const sectionKey of sectionOrder) {
    const sectionSuggestions = suggestions[sectionKey];
    if (!sectionSuggestions || sectionSuggestions.length === 0) continue;
    
    totalCount += sectionSuggestions.length;
    const label = SECTION_LABELS[sectionKey] || sectionKey;
    
    const items = sectionSuggestions.map((s) => 
      `<li style="display: flex; align-items: flex-start; gap: 8px; padding: 6px 10px; margin-bottom: 4px; background: rgba(255, 255, 255, 0.5); border-radius: 6px; color: #78350F; font-size: 12px; line-height: 1.4;">
        <span style="color: #F59E0B; font-weight: bold;">•</span>
        <span style="flex: 1;">${s}</span>
      </li>`
    ).join('');
    
    sections.push(`
      <div style="margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 8px; font-weight: 600; color: #92400E; font-size: 13px; margin-bottom: 6px;">
          <span>${label}</span>
          <span style="background: rgba(146, 64, 14, 0.2); color: #92400E; border-radius: 8px; padding: 1px 6px; font-size: 11px;">${sectionSuggestions.length}</span>
        </div>
        <ul style="margin: 0; padding: 0; list-style: none;">${items}</ul>
      </div>
    `);
  }
  
  if (sections.length === 0) return '';
  
  return `
    <div class="suggestion-panel" style="background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%); border: 1px solid #F59E0B; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.15);">
      <div style="display: flex; align-items: center; gap: 10px; font-weight: 600; color: #92400E; font-size: 15px; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid rgba(146, 64, 14, 0.2);">
        <span style="font-size: 1.3em;">💡</span>
        <span>Suggestions d'amélioration</span>
        <span style="background: #92400E; color: white; border-radius: 10px; padding: 2px 8px; font-size: 12px; margin-left: auto;">${totalCount}</span>
      </div>
      ${sections.join('')}
    </div>
  `;
}

/**
 * Remove all suggestion markers from content
 * Exported for use when saving content without suggestions
 */
export function removeSuggestionMarkers(content: string): string {
  // Remove suggestion badges (the orange pill with count) - multiple patterns to catch all variants
  let cleaned = content.replace(/<span[^>]*title="[^"]*"[^>]*>💡\s*\d+<\/span>/g, '');
  // Remove orange gradient badges (BADGE_STYLE pattern: background: linear-gradient(135deg, #F59E0B...)
  cleaned = cleaned.replace(/<span[^>]*style="[^"]*background:\s*linear-gradient\(135deg,\s*#F59E0B[^"]*"[^>]*>.*?<\/span>/g, '');
  // Remove any span with lightbulb emoji and a number (generic pattern)
  cleaned = cleaned.replace(/<span[^>]*>[\s]*💡[\s]*\d+[\s]*<\/span>/g, '');
  // Remove highlight wrappers but keep inner content
  cleaned = cleaned.replace(/<div[^>]*class="suggestion-highlight"[^>]*>/g, '');
  cleaned = cleaned.replace(/<\/div>(\s*<\/div>)?/g, (match, group1) => group1 ? '</div>' : '');
  // Remove suggestions panel - match the entire panel structure (greedy match for nested divs)
  // This handles both inline style and class-based panels
  cleaned = cleaned.replace(/<div[^>]*class="suggestion-panel"[^>]*>[\s\S]*?<\/ul>\s*(<\/div>\s*)*<\/div>/g, '');
  // Remove panels with inline gradient style (for global panel)
  cleaned = cleaned.replace(/<div[^>]*style="[^"]*background:\s*linear-gradient\(135deg,\s*#FEF3C7[^"]*"[^>]*>[\s\S]*?<\/ul>\s*(<\/div>\s*)*<\/div>/g, '');
  // Remove old style panels
  cleaned = cleaned.replace(/<div style="background: #FEF3C7[^>]*>[\s\S]*?<\/div>\s*<\/div>/g, '');
  cleaned = cleaned.replace(/<div style="background: linear-gradient[^>]*>[\s\S]*?<\/div>\s*<\/div>/g, '');
  // Remove any remaining lightbulb spans (legacy)
  cleaned = cleaned.replace(/<span[^>]*>💡<\/span>/g, '');
  // Remove any span containing only lightbulb and/or numbers (catch-all for badge variants)
  cleaned = cleaned.replace(/<span[^>]*style="[^"]*#F59E0B[^"]*"[^>]*>[^<]*<\/span>/g, '');
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
 * Parse suggestions from JSON string or object
 * Handles various formats from the analysis API
 */
export function parseSuggestions(suggestionsJson: string | object | undefined): SuggestionsBySection {
  if (!suggestionsJson) {
    logger.info('[SuggestionsPlugin] No suggestions provided');
    return {};
  }
  
  try {
    let parsed: unknown;
    
    if (typeof suggestionsJson === 'string') {
      // Try to parse JSON string
      parsed = JSON.parse(suggestionsJson);
    } else {
      // Already an object
      parsed = suggestionsJson;
    }
    
    if (typeof parsed === 'object' && parsed !== null) {
      const suggestions = parsed as SuggestionsBySection;
      
      // Log what we found
      const sectionCounts = Object.entries(suggestions)
        .filter(([, v]) => Array.isArray(v) && v.length > 0)
        .map(([k, v]) => `${k}: ${(v as string[]).length}`);
      
      logger.info('[SuggestionsPlugin] Parsed suggestions:', {
        sections: sectionCounts,
        total: Object.values(suggestions).flat().filter(Boolean).length
      });
      
      return suggestions;
    }
  } catch (err) {
    logger.warn('[SuggestionsPlugin] Failed to parse suggestions:', err);
  }
  
  return {};
}

export type { SuggestionsBySection, SuggestionsPluginConfig };
