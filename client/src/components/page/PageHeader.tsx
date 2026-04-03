interface PageHeaderProps {
  title: string;
  subtitle: string;
}

export default function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <div className="mb-10">
      <div className="mb-3 flex items-center gap-3">
        <span className="cv-kicker">Plateforme</span>
        <span className="text-slate-500 dark:text-[#7c87a5]">&gt;</span>
        <span className="cv-kicker text-[var(--cv-primary)]">{title}</span>
      </div>
      <div className="flex items-start gap-4">
        <div className="mt-1 h-12 w-1 rounded-full bg-[linear-gradient(to_bottom,var(--cv-primary),color-mix(in_srgb,var(--cv-primary)_70%,white),var(--cv-tertiary))]" />
        <div>
          <h1 className="cv-display text-4xl font-extrabold text-slate-950 dark:text-[#dee5ff] sm:text-5xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-[#a3aac4] sm:text-base">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
