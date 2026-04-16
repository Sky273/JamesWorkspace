/**
 * TagsWithTooltip - Displays tags with a hover tooltip that renders via portal
 * to avoid being clipped by parent overflow constraints
 * Extracted from DealsGroupedView.tsx
 */

import { useEffect, useRef, useState, memo } from 'react';
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
  const [tooltipPosition, setTooltipPosition] = useState({
    top: 0,
    left: 0,
    placement: 'top' as 'top' | 'bottom',
  });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const updateTooltipPosition = () => {
    if (!triggerRef.current || !hasAnyTags) {
      return;
    }

    const rect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const tooltipWidth = tooltipRef.current?.offsetWidth ?? 350;
    const tooltipHeight = tooltipRef.current?.offsetHeight ?? 220;
    const horizontalMargin = 16;
    const verticalGap = 10;
    const shouldPlaceBelow = rect.top < tooltipHeight + 24;
    const nextLeft = Math.min(
      Math.max(horizontalMargin, rect.right - tooltipWidth),
      viewportWidth - tooltipWidth - horizontalMargin,
    );

    if (shouldPlaceBelow) {
      setTooltipPosition({
        top: Math.min(rect.bottom + verticalGap, viewportHeight - tooltipHeight - horizontalMargin),
        left: nextLeft,
        placement: 'bottom',
      });
      return;
    }

    setTooltipPosition({
      top: Math.max(horizontalMargin, rect.top - verticalGap),
      left: nextLeft,
      placement: 'top',
    });
  };

  useEffect(() => {
    if (!isHovered) {
      return;
    }

    updateTooltipPosition();

    const handleViewportChange = () => {
      updateTooltipPosition();
    };

    window.addEventListener('scroll', handleViewportChange, true);
    window.addEventListener('resize', handleViewportChange);

    return () => {
      window.removeEventListener('scroll', handleViewportChange, true);
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [isHovered, hasAnyTags]);

  const handleMouseEnter = () => {
    if (triggerRef.current && hasAnyTags) {
      setIsHovered(true);
      requestAnimationFrame(() => {
        updateTooltipPosition();
      });
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
          ref={tooltipRef}
          className="pointer-events-none fixed isolate"
          style={{ 
            top: tooltipPosition.top,
            left: tooltipPosition.left,
            transform: tooltipPosition.placement === 'top' ? 'translateY(-100%)' : 'none',
            zIndex: 2147483647,
          }}
        >
          <div
            className="relative min-w-[280px] max-w-[350px] rounded-2xl border border-slate-700 bg-slate-950 p-3 text-slate-100 shadow-2xl"
            style={{
              backgroundColor: '#020817',
              backgroundImage: 'none',
              backdropFilter: 'none',
            }}
          >
            <div className="space-y-2">
              {(resumeTags.skills?.length || 0) > 0 && (
                <div>
                  <div className="mb-1 text-xs font-semibold text-[var(--cv-tertiary)]">{t('resumes.filters.skills')}</div>
                  <div className="flex flex-wrap gap-1">
                    {resumeTags.skills.map((tag, i) => (
                      <span key={`ts-${i}`} className="cv-chip-skills rounded-full px-2 py-0.5 text-xs">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
              {(resumeTags.industries?.length || 0) > 0 && (
                <div>
                  <div className="mb-1 text-xs font-semibold text-[var(--cv-primary)]">{t('resumes.filters.industries')}</div>
                  <div className="flex flex-wrap gap-1">
                    {resumeTags.industries.map((tag, i) => (
                      <span key={`ti-${i}`} className="cv-chip-industries rounded-full px-2 py-0.5 text-xs">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
              {(resumeTags.tools?.length || 0) > 0 && (
                <div>
                  <div className="mb-1 text-xs font-semibold text-[var(--cv-cyan)]">{t('resumes.filters.tools')}</div>
                  <div className="flex flex-wrap gap-1">
                    {resumeTags.tools.map((tag, i) => (
                      <span key={`tt-${i}`} className="cv-chip-tools rounded-full px-2 py-0.5 text-xs">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
              {(resumeTags.soft_skills?.length || 0) > 0 && (
                <div>
                  <div className="mb-1 text-xs font-semibold text-[var(--cv-secondary)]">{t('resumes.filters.softskills')}</div>
                  <div className="flex flex-wrap gap-1">
                    {resumeTags.soft_skills.map((tag, i) => (
                      <span key={`tss-${i}`} className="cv-chip-soft rounded-full px-2 py-0.5 text-xs">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {tooltipPosition.placement === 'top' ? (
              <div className="absolute bottom-0 right-4 translate-y-full">
                <div className="h-0 w-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-[var(--cv-panel-end)]"></div>
              </div>
            ) : (
              <div className="absolute right-4 top-0 -translate-y-full">
                <div className="h-0 w-0 border-b-8 border-l-8 border-r-8 border-b-[var(--cv-panel-start)] border-l-transparent border-r-transparent"></div>
              </div>
            )}
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
