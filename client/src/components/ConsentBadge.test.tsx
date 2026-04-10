import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const stableT = (key: string) => key;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: stableT,
  }),
}));

import ConsentBadge from './ConsentBadge';

describe('ConsentBadge', () => {
  it('shows compact tooltip details on hover', async () => {
    render(
      <ConsentBadge
        compact
        status="active"
        candidateName="Ada Lovelace"
        candidateEmail="ada@example.com"
        retentionUntil="2026-12-31T00:00:00.000Z"
      />
    );

    fireEvent.mouseEnter(screen.getByText('consent.status.active'));

    await waitFor(() => {
      expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    });
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByText('consent.badge.retentionUntil')).toBeInTheDocument();
  });

  it('expands full details and resends consent request', async () => {
    const onResend = vi.fn().mockResolvedValue(undefined);

    render(
      <ConsentBadge
        status="pending_consent"
        profileType="external"
        candidateName="Ada Lovelace"
        candidateEmail="ada@example.com"
        consentRequestedAt="2026-04-01T00:00:00.000Z"
        onResend={onResend}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /consent.badge.title/i }));

    expect(screen.getByText('consent.badge.profileType')).toBeInTheDocument();
    expect(screen.getByText('consent.form.profileType.external')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'consent.badge.resend' }));
    await waitFor(() => {
      expect(onResend).toHaveBeenCalledTimes(1);
    });
  });
});
