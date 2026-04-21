import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { KanbanHeader } from './MissionPipelineKanban.parts';

describe('KanbanHeader', () => {
  it('renders a refresh button and triggers the refresh handler', () => {
    const onRefresh = vi.fn();

    render(
      <KanbanHeader
        addCandidateLabel="Ajouter"
        candidateCount={3}
        candidatesLabel="candidats"
        missionTitle="Mission test"
        onAddCandidate={vi.fn()}
        onRefresh={onRefresh}
        refreshLabel="Rafraichir"
        title="Pipeline"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Rafraichir' }));

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
