import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ProfileMatchSearchPanel from './ProfileMatchSearchPanel';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('ProfileMatchSearchPanel', () => {
  it('associates both selects with visible labels', () => {
    render(
      <ProfileMatchSearchPanel
        deals={[{ id: 'deal-1', title: 'Deal 1', client_name: 'Client A' } as any]}
        selectedDealId=""
        setSelectedDealId={vi.fn()}
        missions={[{ id: 'mission-1', Title: 'Mission 1' } as any]}
        selectedMissionId="mission-1"
        setSelectedMissionId={vi.fn()}
        selectedMission={undefined}
        loadingMissions={false}
        loading={false}
        showAdvanced={false}
        setShowAdvanced={vi.fn()}
        limit={0}
        setLimit={vi.fn()}
        minScore={0}
        setMinScore={vi.fn()}
        weights={{ skills: 40, tools: 25, industries: 20, softSkills: 15 }}
        setWeights={vi.fn()}
        hasResults={false}
        onSearch={vi.fn()}
        onRefreshKeywords={vi.fn()}
      />
    );

    expect(screen.getByLabelText('profileMatching.selectDeal')).toHaveAttribute('id', 'profile-matching-deal-select');
    expect(screen.getByLabelText('profileMatching.selectMission')).toHaveAttribute('id', 'profile-matching-mission-select');
  });
});
