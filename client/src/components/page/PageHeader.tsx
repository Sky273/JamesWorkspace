interface PageHeaderProps {
  title: string;
  subtitle: string;
  eyebrow?: string;
}

export default function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <div className="page-hero glass-panel-strong mb-5 overflow-hidden rounded-[13px] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="mt-1 h-10 w-1 rounded-full bg-[var(--cv-primary)]" />
        <div>
          <h1 className="cv-display text-2xl font-bold text-[var(--cv-text)] sm:text-3xl">{title}</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-5 text-[var(--cv-muted)]">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
