/**
 * TagsWithTooltip - Displays tags with a hover tooltip that renders via portal
 * to avoid being clipped by parent overflow constraints
 * Extracted from DealsGroupedView.tsx
 */

import { useState, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

interface TagsWithTooltipProps {
  skills: string[];
  industries: string[];
  resumeTags: Record<string, string[]>;
  hasAnyTags: boolean;
  tagColorMap: Record<string, string>;
  t: ReturnType<typeof useTranslation>['t'];
}

const TagsWithTooltip = memo(({ skills, industries, resumeTags, hasAnyTags, tagColorMap, t }: TagsWithTooltipProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (triggerRef.current && hasAnyTags) {
      const rect = triggerRef.current.getBoundingClientRect();
      // Position tooltip above the trigger, aligned to the right
      setTooltipPosition({
        top: rect.top - 8, // 8px gap above
        left: Math.max(16, rect.right - 350) // Align right edge, but keep 16px from left edge
      });
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  return (
    <div 
      ref={triggerRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex flex-wrap gap-1 cursor-pointer">
        {skills.map((tag, i) => (
          <span key={`s-${i}`} className={`text-xs px-1.5 py-0.5 rounded-full ${tagColorMap.skills}`}>{tag}</span>
        ))}
        {industries.map((tag, i) => (
          <span key={`i-${i}`} className={`text-xs px-1.5 py-0.5 rounded-full ${tagColorMap.industries}`}>{tag}</span>
        ))}
      </div>
      {isHovered && hasAnyTags && createPortal(
        <div 
          className="fixed z-[9999] pointer-events-none"
          style={{ 
            top: tooltipPosition.top,
            left: tooltipPosition.left,
            transform: 'translateY(-100%)'
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-3 min-w-[280px] max-w-[350px]">
            <div className="space-y-2">
              {(resumeTags.skills?.length || 0) > 0 && (
                <div>
                  <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">{t('resumes.filters.skills')}</div>
                  <div className="flex flex-wrap gap-1">
                    {resumeTags.skills.map((tag, i) => (
                      <span key={`ts-${i}`} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
              {(resumeTags.industries?.length || 0) > 0 && (
                <div>
                  <div className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-1">{t('resumes.filters.industries')}</div>
                  <div className="flex flex-wrap gap-1">
                    {resumeTags.industries.map((tag, i) => (
                      <span key={`ti-${i}`} className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
              {(resumeTags.tools?.length || 0) > 0 && (
                <div>
                  <div className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1">{t('resumes.filters.tools')}</div>
                  <div className="flex flex-wrap gap-1">
                    {resumeTags.tools.map((tag, i) => (
                      <span key={`tt-${i}`} className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
              {(resumeTags.soft_skills?.length || 0) > 0 && (
                <div>
                  <div className="text-xs font-semibold text-yellow-700 dark:text-yellow-300 mb-1">{t('resumes.filters.softskills')}</div>
                  <div className="flex flex-wrap gap-1">
                    {resumeTags.soft_skills.map((tag, i) => (
                      <span key={`tss-${i}`} className="text-xs px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="absolute bottom-0 right-4 translate-y-full">
              <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white dark:border-t-gray-800"></div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
});

// Display name for debugging
TagsWithTooltip.displayName = 'TagsWithTooltip';

export default TagsWithTooltip;
