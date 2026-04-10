import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import OverviewTab from './OverviewTab';

const t = (key: string) => key;

describe('OverviewTab', () => {
  it('renders the initial analysis directly when the resume is not improved', () => {
    render(
      <OverviewTab
        resume={{
          'Global Rating': '72%',
          'Executive Summary Score': '80',
          'Skills Score': '70',
          'Experience Score': '68',
          'Education Score': '77',
          'ATS Score': '74',
          'Hobbies Languages Score': '60',
          'Key Improvements': JSON.stringify({
            executiveSummary: ['Tighten the summary'],
            skills: ['Add more keywords'],
          }),
          Status: 'analyzed',
        }}
        t={t}
      />
    );

    expect(screen.getAllByText('resume.analysis.globalRating').length).toBeGreaterThan(0);
    expect(screen.getByText('72%')).toBeInTheDocument();
    expect(screen.getByText('Tighten the summary')).toBeInTheDocument();
    expect(screen.queryByText('resume.analysis.tabs.postImprovementAnalysis')).not.toBeInTheDocument();
  });

  it('switches between initial and post-improvement analyses for improved resumes', () => {
    render(
      <OverviewTab
        resume={{
          'Global Rating': 68,
          'Improved Global Rating': 91,
          'Executive Summary Score': 60,
          'Improved Executive Summary Score': 90,
          'Skills Score': 70,
          'Improved Skills Score': 95,
          'Experience Score': 65,
          'Improved Experience Score': 88,
          'Education Score': 72,
          'Improved Education Score': 90,
          'ATS Score': 61,
          'Improved ATS Score': 85,
          'Hobbies Languages Score': 58,
          'Improved Hobbies Languages Score': 75,
          'Key Improvements': JSON.stringify({ executiveSummary: ['Initial summary note'] }),
          'Improved Key Improvements': JSON.stringify({ executiveSummary: ['Improved summary note'] }),
          Status: 'Improved',
        }}
        t={t}
      />
    );

    expect(screen.getByText('resume.analysis.tabs.initialAnalysis')).toBeInTheDocument();
    expect(screen.getByText('resume.analysis.tabs.postImprovementAnalysis')).toBeInTheDocument();
    expect(screen.getByText('91%')).toBeInTheDocument();
    expect(screen.getByText('Improved summary note')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'resume.analysis.tabs.initialAnalysis' }));

    expect(screen.getByText('68%')).toBeInTheDocument();
    expect(screen.getByText('Initial summary note')).toBeInTheDocument();
  });
});
