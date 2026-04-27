import type { ComponentType, MouseEvent, SVGProps } from 'react';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const toneClassNames = {
  danger: 'app-button-secondary text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30',
  info: 'app-button-secondary text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30',
  neutral: 'app-button-secondary',
  primary: 'app-primary-action',
  secondary: 'app-button-secondary',
  success: 'app-button-secondary text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30',
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
    ? 'flex items-center justify-center gap-1 rounded-[9px] px-3 py-2 text-sm transition-all'
    : 'rounded-[9px] p-2 transition-all';

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
