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
});
