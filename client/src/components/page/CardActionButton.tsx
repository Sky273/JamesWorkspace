import type { ComponentType, MouseEvent, SVGProps } from 'react';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const toneClassNames = {
  danger: 'text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30',
  info: 'text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30',
  neutral: 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
  primary: 'bg-blue-500 text-white hover:bg-blue-600',
  secondary: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
  success: 'text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30',
} as const;

export default function CardActionButton({
  className = '',
  icon: Icon,
  label,
  onClick,
  title,
  tone = 'secondary',
}: {
  className?: string;
  icon: IconComponent;
  label?: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  title?: string;
  tone?: keyof typeof toneClassNames;
}) {
  const baseClassName = label
    ? 'flex items-center justify-center gap-1 px-3 py-2 text-sm rounded-lg transition-colors'
    : 'p-2 rounded-lg transition-colors';

  return (
    <button
      onClick={onClick}
      className={[baseClassName, toneClassNames[tone], className].filter(Boolean).join(' ')}
      title={title}
      type="button"
    >
      <Icon className="w-4 h-4" />
      {label ? <span>{label}</span> : null}
    </button>
  );
}
