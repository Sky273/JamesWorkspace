const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isAllowedAbsoluteLogoUrl(value: string): boolean {
  return /^(https?:|data:image\/|blob:)/i.test(value);
}

function isAllowedRootRelativeLogoUrl(value: string): boolean {
  return (
    value.startsWith('/api/firms/')
    || value.startsWith('/logos/')
    || value.startsWith('/assets/')
  );
}

export function normalizeFirmLogoUrl(value: string | null | undefined, firmId?: string | null): string {
  const rawValue = typeof value === 'string' ? value.trim() : '';
  if (!rawValue) {
    return '';
  }

  if (isAllowedAbsoluteLogoUrl(rawValue) || isAllowedRootRelativeLogoUrl(rawValue)) {
    return rawValue;
  }

  const bareValue = rawValue.replace(/^\/+/, '');
  const resolvedFirmId = firmId?.trim() || bareValue;

  if (UUID_PATTERN.test(bareValue) && UUID_PATTERN.test(resolvedFirmId)) {
    return `/api/firms/${encodeURIComponent(resolvedFirmId)}/logo/image`;
  }

  return '';
}
