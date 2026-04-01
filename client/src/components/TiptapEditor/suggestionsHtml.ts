export function removeSuggestionMarkers(content: string): string {
  let cleaned = content;

  cleaned = cleaned.replace(
    /<span[^>]*style="[^"]*(?:#F59E0B|#D97706)[^"]*"[^>]*>[^<]*<\/span>/g,
    '',
  );
  cleaned = cleaned.replace(
    /<span[^>]*>[^<]*(&#128161;|\u{1F4A1})[^<]*<\/span>/gu,
    '',
  );
  cleaned = cleaned.replace(
    /<span[^>]*title="[^"]*"[^>]*>(&#128161;|\u{1F4A1})[^<]*<\/span>/gu,
    '',
  );

  let previousValue = '';
  while (previousValue !== cleaned) {
    previousValue = cleaned;
    cleaned = cleaned.replace(
      /<div[^>]*(?:class="suggestion-highlight"|style="[^"]*border-left:\s*4px\s+solid\s+#F59E0B)[^>]*>([\s\S]*?)<\/div>/g,
      '$1',
    );
  }

  cleaned = cleaned.replace(
    /<div[^>]*class="suggestion-panel"[^>]*>[\s\S]*?<\/ul>\s*<\/div>/g,
    '',
  );
  cleaned = cleaned.replace(
    /<div[^>]*style="[^"]*background:\s*linear-gradient\(135deg,\s*#FEF3C7[^"]*"[^>]*>[\s\S]*?<\/ul>\s*<\/div>/g,
    '',
  );
  cleaned = cleaned.replace(/(?:&#128161;|\u{1F4A1})\s*\d*/gu, '');
  cleaned = cleaned.replace(/<span[^>]*>\s*<\/span>/g, '');
  cleaned = cleaned.replace(/<div[^>]*>\s*<\/div>/g, '');
  cleaned = cleaned.replace(/\s{2,}/g, ' ');

  return cleaned;
}
