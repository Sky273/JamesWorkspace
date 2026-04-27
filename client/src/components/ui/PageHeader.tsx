import { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}

export default function PageHeader({ eyebrow, title, subtitle, icon, actions }: PageHeaderProps): JSX.Element {
  return (
    <div className="page-hero glass-panel-strong mb-5 overflow-hidden rounded-[13px] p-4 md:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          {eyebrow && (
            <div className="mb-3 inline-flex items-center gap-2 rounded-[9px] border border-[#e4e4e7] bg-[#f8f8f7] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--cv-muted)] dark:border-white/10 dark:bg-[#111827] dark:text-slate-200">
              <span className="h-2 w-2 rounded-full bg-[var(--cv-primary)]" />
              {eyebrow}
            </div>
          )}

          <div className="flex items-start gap-3">
            {icon && (
              <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-[9px] bg-[#f4f2ff] text-[var(--cv-primary)] shadow-none dark:bg-[#111827] dark:text-[#c9ccff] sm:flex">
                {icon}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--cv-text)] md:text-3xl">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1.5 max-w-2xl text-sm leading-5 text-[var(--cv-muted)]">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </div>

        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}
