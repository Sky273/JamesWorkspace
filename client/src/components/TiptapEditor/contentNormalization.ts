function normalizePlainText(content: string): string {
  return content
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isBulletLine(line: string): boolean {
  return /^[-*•▪◦‣]\s+.+$/u.test(line.trim());
}

function toParagraphHtml(lines: string[]): string {
  return `<p>${lines.map((line) => escapeHtml(line.trim())).join('<br>')}</p>`;
}

function toListHtml(lines: string[]): string {
  return `<ul>${lines
    .map((line) => line.trim().replace(/^[-*•▪◦‣]\s+/u, ''))
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join('')}</ul>`;
}

export function isHtmlContent(content: string): boolean {
  return /<\/?(?:p|br|div|span|strong|em|u|h[1-6]|ul|ol|li|table|thead|tbody|tr|td|th|blockquote|code|pre|a|img)\b[^>]*>/i.test(content);
}

export function normalizeEditorContent(content: string): string {
  if (!content) {
    return '';
  }

  if (isHtmlContent(content)) {
    return content;
  }

  const normalized = normalizePlainText(content);
  if (!normalized) {
    return '';
  }

  const lines = normalized.split('\n');
  const blocks: string[] = [];
  let paragraphLines: string[] = [];
  let listLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) {
      return;
    }
    blocks.push(toParagraphHtml(paragraphLines));
    paragraphLines = [];
  };

  const flushList = () => {
    if (listLines.length === 0) {
      return;
    }
    blocks.push(toListHtml(listLines));
    listLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    if (isBulletLine(line)) {
      flushParagraph();
      listLines.push(line);
      continue;
    }

    flushList();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();

  return blocks.join('');
}
