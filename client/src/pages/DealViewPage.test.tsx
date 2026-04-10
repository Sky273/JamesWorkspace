import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DealViewPage from './DealViewPage';

const navigateMock = vi.fn();
const dealDetailViewMock = vi.fn();

let routeParams: { id?: string } = { id: 'deal-42' };
let locationState: { restoreScrollY?: number } | null = { restoreScrollY: 280 };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => routeParams,
    useNavigate: () => navigateMock,
    useLocation: () => ({ state: locationState }),
    Navigate: ({ to }: { to: string }) => <div>navigate:{to}</div>,
  };
});

vi.mock('../components/CRM/DealDetailView', () => ({
  default: (props: {
    dealId: string;
    restoreScrollY: number | null;
    onBack?: () => void;
    onEdit?: (dealId: string) => void;
  }) => {
    dealDetailViewMock(props);
    return (
      <div>
        <span>deal:{props.dealId}</span>
        <span>scroll:{props.restoreScrollY}</span>
        <button onClick={() => props.onBack?.()}>back</button>
        <button onClick={() => props.onEdit?.(props.dealId)}>edit</button>
      </div>
    );
  },
}));

describe('DealViewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeParams = { id: 'deal-42' };
    locationState = { restoreScrollY: 280 };
  });

  it('wires the deal detail view with restore scroll and edit navigation', () => {
    render(<DealViewPage />);

    expect(screen.getByText('deal:deal-42')).toBeInTheDocument();
    expect(screen.getByText('scroll:280')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'edit' }));

    expect(navigateMock).toHaveBeenCalledWith('/clients?tab=deals', {
      state: { editDealId: 'deal-42' },
    });
  });

  it('falls back to the deals tab when going back without enough history', () => {
    Object.defineProperty(window, 'history', {
      configurable: true,
      value: { length: 1 },
    });

    render(<DealViewPage />);

    fireEvent.click(screen.getByRole('button', { name: 'back' }));

    expect(navigateMock).toHaveBeenCalledWith('/clients?tab=deals');
  });
});
