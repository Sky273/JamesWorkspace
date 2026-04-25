import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChatbotTab } from './ChatbotTab';

describe('ChatbotTab', () => {
  it('toggles the chatbot setting', () => {
    const onInputChange = vi.fn();

    render(
      <ChatbotTab
        formData={{ chatbotEnabled: 'on' }}
        onInputChange={onInputChange}
        t={(key: string) => key}
      />
    );

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByRole('switch')).toHaveClass('settings-switch');

    fireEvent.click(screen.getByRole('switch'));

    expect(onInputChange).toHaveBeenNthCalledWith(1, 'chatbotEnabled', 'off');
  });
});
