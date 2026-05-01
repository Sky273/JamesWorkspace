export function parsePreviewImprovements(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsePreviewImprovements(parsed);
    } catch {
      return [value];
    }
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .flatMap((entry) => parsePreviewImprovements(entry))
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}
