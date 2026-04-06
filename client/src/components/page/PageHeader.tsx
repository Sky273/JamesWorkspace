interface PageHeaderProps {
  title: string;
  subtitle: string;
  eyebrow?: string;
}

export default function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <div className="page-hero glass-panel-strong mb-10 overflow-hidden rounded-[2rem] p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <div className="mt-1 h-14 w-1 rounded-full bg-[linear-gradient(to_bottom,var(--cv-primary),color-mix(in_srgb,var(--cv-primary)_70%,white),var(--cv-tertiary))]" />
        <div>
          <h1 className="cv-display text-4xl font-extrabold text-slate-950 dark:text-[var(--cv-text)] sm:text-5xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-[var(--cv-muted)] sm:text-base">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
