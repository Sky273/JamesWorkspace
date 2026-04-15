import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { AdminRoute, ManagerRoute, ProtectedRoute, PublicHomeRoute } from './routeGuards';
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
} from './lazyPages';

export function AppRoutes(): JSX.Element {
  return (
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
        <Route path="resumes/:id" element={<ResumeEntryPage />} />
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
        <Route path="deals/:id" element={<DealViewPage />} />
        <Route path="adaptations" element={<AdaptationsPage />} />
        <Route path="adaptations/:id" element={<AdaptationViewPage />} />
        <Route path="profile-matching" element={<ProfileMatchingPage />} />
        <Route path="guide" element={<UserGuidePage />} />
        <Route path="profile" element={<UserProfilePage />} />
        <Route path="credits-required" element={<InsufficientCreditsPage />} />
        <Route path="admin" element={<ManagerRoute><AdminWorkspacePage /></ManagerRoute>} />
        <Route path="admin/templates/new" element={<ManagerRoute><NewTemplatePage /></ManagerRoute>} />
        <Route path="admin/templates/edit/:id" element={<ManagerRoute><NewTemplatePage /></ManagerRoute>} />
        <Route path="dashboard/security-logs" element={<AdminRoute><SecurityLogs /></AdminRoute>} />
        <Route path="dashboard/metrics" element={<AdminRoute><MetricsPage /></AdminRoute>} />
        <Route path="settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />
        <Route path="facts" element={<FactsPage />} />
        <Route path="metiers" element={<AdminRoute><MetiersPage /></AdminRoute>} />
        <Route path="dashboard/gdpr-audit" element={<AdminRoute><GdprAuditPage /></AdminRoute>} />
        <Route path="dashboard/backup" element={<AdminRoute><BackupPage /></AdminRoute>} />
      </Route>
    </Routes>
  );
}
