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
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>
      <div className="flex items-center space-x-4">
        <input
          type="range"
          min="0"
          max="50"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="flex-1"
        />
        <input
          type="number"
          min="0"
          max="100"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        />
        <span className="text-gray-600 dark:text-gray-400">%</span>
      </div>
    </div>
  );
}
