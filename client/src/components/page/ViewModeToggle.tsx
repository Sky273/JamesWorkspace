import type { ComponentType, SVGProps } from 'react';

interface ViewModeOption<T extends string> {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: T;
}

interface ViewModeToggleProps<T extends string> {
  className?: string;
  label: string;
  onChange: (value: T) => void;
  options: ViewModeOption<T>[];
  value: T;
}

export default function ViewModeToggle<T extends string>({
  className,
  label,
  onChange,
  options,
  value,
}: ViewModeToggleProps<T>) {
  return (
    <div className={`mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${className || ''}`.trim()}>
      <span className="cv-kicker">{label}</span>
      <div className="w-full overflow-x-auto pb-1 sm:w-auto sm:overflow-visible">
        <div className="segmented-control inline-flex min-w-max rounded-2xl p-1">
          {options.map((option) => {
            const Icon = option.icon;
            const isActive = option.value === value;
            return (
              <button
                key={option.value}
                onClick={() => onChange(option.value)}
                className={`segmented-control__item inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-2xl px-3 py-2.5 text-sm font-semibold sm:px-4 ${
                  isActive
                    ? 'segmented-control__item--active'
                    : 'text-slate-500 hover:text-slate-700 dark:text-[var(--cv-muted)] dark:hover:text-[var(--cv-text)]'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
