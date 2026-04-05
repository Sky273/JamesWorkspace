import type { ComponentType, SVGProps } from 'react';

interface ViewModeOption<T extends string> {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: T;
}

interface ViewModeToggleProps<T extends string> {
  label: string;
  onChange: (value: T) => void;
  options: ViewModeOption<T>[];
  value: T;
}

export default function ViewModeToggle<T extends string>({
  label,
  onChange,
  options,
  value,
}: ViewModeToggleProps<T>) {
  return (
    <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="cv-kicker">{label}</span>
      <div className="segmented-control inline-flex rounded-2xl p-1">
        {options.map((option) => {
          const Icon = option.icon;
          const isActive = option.value === value;
          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              className={`segmented-control__item inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold ${
                isActive
                  ? 'segmented-control__item--active'
                  : 'text-slate-500 hover:text-slate-700 dark:text-[var(--cv-muted)] dark:hover:text-[var(--cv-text)]'
              }`}
            >
              <Icon className="h-4 w-4" />
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
