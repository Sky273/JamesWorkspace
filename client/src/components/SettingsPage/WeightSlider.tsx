interface WeightSliderProps {
  label: string;
  value: number;
  onChange: (value: string) => void;
}

export default function WeightSlider({
  label,
  value,
  onChange
}: WeightSliderProps): JSX.Element {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-[var(--cv-muted)]">
        {label}
      </label>
      <div className="flex items-center space-x-4">
        <input
          type="range"
          min="0"
          max="50"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="flex-1 accent-[#6246ea]"
        />
        <input
          type="number"
          min="0"
          max="100"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-20 rounded-[9px] border border-[#dedbe8] bg-white px-3 py-2 text-[var(--cv-text)] dark:border-white/10 dark:bg-[#111827] dark:text-gray-100"
        />
        <span className="text-[var(--cv-muted)]">%</span>
      </div>
    </div>
  );
}
