import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Breadcrumbs from './Breadcrumbs';

vi.mock('../context/ResumeContext', () => ({
  useResume: () => ({
    currentResume: {
      Name: 'Jean Dupont',
      'File Name': 'resume.pdf',
    },
  }),
}));

const renderBreadcrumbs = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<Breadcrumbs tone="header" />} />
      </Routes>
    </MemoryRouter>
  );

describe('Breadcrumbs', () => {
  it('renders home breadcrumb on the root page', () => {
    renderBreadcrumbs('/');

    expect(screen.getByLabelText('Breadcrumb')).toBeInTheDocument();
    expect(screen.getAllByRole('link')[0]).toHaveAttribute('href', '/');
    expect(screen.getByText('navigation.home')).toBeInTheDocument();
  });

  it('renders dynamic resume detail breadcrumb for analysis pages', () => {
    renderBreadcrumbs('/resumes/123/analysis');

    expect(screen.getByText('navigation.resumes')).toBeInTheDocument();
    expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
    expect(screen.getByText('resume.steps.analysis')).toBeInTheDocument();
  });

  it('renders dashboard child routes without Administration breadcrumb', () => {
    renderBreadcrumbs('/dashboard/security-logs');

    expect(screen.queryByText('navigation.admin')).toBeNull();
    expect(screen.getByText('navigation.securityLogs')).toBeInTheDocument();
  });

  it.each([
    ['/settings', 'navigation.settings'],
    ['/guide', 'navigation.userGuide'],
    ['/profile', 'navigation.profile'],
    ['/profile-matching', 'navigation.profileMatching'],
    ['/facts', 'navigation.facts'],
    ['/metiers', 'navigation.metiers'],
    ['/upload', 'navigation.upload'],
    ['/batch-upload', 'batchUpload.title'],
    ['/batch-jobs', 'navigation.jobs'],
    ['/templates/new', 'templates.newTemplate'],
    ['/templates/edit/42', 'templates.editTemplate'],
    ['/missions/42', 'missions.details'],
    ['/adaptations/42', 'adaptations.details'],
    ['/dashboard/users', 'navigation.users'],
    ['/dashboard/metrics', 'navigation.metrics'],
    ['/dashboard/tags', 'navigation.tags'],
    ['/email-templates', 'navigation.emailTemplates'],
    ['/dashboard/gdpr-audit', 'navigation.gdprAudit'],
    ['/dashboard/backup', 'navigation.backup'],
  ])('renders %s breadcrumb trail', (path, expectedLabel) => {
    renderBreadcrumbs(path);
    expect(screen.getAllByText(expectedLabel).length).toBeGreaterThan(0);
  });

  it('renders resume export step for detail routes', () => {
    renderBreadcrumbs('/resumes/123/export');

    expect(screen.getByText('resume.steps.export')).toBeInTheDocument();
    expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
  });

  it('renders custom breadcrumb items when provided', () => {
    render(
      <MemoryRouter>
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Custom', current: true }]} />
      </MemoryRouter>
    );

    expect(screen.getByText('Custom')).toBeInTheDocument();
  });
});
