import WeightSlider from './WeightSlider';

interface WeightGroupSectionProps {
  title?: string;
  description?: string;
  weights: Array<{ key: string; label: string }>;
  formData: Record<string, string | number | boolean | Record<string, Record<string, Record<string, string | number>>>>;
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
        <h3 className="mb-1 text-base font-semibold text-[var(--cv-text)]">
          {title}
        </h3>
      )}
      {description && (
        <p className="mb-4 text-sm text-[var(--cv-muted)]">
          {description}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
