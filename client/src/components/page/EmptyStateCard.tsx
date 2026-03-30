import type { ComponentType, SVGProps } from 'react';

interface EmptyStateCardProps {
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title?: string;
  containerClassName?: string;
}

export default function EmptyStateCard({
  description,
  icon: Icon,
  title,
  containerClassName = 'bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center',
}: EmptyStateCardProps) {
  return (
    <div className={containerClassName}>
      <Icon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
      {title ? <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">{title}</h3> : null}
      <p className="text-gray-600 dark:text-gray-400">{description}</p>
    </div>
  );
}
