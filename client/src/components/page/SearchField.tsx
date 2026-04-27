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
  className = 'cv-search-input mb-0 w-full rounded-[9px] py-2.5 pr-3 text-sm font-medium text-[var(--cv-text)] placeholder:text-slate-400 dark:placeholder:text-[#a3aac4]',
  containerClassName = 'relative min-w-0 flex-1',
  onChange,
  placeholder,
  value,
}: SearchFieldProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <div className={containerClassName}>
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-10 items-center justify-center">
        <MagnifyingGlassIcon className="h-4 w-4 text-slate-400 dark:text-[#7f8ab0]" />
      </div>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        className={className}
        style={{ marginBottom: 0, paddingLeft: '2.5rem' }}
        placeholder={placeholder}
      />
    </div>
  );
}
