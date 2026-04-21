import type { JSX } from 'react';
import { Route } from 'react-router-dom';
import { AdminRoute, ManagerRoute } from './routeGuards';
import {
  HomePage,
  ResumesPage,
  UploadPage,
  NewTemplatePage,
  SecurityLogs,
  MetricsPage,
  SettingsPage,
  MissionsPage,
  AdaptationsPage,
  ProfileMatchingPage,
  ResumeAnalysisPage,
  ResumeEntryPage,
  ResumeImprovePage,
  ResumeExportPage,
  ResumeAdaptPage,
  MissionViewPage,
  DealViewPage,
  AdaptationViewPage,
  UserGuidePage,
  FactsPage,
  MetiersPage,
  ClientsPage,
  InsufficientCreditsPage,
  SignIn,
  Register,
  ForgotPasswordPage,
  ResetPasswordPage,
  ConsentResponsePage,
  UserProfilePage,
  PrivacyPolicyPage,
  TermsOfServicePage,
  GdprAuditPage,
  SharedFilePage,
  BackupPage,
  BatchUploadPage,
  BatchJobsPage,
  AdminWorkspacePage,
  FirmCreditsDetailPage,
} from './lazyPages';

type RouteDefinition = {
  element: JSX.Element;
  path: string;
};

function renderRoutes(definitions: RouteDefinition[]): JSX.Element[] {
  return definitions.map(({ path, element }) => (
    <Route key={path} path={path} element={element} />
  ));
}

const publicRoutes: RouteDefinition[] = [
  { path: '/signin', element: <SignIn /> },
  { path: '/register', element: <Register /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/consent/:token', element: <ConsentResponsePage /> },
  { path: '/privacy', element: <PrivacyPolicyPage /> },
  { path: '/terms', element: <TermsOfServicePage /> },
  { path: '/share/:type/:token', element: <SharedFilePage /> },
];

const workspaceRoutes: RouteDefinition[] = [
  { path: '', element: <HomePage /> },
  { path: 'resumes', element: <ResumesPage /> },
  { path: 'resumes/:id', element: <ResumeEntryPage /> },
  { path: 'resumes/:id/analysis', element: <ResumeAnalysisPage /> },
  { path: 'resumes/:id/improve', element: <ResumeImprovePage /> },
  { path: 'resumes/:id/export', element: <ResumeExportPage /> },
  { path: 'resumes/:id/adapt', element: <ResumeAdaptPage /> },
  { path: 'upload', element: <UploadPage /> },
  { path: 'missions', element: <MissionsPage /> },
  { path: 'missions/:id', element: <MissionViewPage /> },
  { path: 'clients', element: <ClientsPage /> },
  { path: 'deals/:id', element: <DealViewPage /> },
  { path: 'adaptations', element: <AdaptationsPage /> },
  { path: 'adaptations/:id', element: <AdaptationViewPage /> },
  { path: 'profile-matching', element: <ProfileMatchingPage /> },
  { path: 'guide', element: <UserGuidePage /> },
  { path: 'profile', element: <UserProfilePage /> },
  { path: 'credits-required', element: <InsufficientCreditsPage /> },
  { path: 'facts', element: <FactsPage /> },
];

const adminRoutes: RouteDefinition[] = [
  { path: 'batch-upload', element: <AdminRoute><BatchUploadPage /></AdminRoute> },
  { path: 'batch-jobs', element: <AdminRoute><BatchJobsPage /></AdminRoute> },
  { path: 'dashboard/security-logs', element: <AdminRoute><SecurityLogs /></AdminRoute> },
  { path: 'dashboard/metrics', element: <AdminRoute><MetricsPage /></AdminRoute> },
  { path: 'settings', element: <AdminRoute><SettingsPage /></AdminRoute> },
  { path: 'metiers', element: <AdminRoute><MetiersPage /></AdminRoute> },
  { path: 'dashboard/gdpr-audit', element: <AdminRoute><GdprAuditPage /></AdminRoute> },
  { path: 'dashboard/backup', element: <AdminRoute><BackupPage /></AdminRoute> },
];

const managerRoutes: RouteDefinition[] = [
  { path: 'admin', element: <ManagerRoute><AdminWorkspacePage /></ManagerRoute> },
  { path: 'admin/firm-credits/:id', element: <ManagerRoute><FirmCreditsDetailPage /></ManagerRoute> },
  { path: 'admin/templates/new', element: <ManagerRoute><NewTemplatePage /></ManagerRoute> },
  { path: 'admin/templates/edit/:id', element: <ManagerRoute><NewTemplatePage /></ManagerRoute> },
];

export function renderPublicRoutes(): JSX.Element[] {
  return renderRoutes(publicRoutes);
}

export function renderWorkspaceRoutes(): JSX.Element[] {
  return renderRoutes(workspaceRoutes);
}

export function renderAdminRoutes(): JSX.Element[] {
  return renderRoutes(adminRoutes);
}

export function renderManagerRoutes(): JSX.Element[] {
  return renderRoutes(managerRoutes);
}
