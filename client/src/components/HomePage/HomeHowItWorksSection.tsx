import { ForwardRefExoticComponent, RefAttributes, SVGProps } from 'react';
import { motion } from 'framer-motion';
import { CogIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

type HeroIcon = ForwardRefExoticComponent<Omit<SVGProps<SVGSVGElement>, 'ref'> & { title?: string; titleId?: string } & RefAttributes<SVGSVGElement>>;

interface HowItWorksItem {
  step: number;
  title: string;
  description: string;
  icon: HeroIcon;
}

interface HomeHowItWorksSectionProps {
  items: HowItWorksItem[];
}

export default function HomeHowItWorksSection({ items }: HomeHowItWorksSectionProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <motion.section
      id="how-it-works"
      className="py-24 mt-64 bg-white dark:bg-gray-800 scroll-mt-20"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
    >
      <div className="container mx-auto px-4">
        <motion.h2 className="text-4xl font-bold text-center mb-16" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          {t('home.howItWorks.title')}
        </motion.h2>
        <div className="max-w-4xl mx-auto">
          {items.map((item, index) => {
            const IconComponent = item.icon;
            return (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.2, type: 'spring', stiffness: 100 }}
                className="flex items-center mb-12 last:mb-0"
              >
                <motion.div
                  className="flex-shrink-0 w-16 h-16 rounded-full bg-primary-500 text-white flex items-center justify-center text-xl font-bold"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {item.step}
                </motion.div>
                <div className="ml-6">
                  <div className="flex items-center mb-2">
                    <motion.div className="mr-3 text-primary-500" whileHover={{ rotate: 360 }} transition={{ duration: 0.5 }}>
                      <IconComponent className="w-8 h-8" />
                    </motion.div>
                    <motion.h3 className="text-xl font-semibold" initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}>
                      {item.title}
                    </motion.h3>
                  </div>
                  <motion.p className="text-gray-600 dark:text-gray-300" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.3 }}>
                    {item.description}
                  </motion.p>

                  {index === 1 && (
                    <motion.div className="mt-4 flex items-center gap-2" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.4 }}>
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}>
                        <CogIcon className="w-6 h-6 text-primary-500" />
                      </motion.div>
                      <div className="h-1 flex-grow bg-gray-200 dark:bg-gray-700 rounded">
                        <motion.div
                          className="h-full bg-primary-500 rounded"
                          initial={{ width: '0%' }}
                          whileInView={{ width: '100%' }}
                          viewport={{ once: true }}
                          transition={{ duration: 1.5, delay: 0.5 }}
                        />
                      </div>
                    </motion.div>
                  )}

                  {index === 2 && (
                    <motion.div className="mt-4 grid grid-cols-3 gap-2" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.4 }}>
                      {[...Array(3)].map((_, i) => (
                        <motion.div
                          key={i}
                          className="h-2 bg-primary-200 dark:bg-primary-800 rounded"
                          initial={{ width: 0 }}
                          whileInView={{ width: '100%' }}
                          viewport={{ once: true }}
                          transition={{ delay: i * 0.2 }}
                        />
                      ))}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.section>
  );
}
