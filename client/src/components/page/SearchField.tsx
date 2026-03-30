import { ChangeEvent } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface SearchFieldProps {
  className?: string;
  containerClassName?: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}

export default function SearchField({
  className = 'mb-0 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2.5 pr-4 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent',
  containerClassName = 'relative flex-1 max-w-md',
  onChange,
  placeholder,
  value,
}: SearchFieldProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <div className={containerClassName}>
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-14 items-center justify-center">
        <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
      </div>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        className={className}
        style={{ marginBottom: 0, paddingLeft: '3.5rem' }}
        placeholder={placeholder}
      />
    </div>
  );
}
