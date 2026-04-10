import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ChatbotProvider, useChatbot } from './ChatbotContext';

function ChatbotConsumer() {
  const { chatbotEnabled, setChatbotEnabled, refreshChatbotStatus } = useChatbot();

  return (
    <div>
      <div>chatbot-enabled:{String(chatbotEnabled)}</div>
      <button onClick={() => setChatbotEnabled(false)}>disable-chatbot</button>
      <button onClick={() => setChatbotEnabled(true)}>enable-chatbot</button>
      <button onClick={() => refreshChatbotStatus()}>refresh-chatbot</button>
    </div>
  );
}

describe('ChatbotContext', () => {
  it('toggles chatbot state and keeps rendering after refresh requests', () => {
    render(
      <ChatbotProvider>
        <ChatbotConsumer />
      </ChatbotProvider>
    );

    expect(screen.getByText('chatbot-enabled:true')).toBeInTheDocument();

    fireEvent.click(screen.getByText('disable-chatbot'));
    expect(screen.getByText('chatbot-enabled:false')).toBeInTheDocument();

    fireEvent.click(screen.getByText('refresh-chatbot'));
    expect(screen.getByText('chatbot-enabled:false')).toBeInTheDocument();

    fireEvent.click(screen.getByText('enable-chatbot'));
    expect(screen.getByText('chatbot-enabled:true')).toBeInTheDocument();
  });
});
