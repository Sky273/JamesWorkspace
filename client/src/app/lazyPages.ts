import { lazy, type ComponentType } from 'react';

const editorialCssLoaders = [() => import('../styles/editorialPages.css')];
const resumesEditorialCssLoaders = [
  () => import('../styles/editorialPages.css'),
  () => import('../styles/resumesEditorial.css'),
];

const lazyWithCss = <T extends { default: ComponentType<any> }>(
  importer: () => Promise<T>,
  cssLoaders: Array<() => Promise<unknown>> = [],
) =>
  lazy(async () => {
    const [module] = await Promise.all([importer(), ...cssLoaders.map((loadCss) => loadCss())]);
    return module;
  });

export const HomePage = lazy(() => import('../pages/HomePage'));
export const PublicHomePage = lazy(() => import('../pages/PublicHomePage'));
export const ResumesPage = lazyWithCss(() => import('../pages/ResumesPage'), resumesEditorialCssLoaders);
export const TemplatesPage = lazyWithCss(() => import('../pages/TemplatesPage'), editorialCssLoaders);
export const UploadPage = lazyWithCss(() => import('../pages/UploadPage'), editorialCssLoaders);
export const NewTemplatePage = lazyWithCss(() => import('../pages/NewTemplatePage'), editorialCssLoaders);
export const TagsManagement = lazyWithCss(() => import('../pages/TagsManagement'), editorialCssLoaders);
export const UsersManagement = lazyWithCss(() => import('../pages/UsersManagement'), editorialCssLoaders);
export const SecurityLogs = lazyWithCss(() => import('../pages/SecurityLogs'), editorialCssLoaders);
export const MetricsPage = lazyWithCss(() => import('../pages/MetricsPage'), editorialCssLoaders);
export const SettingsPage = lazyWithCss(() => import('../pages/SettingsPage'), editorialCssLoaders);
export const MissionsPage = lazyWithCss(() => import('../pages/MissionsPage'), editorialCssLoaders);
export const AdaptationsPage = lazyWithCss(() => import('../pages/AdaptationsPage'), editorialCssLoaders);
export const ProfileMatchingPage = lazyWithCss(() => import('../pages/ProfileMatchingPage'), editorialCssLoaders);
export const ResumeAnalysisPage = lazyWithCss(() => import('../pages/ResumeAnalysisPage'), editorialCssLoaders);
export const ResumeImprovePage = lazyWithCss(() => import('../pages/ResumeImprovePage'), editorialCssLoaders);
export const ResumeExportPage = lazyWithCss(() => import('../pages/ResumeExportPage'), editorialCssLoaders);
export const ResumeAdaptPage = lazyWithCss(() => import('../pages/ResumeAdaptPage'), editorialCssLoaders);
export const MissionViewPage = lazyWithCss(() => import('../pages/MissionViewPage'), editorialCssLoaders);
export const DealViewPage = lazyWithCss(() => import('../pages/DealViewPage'), editorialCssLoaders);
export const AdaptationViewPage = lazyWithCss(() => import('../pages/AdaptationViewPage'), editorialCssLoaders);
export const UserGuidePage = lazyWithCss(() => import('../pages/UserGuidePage'), editorialCssLoaders);
export const FactsPage = lazyWithCss(() => import('../pages/FactsPage'), editorialCssLoaders);
export const MetiersPage = lazyWithCss(() => import('../pages/MetiersPage'), editorialCssLoaders);
export const ClientsPage = lazyWithCss(() => import('../pages/ClientsPage'), editorialCssLoaders);
export const EmailTemplatesPage = lazyWithCss(() => import('../pages/admin/EmailTemplatesPage'), editorialCssLoaders);
export const SignIn = lazy(() => import('../components/SignIn'));
export const Register = lazy(() => import('../components/Register'));
export const ForgotPasswordPage = lazy(() => import('../pages/ForgotPasswordPage'));
export const ResetPasswordPage = lazy(() => import('../pages/ResetPasswordPage'));
export const ConsentResponsePage = lazy(() => import('../pages/ConsentResponsePage'));
export const UserProfilePage = lazyWithCss(() => import('../pages/UserProfilePage'), editorialCssLoaders);
export const PrivacyPolicyPage = lazy(() => import('../pages/PrivacyPolicyPage'));
export const TermsOfServicePage = lazy(() => import('../pages/TermsOfServicePage'));
export const GdprAuditPage = lazyWithCss(() => import('../pages/GdprAuditPage'), editorialCssLoaders);
export const SharedFilePage = lazy(() => import('../pages/SharedFilePage'));
export const BackupPage = lazyWithCss(() => import('../pages/BackupPage'), editorialCssLoaders);
export const BatchUploadPage = lazyWithCss(() => import('../pages/BatchUploadPage'), editorialCssLoaders);
export const BatchJobsPage = lazy(() => import('../pages/BatchJobsPage'));
export const AppToaster = lazy(() => import('../components/AppToaster'));
