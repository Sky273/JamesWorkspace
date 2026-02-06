/**
 * App Component
 * TypeScript version
 */

import { useEffect, ReactNode } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ResumeProvider } from './context/ResumeContext';
import { ChatbotProvider } from './context/ChatbotContext';
import { Toaster } from 'react-hot-toast';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import ResumesPage from './pages/ResumesPage';
import TemplatesPage from './pages/TemplatesPage';
import UploadPage from './pages/UploadPage';
import NewTemplatePage from './pages/NewTemplatePage';
import DashboardPage from './pages/DashboardPage';
import TagsManagement from './pages/TagsManagement';
import UsersManagement from './pages/UsersManagement';
import SecurityLogs from './pages/SecurityLogs';
import MetricsPage from './pages/MetricsPage';
import SettingsPage from './pages/SettingsPage';
import MissionsPage from './pages/MissionsPage';
import AdaptationsPage from './pages/AdaptationsPage';
import ProfileMatchingPage from './pages/ProfileMatchingPage';
import ResumeViewPage from './pages/ResumeViewPage';
import MissionViewPage from './pages/MissionViewPage';
import AdaptationViewPage from './pages/AdaptationViewPage';
import UserGuidePage from './pages/UserGuidePage';
import FactsPage from './pages/FactsPage';
import MetiersPage from './pages/MetiersPage';
import SignIn from './components/SignIn';
import Register from './components/Register';
import { useAuth } from './context/AuthContext';
import logger from './utils/logger.frontend';

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
          </Route>
          </Routes>
          <Toaster position="top-right" />
        </Router>
      </ChatbotProvider>
      </ResumeProvider>
    </ErrorBoundary>
  );
};

export default App;
