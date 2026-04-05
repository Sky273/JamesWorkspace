interface PlaceholderValues {
  name: string;
  title: string;
  content?: string;
}

type TemplateSection = 'header' | 'footer';

function stripDocumentWrappers(fragment: string): string {
  if (!fragment.trim()) {
    return '';
  }

  const bodyMatch = fragment.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  const source = bodyMatch ? bodyMatch[1] : fragment;

  return source
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<\/?(html|head|body|meta|title|link)\b[^>]*>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .trim();
}

function extractSemanticFragment(fragment: string, section: TemplateSection): string {
  const matches = fragment.match(new RegExp(`<${section}\\b[^>]*>[\\s\\S]*?<\\/${section}>`, 'gi'));
  if (matches && matches.length > 0) {
    return matches.join('\n').trim();
  }

  return fragment;
}

export function normalizeTemplateFragment(
  fragment: string | undefined,
  section: TemplateSection,
): string {
  const normalized = stripDocumentWrappers(String(fragment || ''));
  if (!normalized) {
    return '';
  }

  return extractSemanticFragment(normalized, section).trim();
}

export function normalizeTemplateStylesheet(stylesheet: string | undefined): string {
  return String(stylesheet || '')
    .replace(/<\/?style\b[^>]*>/gi, '')
    .trim();
}

export function applyTemplatePlaceholders(
  template: string | undefined,
  values: PlaceholderValues,
): string {
  let processed = String(template || '');
  processed = processed.replace(/-name-/g, values.name);
  processed = processed.replace(/-title-/g, values.title);

  if (typeof values.content === 'string') {
    processed = processed.replace(/-content-/g, values.content);
  }

  return processed;
}

function includesDocumentWrapper(fragment: string | undefined): boolean {
  return /<(?:!doctype|html|head|body)\b/i.test(String(fragment || ''));
}

export function summarizeTemplatePayload(template: {
  HeaderContent?: string;
  FooterContent?: string;
  Stylesheet?: string;
}) {
  const normalizedHeader = normalizeTemplateFragment(template.HeaderContent, 'header');
  const normalizedFooter = normalizeTemplateFragment(template.FooterContent, 'footer');
  const normalizedStylesheet = normalizeTemplateStylesheet(template.Stylesheet);

  return {
    rawHeaderLength: String(template.HeaderContent || '').length,
    normalizedHeaderLength: normalizedHeader.length,
    rawFooterLength: String(template.FooterContent || '').length,
    normalizedFooterLength: normalizedFooter.length,
    rawStylesheetLength: String(template.Stylesheet || '').length,
    normalizedStylesheetLength: normalizedStylesheet.length,
    headerHadDocumentWrappers: includesDocumentWrapper(template.HeaderContent),
    footerHadDocumentWrappers: includesDocumentWrapper(template.FooterContent),
  };
}
