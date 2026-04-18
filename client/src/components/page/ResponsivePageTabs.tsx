import type { ComponentType, SVGProps } from 'react';

export interface ResponsivePageTabOption<T extends string> {
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: T;
}

interface ResponsivePageTabsProps<T extends string> {
  label?: string;
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
    <div className={`flex flex-col gap-3 ${label ? 'mb-6' : ''}`.trim()}>
      {label ? <span className="cv-kicker">{label}</span> : null}
      <div
        className="segmented-control grid gap-1.5 rounded-[1.6rem] p-1.5"
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
              className={`segmented-control__item inline-flex min-h-12 w-full min-w-0 items-center gap-1.5 rounded-2xl px-2.5 py-3 text-left text-sm font-semibold sm:px-3 ${
                isActive ? 'segmented-control__item--active' : ''
              }`}
            >
              {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
              <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap leading-tight [overflow-wrap:normal] [word-break:normal] hyphens-none">
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
