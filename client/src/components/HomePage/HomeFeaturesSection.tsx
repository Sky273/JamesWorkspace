import { ForwardRefExoticComponent, RefAttributes, SVGProps } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { useTranslation } from 'react-i18next';

type HeroIcon = ForwardRefExoticComponent<Omit<SVGProps<SVGSVGElement>, 'ref'> & { title?: string; titleId?: string } & RefAttributes<SVGSVGElement>>;

interface Feature {
  icon: HeroIcon;
  title: string;
  description: string;
}

interface FeatureCardProps extends Feature {
  delay: number;
}

function FeatureCard({ icon: Icon, title, description, delay }: FeatureCardProps): JSX.Element {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay }}
      className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow"
    >
      <div className="flex items-center space-x-4">
        <motion.div whileHover={{ rotate: 360 }} transition={{ duration: 0.5 }} className="p-3 bg-primary-100 dark:bg-primary-900 rounded-lg">
          <Icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
        </motion.div>
        <h3 className="text-xl font-semibold">{title}</h3>
      </div>
      <p className="mt-4 text-gray-600 dark:text-gray-300">{description}</p>
    </motion.div>
  );
}

interface HomeFeaturesSectionProps {
  features: Feature[];
}

export default function HomeFeaturesSection({ features }: HomeFeaturesSectionProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <motion.section id="features" className="py-24 mt-32 scroll-mt-20">
      <div className="container mx-auto px-4">
        <motion.h2 className="text-4xl font-bold text-center mb-16" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          {t('home.features.title')}
        </motion.h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <FeatureCard key={index} icon={feature.icon} title={feature.title} description={feature.description} delay={index * 0.1} />
          ))}
        </div>
      </div>
    </motion.section>
  );
}
