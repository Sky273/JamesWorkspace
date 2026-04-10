import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const stableT = (key: string, options?: { returnObjects?: boolean }) => {
  if (options?.returnObjects) {
    if (key === 'profileMatching.searchingLoadingSteps') {
      return ['scan', 'score', 'rank'];
    }
    if (key === 'profileMatching.analyzingLoadingSteps') {
      return ['read', 'evaluate', 'synthesize'];
    }
  }
  return key;
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: stableT,
  }),
}));

import ProfileMatchingOverlay from './ProfileMatchingOverlay';

describe('ProfileMatchingOverlay', () => {
  it('renders a fullscreen portal for searching mode', () => {
    render(<ProfileMatchingOverlay mode="searching" />);

    expect(screen.getByText('profileMatching.searchingProfiles')).toBeInTheDocument();
    expect(screen.getByText('profileMatching.searchingProfilesDescription')).toBeInTheDocument();
    expect(screen.getByText('profileMatching.searchingEstimatedTime')).toBeInTheDocument();
    expect(screen.getByText('scan')).toBeInTheDocument();
    expect(document.body.textContent).toContain('profileMatching.searchingProfiles');
  });

  it('switches content for analyzing mode', () => {
    render(<ProfileMatchingOverlay mode="analyzing" />);

    expect(screen.getByText('profileMatching.analyzingProfile')).toBeInTheDocument();
    expect(screen.getAllByText('profileMatching.analyzingProfileDescription').length).toBeGreaterThan(0);
    expect(screen.getByText('read')).toBeInTheDocument();
  });
});
