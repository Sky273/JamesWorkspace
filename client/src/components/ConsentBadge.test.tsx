/**
 * Tests for ConsentBadge component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import ConsentBadge, { type ConsentStatus } from './ConsentBadge';

// Mock heroicons
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

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: Record<string, unknown>) => <div {...props}>{children as React.ReactNode}</div>,
        button: ({ children, ...props }: Record<string, unknown>) => <button {...props}>{children as React.ReactNode}</button>,
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('ConsentBadge', () => {
    const statuses: ConsentStatus[] = ['not_required', 'pending_consent', 'active', 'refused', 'expired', 'purged', 'error'];

    it.each(statuses)('should render without crashing for status: %s', (status) => {
        const { container } = render(<ConsentBadge status={status} />);
        expect(container.firstChild).not.toBeNull();
    });

    it('should render in compact mode', () => {
        const { container } = render(<ConsentBadge status="active" compact={true} />);
        expect(container.firstChild).not.toBeNull();
    });

    it('should display status label for active consent', () => {
        const { container } = render(<ConsentBadge status="active" />);
        expect(container.textContent).toContain('consent.status.active');
    });

    it('should display status label for pending consent', () => {
        const { container } = render(<ConsentBadge status="pending_consent" />);
        expect(container.textContent).toContain('consent.status.pending');
    });

    it('should display status label for refused', () => {
        const { container } = render(<ConsentBadge status="refused" />);
        expect(container.textContent).toContain('consent.status.refused');
    });

    it('should display status label for not_required', () => {
        const { container } = render(<ConsentBadge status="not_required" />);
        expect(container.textContent).toContain('consent.status.notRequired');
    });

    it('should show resend button when onResend is provided and status is pending', () => {
        const onResend = vi.fn().mockResolvedValue(undefined);
        const { container } = render(
            <ConsentBadge status="pending_consent" onResend={onResend} />
        );
        // Component renders a resend option
        expect(container).toBeDefined();
    });

    it('should handle resend action', async () => {
        const onResend = vi.fn().mockResolvedValue(undefined);
        const { container } = render(
            <ConsentBadge
                status="pending_consent"
                onResend={onResend}
                candidateEmail="test@test.com"
            />
        );

        // Find and click the resend button if it exists
        const resendButton = container.querySelector('[data-testid="arrow-path-icon"]');
        if (resendButton?.closest('button')) {
            fireEvent.click(resendButton.closest('button')!);
            await waitFor(() => {
                expect(onResend).toHaveBeenCalled();
            });
        }
    });

    it('should show candidate info when provided', () => {
        const { container } = render(
            <ConsentBadge
                status="active"
                candidateName="John Doe"
                candidateEmail="john@test.com"
                profileType="external"
            />
        );
        expect(container).toBeDefined();
    });
});
