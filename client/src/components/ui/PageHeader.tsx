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
    <div className="page-hero glass-panel-strong rounded-[28px] p-6 md:p-8 mb-8 overflow-hidden">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          {eyebrow && (
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-700 dark:text-slate-200">
              <span className="h-2 w-2 rounded-full bg-indigo-500 dark:bg-indigo-400" />
              {eyebrow}
            </div>
          )}

          <div className="flex items-start gap-4">
            {icon && (
              <div className="hidden sm:flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-indigo-600 shadow-lg shadow-indigo-500/10 dark:bg-slate-900/60 dark:text-indigo-300">
                {icon}
              </div>
            )}
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-50 md:text-4xl">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300 md:text-base">
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
