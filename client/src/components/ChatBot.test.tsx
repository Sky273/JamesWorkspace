import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ChatBot from './ChatBot';

const authGetMock = vi.fn();
const authPostMock = vi.fn();
const setChatbotEnabledMock = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      name: 'Alice',
    },
  }),
}));

vi.mock('../hooks/useAuthFetch', () => ({
  useAuthFetch: () => ({
    authGet: authGetMock,
    authPost: authPostMock,
  }),
}));

vi.mock('../context/ChatbotContext', () => ({
  useChatbot: () => ({
    chatbotEnabled: true,
    setChatbotEnabled: setChatbotEnabledMock,
  }),
}));

vi.mock('./chatbot/ChatbotWindow', () => ({
  default: ({
    isOpen,
    inputValue,
    onInputChange,
    onSend,
  }: {
    isOpen: boolean;
    inputValue: string;
    onInputChange: (value: string) => void;
    onSend: () => void;
  }) => (
    isOpen ? (
      <div>
        <input
          aria-label="chat-input"
          value={inputValue}
          onChange={(event) => onInputChange(event.target.value)}
        />
        <button type="button" onClick={onSend}>send-chat</button>
      </div>
    ) : null
  ),
}));

describe('ChatBot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authGetMock.mockResolvedValue({
      ok: true,
      json: async () => ({ chatbotEnabled: 'on' }),
    });
    authPostMock.mockResolvedValue({
      ok: true,
      json: async () => ({ response: 'Hello back' }),
    });
  });

  it('includes the just-submitted user message in conversation history', async () => {
    render(<ChatBot />);

    fireEvent.click(screen.getByRole('button', { name: 'chatbot.openChat' }));

    fireEvent.change(screen.getByLabelText('chat-input'), {
      target: { value: 'Bonjour' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'send-chat' }));

    await waitFor(() => {
      expect(authPostMock).toHaveBeenCalledTimes(1);
    });

    expect(authPostMock).toHaveBeenCalledWith('/api/chatbot/message', expect.objectContaining({
      message: 'Bonjour',
      conversationHistory: expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: 'Bonjour',
        }),
      ]),
    }));
  });

  it('disables the chatbot when the presentation endpoint responds with a non-ok status', async () => {
    authGetMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ chatbotEnabled: 'on' }),
    });

    render(<ChatBot />);

    await waitFor(() => {
      expect(setChatbotEnabledMock).toHaveBeenCalledWith(false);
    });
  });
});
