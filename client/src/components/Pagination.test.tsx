/**
 * Tests for Pagination component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import Pagination from './Pagination';

describe('Pagination', () => {
    const defaultProps = {
        currentPage: 1,
        totalPages: 5,
        totalCount: 50,
        pageSize: 10,
        onPageChange: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should not render when loading', () => {
        const { container } = render(<Pagination {...defaultProps} loading={true} />);
        expect(container.firstChild).toBeNull();
    });

    it('should not render when totalCount is 0', () => {
        const { container } = render(<Pagination {...defaultProps} totalCount={0} />);
        expect(container.firstChild).toBeNull();
    });

    it('should display showing info text', () => {
        const { getByText } = render(<Pagination {...defaultProps} />);
        expect(getByText('1-10')).toBeDefined();
        expect(getByText('50')).toBeDefined();
    });

    it('should display correct range for middle page', () => {
        const { getByText } = render(
            <Pagination {...defaultProps} currentPage={3} />
        );
        expect(getByText('21-30')).toBeDefined();
    });

    it('should cap range to totalCount on last page', () => {
        const { getByText } = render(
            <Pagination {...defaultProps} currentPage={5} totalCount={45} />
        );
        expect(getByText('41-45')).toBeDefined();
    });

    it('should call onPageChange when clicking next', () => {
        const onPageChange = vi.fn();
        const { getByTitle } = render(
            <Pagination {...defaultProps} onPageChange={onPageChange} />
        );

        fireEvent.click(getByTitle('common.next'));
        expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it('should call onPageChange when clicking previous', () => {
        const onPageChange = vi.fn();
        const { getByTitle } = render(
            <Pagination {...defaultProps} currentPage={3} onPageChange={onPageChange} />
        );

        fireEvent.click(getByTitle('common.previous'));
        expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it('should call onPageChange when clicking first', () => {
        const onPageChange = vi.fn();
        const { getByTitle } = render(
            <Pagination {...defaultProps} currentPage={3} onPageChange={onPageChange} />
        );

        fireEvent.click(getByTitle('common.first'));
        expect(onPageChange).toHaveBeenCalledWith(1);
    });

    it('should call onPageChange when clicking last', () => {
        const onPageChange = vi.fn();
        const { getByTitle } = render(
            <Pagination {...defaultProps} onPageChange={onPageChange} />
        );

        fireEvent.click(getByTitle('common.last'));
        expect(onPageChange).toHaveBeenCalledWith(5);
    });

    it('should disable previous/first buttons on first page', () => {
        const { getByTitle } = render(
            <Pagination {...defaultProps} currentPage={1} />
        );

        expect(getByTitle('common.previous')).toBeDisabled();
        expect(getByTitle('common.first')).toBeDisabled();
    });

    it('should disable next/last buttons on last page', () => {
        const { getByTitle } = render(
            <Pagination {...defaultProps} currentPage={5} />
        );

        expect(getByTitle('common.next')).toBeDisabled();
        expect(getByTitle('common.last')).toBeDisabled();
    });

    it('should not show navigation when only one page', () => {
        const { queryByTitle } = render(
            <Pagination {...defaultProps} totalPages={1} totalCount={5} />
        );

        expect(queryByTitle('common.next')).toBeNull();
        expect(queryByTitle('common.previous')).toBeNull();
    });

    it('should include itemName in display', () => {
        const { container } = render(
            <Pagination {...defaultProps} itemName="resumes" />
        );

        expect(container.textContent).toContain('resumes');
    });
});
