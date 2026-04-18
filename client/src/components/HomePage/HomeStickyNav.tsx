import { motion } from 'framer-motion';
import type { ComponentType, SVGProps } from 'react';
import ResponsivePageTabs from '../page/ResponsivePageTabs';

interface NavSection {
  id: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
}

interface HomeStickyNavProps {
  navSections: NavSection[];
  activeSection: string;
  onNavigate: (sectionId: string) => void;
}

export default function HomeStickyNav({ navSections, activeSection, onNavigate }: HomeStickyNavProps): JSX.Element {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="sticky top-16 z-30 backdrop-blur-sm border-b border-transparent"
    >
      <div className="container mx-auto px-4 py-3">
        <ResponsivePageTabs
          minItemWidthRem={9}
          onChange={onNavigate}
          options={navSections.map((section) => ({
            value: section.id,
            label: section.label,
            icon: section.icon,
          }))}
          value={activeSection}
        />
      </div>
    </motion.nav>
  );
}
