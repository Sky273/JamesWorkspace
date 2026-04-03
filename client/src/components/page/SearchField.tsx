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
  className = 'cv-search-input mb-0 w-full rounded-[1.6rem] py-4 pr-4 text-base font-medium text-slate-900 placeholder:text-slate-400 dark:text-[#dee5ff] dark:placeholder:text-[#a3aac4]',
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
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-16 items-center justify-center">
        <MagnifyingGlassIcon className="h-5 w-5 text-slate-400 dark:text-[#7f8ab0]" />
      </div>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        className={className}
        style={{ marginBottom: 0, paddingLeft: '4rem' }}
        placeholder={placeholder}
      />
    </div>
  );
}
