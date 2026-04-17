export interface SuggestionsBySection {
  executiveSummary?: string[];
  skills?: string[];
  experiences?: string[];
  education?: string[];
  hobbiesLanguages?: string[];
  atsOptimization?: string[];
}

export const SUGGESTION_SECTION_ORDER: (keyof SuggestionsBySection)[] = [
  'executiveSummary',
  'skills',
  'experiences',
  'education',
  'hobbiesLanguages',
  'atsOptimization',
];

export const SUGGESTION_SECTION_LABELS: Record<keyof SuggestionsBySection, string> = {
  executiveSummary: 'Résumé exécutif',
  skills: 'Compétences',
  experiences: 'Experience',
  education: 'Formation',
  hobbiesLanguages: 'Langues & Loisirs',
  atsOptimization: 'Optimisation ATS',
};

export const SUGGESTION_SECTION_MARKERS: Record<keyof SuggestionsBySection, string[]> = {
  executiveSummary: [
    'profil',
    'resume',
    'summary',
    'profile',
    'presentation',
    'introduction',
    'objectif',
    'sommaire',
    'a propos',
    'about',
  ],
  skills: [
    'competences',
    'skills',
    'technologies',
    'outils',
    'expertise',
    'savoir-faire',
    'competences techniques',
    'technical skills',
    'stack technique',
    'environnement technique',
  ],
  experiences: [
    'experience',
    'parcours',
    'missions',
    'postes',
    'emplois',
    'experiences professionnelles',
    'professional experience',
    'work experience',
    'historique',
  ],
  education: [
    'formation',
    'education',
    'diplomes',
    'etudes',
    'certifications',
    'academique',
    'cursus',
    'scolarite',
    'diplome',
  ],
  hobbiesLanguages: [
    'langues',
    'languages',
    'loisirs',
    'hobbies',
    "centres d'interet",
    'interests',
    'activites',
    'divers',
    'autres',
  ],
  atsOptimization: [],
};

export function getSuggestionsCount(suggestions: SuggestionsBySection): number {
  return Object.values(suggestions).flat().filter(Boolean).length;
}

function normalizeSuggestionItems(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return [String(value)];
  }
  if (Array.isArray(value)) {
    return [
      ...new Set(
        value.flatMap((item) => normalizeSuggestionItems(item)).filter(Boolean),
      ),
    ];
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const directText = [
      record.text,
      record.suggestion,
      record.content,
      record.message,
      record.label,
      record.title,
      record.value,
      record.description,
    ].find(
      (candidate): candidate is string =>
        typeof candidate === 'string' && candidate.trim().length > 0,
    );

    if (directText) {
      return [directText.trim()];
    }

    return [
      ...new Set(
        Object.values(record)
          .flatMap((item) => normalizeSuggestionItems(item))
          .filter(Boolean),
      ),
    ];
  }
  return [];
}

function normalizeSuggestionSections(value: unknown): SuggestionsBySection {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, items]) => [key, normalizeSuggestionItems(items)])
      .filter(([, items]) => items.length > 0),
  ) as SuggestionsBySection;
}

export function parseSuggestions(
  input: string | object | undefined | null,
): SuggestionsBySection {
  if (!input) return {};

  try {
    const parsed: unknown =
      typeof input === 'string' ? JSON.parse(input) : input;

    if (typeof parsed === 'object' && parsed !== null) {
      return normalizeSuggestionSections(parsed);
    }
  } catch {
    // ignore parse errors
  }

  return {};
}
