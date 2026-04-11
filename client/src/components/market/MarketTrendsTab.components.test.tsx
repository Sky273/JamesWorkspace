import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MarketTrendsHeader } from './MarketTrendsTab.components';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

describe('MarketTrendsHeader', () => {
  it('uses localized labels for the DYN_1 collection action', () => {
    const onCollect = vi.fn();
    const onCollectDynamics = vi.fn();
    const onRefresh = vi.fn();

    render(
      <MarketTrendsHeader
        canCollectMarketTrends
        error={null}
        loading={false}
        onCollect={onCollect}
        onCollectDynamics={onCollectDynamics}
        onRefresh={onRefresh}
      />,
    );

    const collectDynamicsButton = screen.getByRole('button', { name: 'marketRadar.trends.collectDynamics.button' });
    expect(collectDynamicsButton).toHaveAttribute('title', 'marketRadar.trends.collectDynamics.title');

    fireEvent.click(collectDynamicsButton);
    expect(onCollectDynamics).toHaveBeenCalledTimes(1);
  });

  it('hides collection actions when the user cannot collect market trends', () => {
    render(
      <MarketTrendsHeader
        canCollectMarketTrends={false}
        error={null}
        loading={false}
        onCollect={vi.fn()}
        onCollectDynamics={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'marketRadar.trends.collection.button' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'marketRadar.trends.collectDynamics.button' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'marketRadar.trends.refresh' })).toBeInTheDocument();
  });
});
