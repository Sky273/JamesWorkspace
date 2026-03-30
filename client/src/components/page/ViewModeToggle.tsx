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
    <div className="flex items-center gap-2 mb-4">
      <span className="text-sm text-gray-600 dark:text-gray-400">{label} :</span>
      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
        {options.map((option) => {
          const Icon = option.icon;
          const isActive = option.value === value;
          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
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
