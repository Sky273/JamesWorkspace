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
      <div className="cv-glass inline-flex rounded-2xl border border-white/8 p-1">
        {options.map((option) => {
          const Icon = option.icon;
          const isActive = option.value === value;
          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-white/50 text-slate-900 shadow-sm dark:bg-[var(--cv-primary-soft)] dark:text-[var(--cv-text)]'
                  : 'text-slate-500 hover:text-slate-700 dark:text-[#a3aac4] dark:hover:text-[#dee5ff]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
