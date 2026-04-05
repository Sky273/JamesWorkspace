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
  containerClassName = 'section-shell rounded-[2rem] p-12 text-center',
}: EmptyStateCardProps) {
  return (
    <div className={containerClassName}>
      <Icon className="mx-auto mb-4 h-16 w-16 text-slate-400" />
      {title ? <h3 className="mb-2 text-xl font-semibold text-slate-900 dark:text-[var(--cv-text)]">{title}</h3> : null}
      <p className="text-slate-600 dark:text-[var(--cv-muted)]">{description}</p>
    </div>
  );
}
