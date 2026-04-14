import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Outlet } from 'react-router-dom';
import App from './App';

let authState = {
  isAuthenticated: false,
  user: null as null | { role: string },
};

const renderPage = (label: string) => {
  const MockPage = () => <div>{label}</div>;
  MockPage.displayName = `${label}MockPage`;
  return MockPage;
};

vi.mock('./context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="auth-provider">{children}</div>,
  useAuth: () => authState,
}));

vi.mock('./context/ResumeContext', () => ({
  ResumeProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="resume-provider">{children}</div>,
}));

vi.mock('./context/ChatbotContext', () => ({
  ChatbotProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="chatbot-provider">{children}</div>,
}));

vi.mock('./components/ErrorBoundary', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./components/Layout', () => ({
  default: () => <div><span>layout</span><Outlet /></div>,
}));

vi.mock('./pages/HomePage', () => ({ default: renderPage('home-page') }));
vi.mock('./pages/PublicHomePage', () => ({ default: renderPage('public-home-page') }));
vi.mock('./pages/ResumesPage', () => ({ default: renderPage('resumes-page') }));
vi.mock('./pages/TemplatesPage', () => ({ default: renderPage('templates-page') }));
vi.mock('./pages/UploadPage', () => ({ default: renderPage('upload-page') }));
vi.mock('./pages/NewTemplatePage', () => ({ default: renderPage('new-template-page') }));
vi.mock('./pages/TagsManagement', () => ({ default: renderPage('tags-page') }));
vi.mock('./pages/UsersManagement', () => ({ default: renderPage('users-page') }));
vi.mock('./pages/SecurityLogs', () => ({ default: renderPage('security-logs-page') }));
vi.mock('./pages/MetricsPage', () => ({ default: renderPage('metrics-page') }));
vi.mock('./pages/SettingsPage', () => ({ default: renderPage('settings-page') }));
vi.mock('./pages/MissionsPage', () => ({ default: renderPage('missions-page') }));
vi.mock('./pages/AdaptationsPage', () => ({ default: renderPage('adaptations-page') }));
vi.mock('./pages/ProfileMatchingPage', () => ({ default: renderPage('profile-matching-page') }));
vi.mock('./pages/ResumeAnalysisPage', () => ({ default: renderPage('resume-analysis-page') }));
vi.mock('./pages/ResumeImprovePage', () => ({ default: renderPage('resume-improve-page') }));
vi.mock('./pages/ResumeExportPage', () => ({ default: renderPage('resume-export-page') }));
vi.mock('./pages/ResumeAdaptPage', () => ({ default: renderPage('resume-adapt-page') }));
vi.mock('./pages/MissionViewPage', () => ({ default: renderPage('mission-view-page') }));
vi.mock('./pages/DealViewPage', () => ({ default: renderPage('deal-view-page') }));
vi.mock('./pages/AdaptationViewPage', () => ({ default: renderPage('adaptation-view-page') }));
vi.mock('./pages/UserGuidePage', () => ({ default: renderPage('guide-page') }));
vi.mock('./pages/FactsPage', () => ({ default: renderPage('facts-page') }));
vi.mock('./pages/MetiersPage', () => ({ default: renderPage('metiers-page') }));
vi.mock('./pages/ClientsPage', () => ({ default: renderPage('clients-page') }));
vi.mock('./pages/admin/EmailTemplatesPage', () => ({ default: renderPage('email-templates-page') }));
vi.mock('./components/SignIn', () => ({ default: renderPage('signin-page') }));
vi.mock('./components/Register', () => ({ default: renderPage('register-page') }));
vi.mock('./pages/ForgotPasswordPage', () => ({ default: renderPage('forgot-password-page') }));
vi.mock('./pages/ResetPasswordPage', () => ({ default: renderPage('reset-password-page') }));
vi.mock('./pages/ConsentResponsePage', () => ({ default: renderPage('consent-response-page') }));
vi.mock('./pages/UserProfilePage', () => ({ default: renderPage('user-profile-page') }));
vi.mock('./pages/PrivacyPolicyPage', () => ({ default: renderPage('privacy-page') }));
vi.mock('./pages/TermsOfServicePage', () => ({ default: renderPage('terms-page') }));
vi.mock('./pages/GdprAuditPage', () => ({ default: renderPage('gdpr-audit-page') }));
vi.mock('./pages/SharedFilePage', () => ({ default: renderPage('shared-file-page') }));
vi.mock('./pages/BackupPage', () => ({ default: renderPage('backup-page') }));
vi.mock('./pages/BatchUploadPage', () => ({ default: renderPage('batch-upload-page') }));
vi.mock('./pages/BatchJobsPage', () => ({ default: renderPage('batch-jobs-page') }));
vi.mock('./pages/AdminWorkspacePage', () => ({ default: renderPage('admin-workspace-page') }));
vi.mock('./components/AppToaster', () => ({ default: () => <div data-testid="app-toaster" /> }));

describe('App routing', () => {
  beforeEach(() => {
    authState = {
      isAuthenticated: false,
      user: null,
    };
    window.history.replaceState({}, '', '/');
  });

  it('redirects unauthenticated users to the signin page on protected routes', async () => {
    window.history.replaceState({}, '', '/resumes');

    render(<App />);

    expect(await screen.findByText('public-home-page')).toBeInTheDocument();
  });

  it('redirects non-admin users away from admin routes', async () => {
    authState = {
      isAuthenticated: true,
      user: { role: 'user' },
    };
    window.history.replaceState({}, '', '/settings');

    render(<App />);

    expect(await screen.findByText('home-page')).toBeInTheDocument();
  });

  it('renders admin pages for admin users', async () => {
    authState = {
      isAuthenticated: true,
      user: { role: 'admin' },
    };
    window.history.replaceState({}, '', '/settings');

    render(<App />);

    expect(await screen.findByText('settings-page')).toBeInTheDocument();
  });

  it('renders the admin workspace on the consolidated administration route for admin users', async () => {
    authState = {
      isAuthenticated: true,
      user: { role: 'admin' },
    };
    window.history.replaceState({}, '', '/admin?tab=emailTemplates');

    render(<App />);

    expect(await screen.findByText('admin-workspace-page')).toBeInTheDocument();
  });

  it('renders public share pages without auth and app providers', async () => {
    window.history.replaceState({}, '', '/share/pdf/public-token');

    render(<App />);

    expect(await screen.findByText('shared-file-page')).toBeInTheDocument();
    expect(screen.queryByTestId('auth-provider')).not.toBeInTheDocument();
    expect(screen.queryByTestId('resume-provider')).not.toBeInTheDocument();
    expect(screen.queryByTestId('chatbot-provider')).not.toBeInTheDocument();
  });
});
