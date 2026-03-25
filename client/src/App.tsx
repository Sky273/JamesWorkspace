/**
 * App Component
 * TypeScript version with lazy loading for better performance
 */

import { ReactNode, lazy, Suspense } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ResumeProvider } from './context/ResumeContext';
import { ChatbotProvider } from './context/ChatbotContext';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import { useAuth } from './context/AuthContext';

// Lazy load pages for code splitting
const HomePage = lazy(() => import('./pages/HomePage'));
const PublicHomePage = lazy(() => import('./pages/PublicHomePage'));
const ResumesPage = lazy(() => import('./pages/ResumesPage'));
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'));
const UploadPage = lazy(() => import('./pages/UploadPage'));
const NewTemplatePage = lazy(() => import('./pages/NewTemplatePage'));
const TagsManagement = lazy(() => import('./pages/TagsManagement'));
const UsersManagement = lazy(() => import('./pages/UsersManagement'));
const SecurityLogs = lazy(() => import('./pages/SecurityLogs'));
const MetricsPage = lazy(() => import('./pages/MetricsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const MissionsPage = lazy(() => import('./pages/MissionsPage'));
const AdaptationsPage = lazy(() => import('./pages/AdaptationsPage'));
const ProfileMatchingPage = lazy(() => import('./pages/ProfileMatchingPage'));
const ResumeAnalysisPage = lazy(() => import('./pages/ResumeAnalysisPage'));
const ResumeImprovePage = lazy(() => import('./pages/ResumeImprovePage'));
const ResumeExportPage = lazy(() => import('./pages/ResumeExportPage'));
const ResumeAdaptPage = lazy(() => import('./pages/ResumeAdaptPage'));
const MissionViewPage = lazy(() => import('./pages/MissionViewPage'));
const AdaptationViewPage = lazy(() => import('./pages/AdaptationViewPage'));
const UserGuidePage = lazy(() => import('./pages/UserGuidePage'));
const FactsPage = lazy(() => import('./pages/FactsPage'));
const MetiersPage = lazy(() => import('./pages/MetiersPage'));
const ClientsPage = lazy(() => import('./pages/ClientsPage'));
const EmailTemplatesPage = lazy(() => import('./pages/admin/EmailTemplatesPage'));
const SignIn = lazy(() => import('./components/SignIn'));
const Register = lazy(() => import('./components/Register'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const ConsentResponsePage = lazy(() => import('./pages/ConsentResponsePage'));
const UserProfilePage = lazy(() => import('./pages/UserProfilePage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'));
const GdprAuditPage = lazy(() => import('./pages/GdprAuditPage'));
const SharedFilePage = lazy(() => import('./pages/SharedFilePage'));
const BackupPage = lazy(() => import('./pages/BackupPage'));
const BatchUploadPage = lazy(() => import('./pages/BatchUploadPage'));
const BatchJobsPage = lazy(() => import('./pages/BatchJobsPage'));
const AppToaster = lazy(() => import('./components/AppToaster'));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
  </div>
);

interface RouteProps {
  children: ReactNode;
}

const publicHomeEnabled = import.meta.env.VITE_PUBLIC_HOME === 'true';
const unauthenticatedRedirectPath = publicHomeEnabled ? '/welcome' : '/signin';

const ProtectedRoute = ({ children }: RouteProps): JSX.Element => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to={unauthenticatedRedirectPath} replace />;
  }

  return <>{children}</>;
};

const AdminRoute = ({ children }: RouteProps): JSX.Element => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const PublicHomeRoute = (): JSX.Element => {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (publicHomeEnabled) {
    return <PublicHomePage />;
  }

  return <Navigate to="/signin" replace />;
};

const App = (): JSX.Element => {
  return (
    <ErrorBoundary>
      <ResumeProvider>
        <ChatbotProvider>
          <Router>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/signin" element={<SignIn />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/consent/:token" element={<ConsentResponsePage />} />
                <Route path="/privacy" element={<PrivacyPolicyPage />} />
                <Route path="/terms" element={<TermsOfServicePage />} />
                <Route path="/share/:type/:token" element={<SharedFilePage />} />
                <Route path="/welcome" element={<PublicHomeRoute />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<HomePage />} />
                  <Route path="resumes" element={<ResumesPage />} />
                  <Route path="resumes/:id" element={<Navigate to="analysis" replace />} />
                  <Route path="resumes/:id/analysis" element={<ResumeAnalysisPage />} />
                  <Route path="resumes/:id/improve" element={<ResumeImprovePage />} />
                  <Route path="resumes/:id/export" element={<ResumeExportPage />} />
                  <Route path="resumes/:id/adapt" element={<ResumeAdaptPage />} />
                  <Route path="upload" element={<UploadPage />} />
                  <Route path="batch-upload" element={<AdminRoute><BatchUploadPage /></AdminRoute>} />
                  <Route path="batch-jobs" element={<AdminRoute><BatchJobsPage /></AdminRoute>} />
                  <Route path="missions" element={<MissionsPage />} />
                  <Route path="missions/:id" element={<MissionViewPage />} />
                  <Route path="clients" element={<ClientsPage />} />
                  <Route path="adaptations" element={<AdaptationsPage />} />
                  <Route path="adaptations/:id" element={<AdaptationViewPage />} />
                  <Route path="profile-matching" element={<ProfileMatchingPage />} />
                  <Route path="guide" element={<UserGuidePage />} />
                  <Route path="profile" element={<UserProfilePage />} />
                  <Route path="templates" element={<AdminRoute><TemplatesPage /></AdminRoute>} />
                  <Route path="templates/new" element={<AdminRoute><NewTemplatePage /></AdminRoute>} />
                  <Route path="templates/edit/:id" element={<AdminRoute><NewTemplatePage /></AdminRoute>} />
                  <Route path="dashboard/tags" element={<AdminRoute><TagsManagement /></AdminRoute>} />
                  <Route path="dashboard/users" element={<AdminRoute><UsersManagement /></AdminRoute>} />
                  <Route path="dashboard/security-logs" element={<AdminRoute><SecurityLogs /></AdminRoute>} />
                  <Route path="dashboard/metrics" element={<AdminRoute><MetricsPage /></AdminRoute>} />
                  <Route path="settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />
                  <Route path="facts" element={<FactsPage />} />
                  <Route path="metiers" element={<AdminRoute><MetiersPage /></AdminRoute>} />
                  <Route path="dashboard/email-templates" element={<AdminRoute><EmailTemplatesPage /></AdminRoute>} />
                  <Route path="dashboard/gdpr-audit" element={<AdminRoute><GdprAuditPage /></AdminRoute>} />
                  <Route path="dashboard/backup" element={<AdminRoute><BackupPage /></AdminRoute>} />
                </Route>
              </Routes>
            </Suspense>
            <Suspense fallback={null}>
              <AppToaster />
            </Suspense>
          </Router>
        </ChatbotProvider>
      </ResumeProvider>
    </ErrorBoundary>
  );
};

export default App;
