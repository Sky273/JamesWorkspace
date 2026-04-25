interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

export default function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: SwitchProps): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`settings-switch${checked ? ' settings-switch--checked' : ''}`}
    >
      <span className="settings-switch__thumb" aria-hidden="true" />
    </button>
  );
}
