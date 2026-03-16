/**
 * Tests for ErrorBoundary component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import ErrorBoundary, { ErrorDisplay } from './ErrorBoundary';

// Mock logger
vi.mock('../utils/logger.frontend', () => ({
    default: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
    createLogger: () => ({ log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
}));

// Mock apiInterceptor
vi.mock('../utils/apiInterceptor', () => ({
    isSessionRedirectError: (error: unknown) =>
        error instanceof Error && error.name === 'SessionRedirectError',
}));

// Mock heroicons
vi.mock('@heroicons/react/24/outline', () => ({
    ExclamationTriangleIcon: (props: Record<string, unknown>) => <svg data-testid="warning-icon" {...props} />,
    ChevronDownIcon: (props: Record<string, unknown>) => <svg data-testid="chevron-down" {...props} />,
    ChevronUpIcon: (props: Record<string, unknown>) => <svg data-testid="chevron-up" {...props} />,
    ArrowPathIcon: (props: Record<string, unknown>) => <svg data-testid="arrow-path" {...props} />,
}));

describe('ErrorBoundary', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Suppress console.error from React's error boundary
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('should render children when no error', () => {
        const { getByText } = render(
            <ErrorBoundary>
                <div>Child Content</div>
            </ErrorBoundary>
        );

        expect(getByText('Child Content')).toBeDefined();
    });

    it('should render error display when child throws', () => {
        const ThrowingComponent = () => {
            throw new Error('Test error');
        };

        const { getByText } = render(
            <ErrorBoundary>
                <ThrowingComponent />
            </ErrorBoundary>
        );

        expect(getByText('Test error')).toBeDefined();
    });

    it('should render custom fallback when provided', () => {
        const ThrowingComponent = () => {
            throw new Error('Crash');
        };

        const { getByText } = render(
            <ErrorBoundary fallback={<div>Custom Fallback</div>}>
                <ThrowingComponent />
            </ErrorBoundary>
        );

        expect(getByText('Custom Fallback')).toBeDefined();
    });

    it('should redirect on auth errors instead of showing error UI', () => {
        const mockReplace = vi.fn();
        Object.defineProperty(window, 'location', {
            value: { replace: mockReplace, href: '' },
            writable: true,
        });

        const ThrowingComponent = () => {
            const err = new Error('jwt malformed');
            throw err;
        };

        const { queryByText } = render(
            <ErrorBoundary>
                <ThrowingComponent />
            </ErrorBoundary>
        );

        // Should not show error UI for auth errors
        expect(queryByText('jwt malformed')).toBeNull();
    });
});

describe('ErrorDisplay', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should display error message', () => {
        const error = new Error('Something went wrong');

        const { getByText } = render(
            <ErrorDisplay error={error} errorInfo={null} />
        );

        expect(getByText('Something went wrong')).toBeDefined();
    });

    it('should display default message for null error', () => {
        const { container } = render(
            <ErrorDisplay error={null} errorInfo={null} />
        );

        expect(container.textContent).toContain("erreur inconnue");
    });

    it('should show retry button', () => {
        const { getByText } = render(
            <ErrorDisplay error={new Error('Oops')} errorInfo={null} />
        );

        expect(getByText('Recharger la page')).toBeDefined();
    });

    it('should toggle details visibility', () => {
        const error = new Error('Test error');
        const { getByText, queryByText } = render(
            <ErrorDisplay error={error} errorInfo={null} />
        );

        // Initially details section is hidden
        expect(queryByText('Masquer les détails')).toBeNull();

        // Click to show details
        fireEvent.click(getByText('Voir les détails techniques'));

        // Should now show hide button
        expect(getByText('Masquer les détails')).toBeDefined();
    });

    it('should call onRetry callback', () => {
        const onRetry = vi.fn();
        const { getByText } = render(
            <ErrorDisplay error={new Error('Test')} errorInfo={null} onRetry={onRetry} />
        );

        fireEvent.click(getByText('Recharger la page'));
        expect(onRetry).toHaveBeenCalled();
    });
});
