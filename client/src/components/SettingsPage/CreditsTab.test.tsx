import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CreditsTab from './CreditsTab';

describe('CreditsTab', () => {
  it('renders all configurable AI credit actions and the initial firm grant', () => {
    const onInputChange = vi.fn();

    render(
      <CreditsTab
        formData={{
          firmInitialCredits: 1000,
          aiCreditChatbotMessage: 1,
          aiCreditResumeAiModify: 5,
          aiCreditTemplateExtract: 15,
          aiCreditResumeAnalysis: 25,
          aiCreditResumeImprovement: 75,
          aiCreditResumeAdaptation: 50,
          aiCreditResumeMatch: 8,
          aiCreditProfileSearch: 12,
          aiCreditProfileAnalysis: 25,
          aiMaxTokensChatbotMessage: 4000,
          aiMaxTokensResumeAiModify: 8192,
          aiMaxTokensTemplateExtract: 32000,
          aiMaxTokensResumeAnalysis: 16000,
          aiMaxTokensResumeImprovement: 16384,
          aiMaxTokensResumeAdaptation: 8192,
          aiMaxTokensResumeMatch: 4096,
          aiMaxTokensProfileSearch: 2048,
          aiMaxTokensProfileAnalysis: 3072,
        }}
        onInputChange={onInputChange}
        t={(key) => key}
      />
    );

    expect(screen.getByTestId('firm-initial-credits')).toHaveValue(1000);
    expect(screen.getByTestId('aiCreditResumeAnalysis')).toHaveValue(25);
    expect(screen.getByTestId('aiCreditResumeImprovement')).toHaveValue(75);
    expect(screen.getByTestId('aiCreditResumeAdaptation')).toHaveValue(50);
    expect(screen.getByTestId('aiCreditProfileAnalysis')).toHaveValue(25);
    expect(screen.getByTestId('aiCreditProfileSearch')).toHaveValue(12);
    expect(screen.getByTestId('aiCreditResumeMatch')).toHaveValue(8);
    expect(screen.getByTestId('aiCreditResumeAiModify')).toHaveValue(5);
    expect(screen.getByTestId('aiCreditTemplateExtract')).toHaveValue(15);
    expect(screen.getByTestId('aiCreditChatbotMessage')).toHaveValue(1);
    expect(screen.getByTestId('aiMaxTokensResumeAnalysis')).toHaveValue(16000);
    expect(screen.getByTestId('aiMaxTokensResumeImprovement')).toHaveValue(16384);
    expect(screen.getByTestId('aiMaxTokensResumeAdaptation')).toHaveValue(8192);
    expect(screen.getByTestId('aiMaxTokensProfileAnalysis')).toHaveValue(3072);
  });

  it('propagates numeric changes through onInputChange', () => {
    const onInputChange = vi.fn();

    render(
      <CreditsTab
        formData={{
          firmInitialCredits: 1000,
          aiCreditChatbotMessage: 1,
          aiCreditResumeAiModify: 5,
          aiCreditTemplateExtract: 15,
          aiCreditResumeAnalysis: 25,
          aiCreditResumeImprovement: 75,
          aiCreditResumeAdaptation: 50,
          aiCreditResumeMatch: 8,
          aiCreditProfileSearch: 12,
          aiCreditProfileAnalysis: 25,
          aiMaxTokensChatbotMessage: 4000,
          aiMaxTokensResumeAiModify: 8192,
          aiMaxTokensTemplateExtract: 32000,
          aiMaxTokensResumeAnalysis: 16000,
          aiMaxTokensResumeImprovement: 16384,
          aiMaxTokensResumeAdaptation: 8192,
          aiMaxTokensResumeMatch: 4096,
          aiMaxTokensProfileSearch: 2048,
          aiMaxTokensProfileAnalysis: 3072,
        }}
        onInputChange={onInputChange}
        t={(key) => key}
      />
    );

    fireEvent.change(screen.getByTestId('firm-initial-credits'), { target: { value: '1500' } });
    fireEvent.change(screen.getByTestId('aiCreditResumeAnalysis'), { target: { value: '30' } });
    fireEvent.change(screen.getByTestId('aiMaxTokensResumeAnalysis'), { target: { value: '12000' } });

    expect(onInputChange).toHaveBeenCalledWith('firmInitialCredits', 1500);
    expect(onInputChange).toHaveBeenCalledWith('aiCreditResumeAnalysis', 30);
    expect(onInputChange).toHaveBeenCalledWith('aiMaxTokensResumeAnalysis', 12000);
  });
});
