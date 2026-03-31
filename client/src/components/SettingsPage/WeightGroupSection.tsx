import WeightSlider from './WeightSlider';

interface WeightGroupSectionProps {
  title?: string;
  description?: string;
  weights: Array<{ key: string; label: string }>;
  formData: Record<string, string | number | boolean>;
  onInputChange: (key: string, value: string) => void;
}

export default function WeightGroupSection({
  title,
  description,
  weights,
  formData,
  onInputChange
}: WeightGroupSectionProps): JSX.Element {
  return (
    <div>
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {title}
        </h3>
      )}
      {description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {description}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {weights.map(({ key, label }) => (
          <WeightSlider
            key={key}
            label={label}
            value={formData[key] as number}
            onChange={(value) => onInputChange(key, value)}
          />
        ))}
      </div>
    </div>
  );
}
