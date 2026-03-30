import type { ComponentType, InputHTMLAttributes } from 'react';

interface InputWithLeadingIconProps extends InputHTMLAttributes<HTMLInputElement> {
  icon: ComponentType<{ className?: string }>;
  containerClassName?: string;
  inputClassName?: string;
  iconClassName?: string;
}

export default function InputWithLeadingIcon({
  icon: Icon,
  containerClassName = 'relative',
  inputClassName = '',
  iconClassName = 'h-5 w-5 text-gray-400',
  className,
  style,
  ...props
}: InputWithLeadingIconProps): JSX.Element {
  const resolvedInputClassName = inputClassName || className || 'mb-0 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2.5 pr-4 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent';

  return (
    <div className={containerClassName}>
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-14 items-center justify-center">
        <Icon className={iconClassName} />
      </div>
      <input {...props} className={resolvedInputClassName} style={{ marginBottom: 0, paddingLeft: '3.5rem', ...style }} />
    </div>
  );
}
