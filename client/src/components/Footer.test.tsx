/**
 * Tests for Footer component
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Footer from './Footer';

// Mock ApteaLogo
vi.mock('./ApteaLogo', () => ({
    default: (props: Record<string, unknown>) => <div data-testid="aptea-logo" {...props} />,
}));

const renderFooter = () => {
    return render(
        <BrowserRouter>
            <Footer />
        </BrowserRouter>
    );
};

describe('Footer', () => {
    it('should render the footer element', () => {
        const { container } = renderFooter();
        const footer = container.querySelector('footer');
        expect(footer).not.toBeNull();
    });

    it('should render Aptea logo with link', () => {
        const { getByTestId, container } = renderFooter();
        expect(getByTestId('aptea-logo')).toBeDefined();
        const link = container.querySelector('a[href="https://www.aptea.net/"]');
        expect(link).not.toBeNull();
        expect(link?.getAttribute('target')).toBe('_blank');
    });

    it('should render privacy link', () => {
        const { getByText } = renderFooter();
        const link = getByText('footer.privacy');
        expect(link).toBeDefined();
        expect(link.closest('a')?.getAttribute('href')).toBe('/privacy');
    });

    it('should render terms link', () => {
        const { getByText } = renderFooter();
        const link = getByText('footer.terms');
        expect(link).toBeDefined();
        expect(link.closest('a')?.getAttribute('href')).toBe('/terms');
    });

    it('should render copyright with current year', () => {
        const { container } = renderFooter();
        const year = new Date().getFullYear().toString();
        expect(container.textContent).toContain(year);
        expect(container.textContent).toContain('Aptea');
    });

    it('should render all rights reserved text', () => {
        const { container } = renderFooter();
        expect(container.textContent).toContain('footer.allRightsReserved');
    });
});
