/**
 * App Component
 * TypeScript version with lazy loading for better performance
 */

import { useEffect, ReactNode, lazy, Suspense } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ResumeProvider } from './context/ResumeContext';
import { ChatbotProvider } from './context/ChatbotContext';
import { Toaster } from 'react-hot-toast';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import { useAuth } from './context/AuthContext';
import logger from './utils/logger.frontend';

// Lazy load pages for code splitting
const HomePage = lazy(() => import('./pages/HomePage'));
const ResumesPage = lazy(() => import('./pages/ResumesPage'));
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'));
const UploadPage = lazy(() => import('./pages/UploadPage'));
const NewTemplatePage = lazy(() => import('./pages/NewTemplatePage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const TagsManagement = lazy(() => import('./pages/TagsManagement'));
const UsersManagement = lazy(() => import('./pages/UsersManagement'));
const SecurityLogs = lazy(() => import('./pages/SecurityLogs'));
const MetricsPage = lazy(() => import('./pages/MetricsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const MissionsPage = lazy(() => import('./pages/MissionsPage'));
const AdaptationsPage = lazy(() => import('./pages/AdaptationsPage'));
const ProfileMatchingPage = lazy(() => import('./pages/ProfileMatchingPage'));
const ResumeViewPage = lazy(() => import('./pages/ResumeViewPage'));
const MissionViewPage = lazy(() => import('./pages/MissionViewPage'));
const AdaptationViewPage = lazy(() => import('./pages/AdaptationViewPage'));
const UserGuidePage = lazy(() => import('./pages/UserGuidePage'));
const FactsPage = lazy(() => import('./pages/FactsPage'));
const MetiersPage = lazy(() => import('./pages/MetiersPage'));
const ClientsPage = lazy(() => import('./pages/ClientsPage'));
const EmailTemplatesPage = lazy(() => import('./pages/admin/EmailTemplatesPage'));
const SignIn = lazy(() => import('./components/SignIn'));
const Register = lazy(() => import('./components/Register'));

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
  </div>
);

interface RouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: RouteProps): JSX.Element => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!isAuthenticated) {
      logger.log('[ProtectedRoute] User not authenticated, redirecting to signin');
      navigate('/signin', { replace: true });
    }
  }, [isAuthenticated, navigate]);
  
  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  return <>{children}</>;
};

const AdminRoute = ({ children }: RouteProps): JSX.Element => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!isAuthenticated) {
      logger.log('[AdminRoute] User not authenticated, redirecting to signin');
      navigate('/signin', { replace: true });
    }
  }, [isAuthenticated, navigate]);
  
  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  const userRole = (user?.role || user?.Role || '').toLowerCase();
  if (userRole !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const App = (): JSX.Element => {
  return (
    <ErrorBoundary>
      <ResumeProvider>
        <ChatbotProvider>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/signin" element={<SignIn />} />
                <Route path="/register" element={<Register />} />
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
                  <Route path="resumes/:id" element={<ResumeViewPage />} />
                  <Route path="upload" element={<UploadPage />} />
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="missions" element={<MissionsPage />} />
                  <Route path="missions/:id" element={<MissionViewPage />} />
                  <Route path="clients" element={<ClientsPage />} />
                  <Route path="adaptations" element={<AdaptationsPage />} />
                  <Route path="adaptations/:id" element={<AdaptationViewPage />} />
                  <Route path="profile-matching" element={<ProfileMatchingPage />} />
                  <Route path="guide" element={<UserGuidePage />} />
                  
                  {/* Admin-only routes */}
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
                  <Route path="email-templates" element={<AdminRoute><EmailTemplatesPage /></AdminRoute>} />
                </Route>
              </Routes>
            </Suspense>
            <Toaster position="top-right" />
          </Router>
        </ChatbotProvider>
      </ResumeProvider>
    </ErrorBoundary>
  );
};

export default App;
