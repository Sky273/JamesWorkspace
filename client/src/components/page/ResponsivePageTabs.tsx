import type { ComponentType, SVGProps } from 'react';

export interface ResponsivePageTabOption<T extends string> {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: T;
}

interface ResponsivePageTabsProps<T extends string> {
  label: string;
  minItemWidthRem?: number;
  onChange: (value: T) => void;
  options: ResponsivePageTabOption<T>[];
  value: T;
}

export default function ResponsivePageTabs<T extends string>({
  label,
  minItemWidthRem = 11,
  onChange,
  options,
  value,
}: ResponsivePageTabsProps<T>) {
  return (
    <div className="mb-6 flex flex-col gap-3">
      <span className="cv-kicker">{label}</span>
      <div
        className="segmented-control grid gap-2 rounded-[1.6rem] p-2"
        style={{
          gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${minItemWidthRem}rem), 1fr))`,
        }}
      >
        {options.map((option) => {
          const Icon = option.icon;
          const isActive = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              title={option.label}
              className={`segmented-control__item inline-flex min-h-12 w-full min-w-0 items-center gap-2 rounded-2xl px-3 py-3 text-left text-sm font-semibold sm:px-4 ${
                isActive
                  ? 'segmented-control__item--active'
                  : 'text-slate-500 hover:text-slate-700 dark:text-[var(--cv-muted)] dark:hover:text-[var(--cv-text)]'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap leading-tight [overflow-wrap:normal] [word-break:normal] hyphens-none">
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
