import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ConsentBadge, { type ConsentStatus } from './ConsentBadge';

vi.mock('@heroicons/react/24/outline', () => ({
  ShieldCheckIcon: (props: Record<string, unknown>) => <svg data-testid="shield-icon" {...props} />,
  ClockIcon: (props: Record<string, unknown>) => <svg data-testid="clock-icon" {...props} />,
  XCircleIcon: (props: Record<string, unknown>) => <svg data-testid="x-circle-icon" {...props} />,
  ExclamationTriangleIcon: (props: Record<string, unknown>) => <svg data-testid="warning-icon" {...props} />,
  ArrowPathIcon: (props: Record<string, unknown>) => <svg data-testid="arrow-path-icon" {...props} />,
  InformationCircleIcon: (props: Record<string, unknown>) => <svg data-testid="info-icon" {...props} />,
  ChevronDownIcon: (props: Record<string, unknown>) => <svg data-testid="chevron-down" {...props} />,
  ChevronUpIcon: (props: Record<string, unknown>) => <svg data-testid="chevron-up" {...props} />,
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => <div {...props}>{children as React.ReactNode}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('ConsentBadge', () => {
  const statuses: ConsentStatus[] = ['not_required', 'pending_consent', 'active', 'refused', 'expired', 'purged', 'error'];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(statuses)('renders without crashing for status %s', (status) => {
    const { container } = render(<ConsentBadge status={status} />);
    expect(container.firstChild).not.toBeNull();
  });

  it('renders compact badge with tooltip content on hover', async () => {
    render(
      <ConsentBadge
        status="active"
        compact
        candidateName="John Doe"
        candidateEmail="john@test.com"
        retentionUntil="2026-04-01T00:00:00.000Z"
      />
    );

    fireEvent.mouseEnter(screen.getByText('consent.status.active'));

    expect(await screen.findByText('consent.badge.candidateName')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@test.com')).toBeInTheDocument();
  });

  it('expands and shows detailed candidate information', async () => {
    render(
      <ConsentBadge
        status="active"
        profileType="external"
        candidateName="John Doe"
        candidateEmail="john@test.com"
        consentRequestedAt="2026-03-01T00:00:00.000Z"
        consentRespondedAt="2026-03-02T00:00:00.000Z"
        retentionUntil="2026-04-01T00:00:00.000Z"
      />
    );

    fireEvent.click(screen.getByRole('button'));

    expect(await screen.findByText('consent.badge.profileType')).toBeInTheDocument();
    expect(screen.getByText('consent.form.profileType.external')).toBeInTheDocument();
    expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0);
    expect(screen.getAllByText('john@test.com').length).toBeGreaterThan(0);
  });

  it('shows resend action for pending consent and calls handler', async () => {
    const onResend = vi.fn().mockResolvedValue(undefined);
    render(
      <ConsentBadge
        status="pending_consent"
        onResend={onResend}
        candidateEmail="john@test.com"
        consentTokenExpiresAt="2026-04-01T00:00:00.000Z"
      />
    );

    fireEvent.click(screen.getByRole('button'));
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[1]);

    await waitFor(() => {
      expect(onResend).toHaveBeenCalled();
    });
  });

  it('does not trigger resend when no handler is provided', () => {
    render(<ConsentBadge status="pending_consent" />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByTestId('arrow-path-icon')).toBeNull();
  });
});
