import { createElement } from 'react';
import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import MissionSelector from './MissionSelector';

const mockAuthGet = vi.fn();

function createMotionElement(tag: string) {
  const MotionElement = ({ children, ...props }: Record<string, unknown> & { children?: ReactNode }) =>
    createElement(tag, props, children);
  MotionElement.displayName = `MockMotion(${tag})`;
  return MotionElement;
}

vi.mock('framer-motion', () => ({
  motion: {
    div: createMotionElement('div'),
    button: createMotionElement('button'),
  },
}));

vi.mock('../hooks/useAuthFetch', () => ({
  useAuthFetch: () => ({ authGet: mockAuthGet }),
}));

vi.mock('./page/SearchField', () => ({
  default: ({
    placeholder,
    value,
    onChange,
  }: {
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
  }) => (
    <input
      aria-label="mission-search"
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

describe('MissionSelector', () => {
  beforeEach(() => {
    mockAuthGet.mockReset();
    mockAuthGet.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
  });

  it('localizes the visible labels and empty state', async () => {
    render(<MissionSelector onSelect={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByText('profileMatching.missionSelector.title')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('profileMatching.missionSelector.searchPlaceholder')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('profileMatching.missionSelector.noResultsEmpty')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'common.cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'profileMatching.missionSelector.continue' })).toBeInTheDocument();
  });
});
