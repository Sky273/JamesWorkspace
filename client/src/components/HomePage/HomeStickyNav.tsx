import { motion } from 'framer-motion';

interface NavSection {
  id: string;
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
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-center gap-2 py-3 overflow-x-auto scrollbar-hide">
          {navSections.map((section) => (
            <motion.button
              key={section.id}
              onClick={() => onNavigate(section.id)}
              className={
                `relative px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300 ease-out ${
                  activeSection === section.id
                    ? 'bg-primary-500 text-white shadow-lg'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`
              }
              animate={{
                y: activeSection === section.id ? -4 : 0,
                scale: activeSection === section.id ? 1.05 : 1,
              }}
              whileHover={{ scale: activeSection === section.id ? 1.05 : 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              {section.label}
              {activeSection === section.id && (
                <motion.div
                  layoutId="activeIndicator"
                  className="absolute inset-0 bg-primary-500 rounded-full -z-10"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </motion.button>
          ))}
        </div>
      </div>
    </motion.nav>
  );
}
