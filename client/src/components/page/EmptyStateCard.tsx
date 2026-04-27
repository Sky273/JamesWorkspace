import type { ComponentType, ReactNode, SVGProps } from 'react';

interface EmptyStateCardProps {
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title?: string;
  containerClassName?: string;
  action?: ReactNode;
}

export default function EmptyStateCard({
  description,
  icon: Icon,
  title,
  containerClassName = 'section-shell rounded-[13px] p-8 text-center',
  action,
}: EmptyStateCardProps) {
  return (
    <div className={containerClassName}>
      <Icon className="mx-auto mb-3 h-12 w-12 text-slate-400" />
      {title ? <h3 className="mb-2 text-lg font-semibold text-[var(--cv-text)]">{title}</h3> : null}
      <p className="text-sm text-[var(--cv-muted)]">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
