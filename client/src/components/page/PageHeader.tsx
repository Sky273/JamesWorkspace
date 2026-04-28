interface PageHeaderProps {
  title: string;
  subtitle: string;
  eyebrow?: string;
}

export default function PageHeader({ title, subtitle, eyebrow }: PageHeaderProps) {
  return (
    <header className="cv-page-heading mb-[22px]">
      <div className="min-w-0">
        {eyebrow ? <p className="cv-kicker mb-1">{eyebrow}</p> : null}
        <h1 className="cv-display text-[25px] font-bold leading-tight text-[var(--cv-text)]">
          {title}
        </h1>
        <p className="mt-0.5 max-w-2xl text-[13px] leading-5 text-[var(--cv-muted)]">
          {subtitle}
        </p>
      </div>
    </header>
  );
}
