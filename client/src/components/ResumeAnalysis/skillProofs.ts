import type { Resume } from '../../types/entities';
import {
  normalizeSkillProofEntry,
  type SkillProofEntry,
} from '../TiptapEditor/proof.shared';

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== 'string') return null;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function readProofArray(value: unknown, category: SkillProofEntry['category']): SkillProofEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeSkillProofEntry(item, category))
    .filter((item): item is SkillProofEntry => item !== null);
}

function splitSkillsDetailed(value: unknown): { skills: SkillProofEntry[]; tools: SkillProofEntry[] } {
  if (!Array.isArray(value)) {
    return { skills: [], tools: [] };
  }

  const skills: SkillProofEntry[] = [];
  const tools: SkillProofEntry[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const rawCategory = String(record.category || '').trim().toLowerCase();
    const category: SkillProofEntry['category'] = (
      rawCategory === 'tool'
      || rawCategory === 'tools'
      || rawCategory === 'technology'
      || rawCategory === 'technologies'
      || rawCategory === 'framework'
      || rawCategory === 'frameworks'
      || rawCategory === 'platform'
      || rawCategory === 'platforms'
    )
      ? 'tool'
      : 'skill';

    const normalized = normalizeSkillProofEntry(record, category);
    if (!normalized) continue;

    if (category === 'tool') {
      tools.push(normalized);
    } else {
      skills.push(normalized);
    }
  }

  return { skills, tools };
}

function dedupeProofs(entries: SkillProofEntry[]): SkillProofEntry[] {
  const byName = new Map<string, SkillProofEntry>();

  for (const entry of entries) {
    const key = `${entry.category}:${entry.name.trim().toLowerCase()}`;
    const existing = byName.get(key);

    if (!existing) {
      byName.set(key, entry);
      continue;
    }

    const existingScore = existing.evidenceScore ?? existing.proofScore ?? 0;
    const nextScore = entry.evidenceScore ?? entry.proofScore ?? 0;

    if (nextScore >= existingScore) {
      byName.set(key, entry);
    }
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
}

export function extractCurrentSkillProofs(resume: Resume | null | undefined): SkillProofEntry[] {
  if (!resume) return [];

  const analysisDetails = parseJsonObject(resume.analysisDetails ?? resume['Analysis Details']);
  const analysisTags = parseJsonObject(analysisDetails?.tags);
  const detailed = splitSkillsDetailed(
    resume.skillsDetailed
    ?? resume['Skills Detailed']
    ?? analysisDetails?.skillsDetailed
    ?? analysisDetails?.skills_detailed,
  );

  return dedupeProofs([
    ...readProofArray(resume.skillsEvidence ?? resume['Skills Evidence'] ?? analysisTags?.skillsEvidence, 'skill'),
    ...readProofArray(resume.toolsEvidence ?? resume['Tools Evidence'] ?? analysisTags?.toolsEvidence, 'tool'),
    ...detailed.skills,
    ...detailed.tools,
  ]);
}

export function extractImprovedSkillProofs(resume: Resume | null | undefined): SkillProofEntry[] {
  if (!resume) return [];

  const analysisDetails = parseJsonObject(resume.analysisDetails ?? resume['Analysis Details']);
  const analysisTags = parseJsonObject(analysisDetails?.tags);
  const detailed = splitSkillsDetailed(
    resume.improvedSkillsDetailed
    ?? resume['Improved Skills Detailed']
    ?? resume.skillsDetailed
    ?? resume['Skills Detailed']
    ?? analysisDetails?.skillsDetailed
    ?? analysisDetails?.skills_detailed,
  );

  return dedupeProofs([
    ...readProofArray(
      resume.improvedSkillsEvidence
      ?? resume['Improved Skills Evidence']
      ?? resume.skillsEvidence
      ?? resume['Skills Evidence']
      ?? analysisTags?.skillsEvidence,
      'skill',
    ),
    ...readProofArray(
      resume.improvedToolsEvidence
      ?? resume['Improved Tools Evidence']
      ?? resume.toolsEvidence
      ?? resume['Tools Evidence']
      ?? analysisTags?.toolsEvidence,
      'tool',
    ),
    ...detailed.skills,
    ...detailed.tools,
  ]);
}
