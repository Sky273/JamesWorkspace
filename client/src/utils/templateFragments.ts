interface PlaceholderValues {
  name: string;
  title: string;
  content?: string;
  logoMarkup?: string;
}

type TemplateSection = 'header' | 'footer';
const BARE_UUID_PATTERN = /^\/?[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function decodeBasicHtmlEntities(value: string): string {
  return value
    .replace(/&#(\d+);?/gi, (_, code: string) => {
      const parsed = Number.parseInt(code, 10);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : _;
    })
    .replace(/&#x([0-9a-f]+);?/gi, (_, code: string) => {
      const parsed = Number.parseInt(code, 16);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : _;
    })
    .replace(/&(quot|apos|amp|lt|gt);/gi, (match, entity: string) => {
      switch (entity.toLowerCase()) {
        case 'quot':
          return '"';
        case 'apos':
          return '\'';
        case 'amp':
          return '&';
        case 'lt':
          return '<';
        case 'gt':
          return '>';
        default:
          return match;
      }
    });
}

function isUnsupportedDocumentResource(value: string): boolean {
  const decodedValue = decodeBasicHtmlEntities(value.trim());
  return /^(?:https?:|file:|ftp:|chrome:|blob:|\/\/)/i.test(decodedValue)
    || BARE_UUID_PATTERN.test(decodedValue);
}

function getAttributeValue(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith('\'') && trimmed.endsWith('\''))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

export function removeUnsupportedDocumentResources(fragment: string | undefined): string {
  return String(fragment || '')
    .replace(/\s(?:src|href|data|poster|action|formaction|xlink:href)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, (attribute) => {
      const rawValue = attribute.split('=').slice(1).join('=');
      return isUnsupportedDocumentResource(getAttributeValue(rawValue)) ? '' : attribute;
    })
    .replace(/\ssrcset\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, (attribute) => {
      const rawValue = attribute.split('=').slice(1).join('=');
      return getAttributeValue(rawValue)
        .split(',')
        .some((candidate) => isUnsupportedDocumentResource(candidate.trim().split(/\s+/)[0] || ''))
        ? ''
        : attribute;
    });
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
    .replace(/@import\b[^;]*(?:;|$)/gi, '')
    .replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi, (match, doubleQuoted: string, singleQuoted: string, unquoted: string) => {
      const rawUrl = (doubleQuoted || singleQuoted || unquoted || '').trim();
      return /^data:image\//i.test(decodeBasicHtmlEntities(rawUrl)) ? match : 'none';
    })
    .trim();
}

export function applyTemplatePlaceholders(
  template: string | undefined,
  values: PlaceholderValues,
): string {
  let processed = String(template || '');
  processed = processed.replace(/-name-/g, values.name);
  processed = processed.replace(/-title-/g, values.title);
  processed = processed.replace(/-logo-/g, values.logoMarkup || '');

  if (typeof values.content === 'string') {
    processed = processed.replace(/-content-/g, values.content);
  }

  return processed;
}

export function templateUsesLogoPlaceholder(template: {
  TemplateContent?: string;
  HeaderContent?: string;
  FooterContent?: string;
}): boolean {
  return /-logo-/i.test(String(template.TemplateContent || ''))
    || /-logo-/i.test(String(template.HeaderContent || ''))
    || /-logo-/i.test(String(template.FooterContent || ''));
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
