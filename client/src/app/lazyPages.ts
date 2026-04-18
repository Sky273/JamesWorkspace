import { lazy, type ComponentType } from 'react';
import { createLogger } from '../utils/logger.frontend';

const editorialCssLoaders = [() => import('../styles/editorialPages.css')];
const resumesEditorialCssLoaders = [() => import('../styles/resumesEditorial.css')];
const CHUNK_RELOAD_STORAGE_KEY = 'lazy-page-reload-once';
const lazyPagesLog = createLogger('lazyPages');

type LazyPageModule = { default: ComponentType<Record<string, never>> };

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function getChunkReloadStorage(): StorageLike | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function isRecoverableDynamicImportError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return [
    'Failed to fetch dynamically imported module',
    'Importing a module script failed',
    'error loading dynamically imported module',
    'ChunkLoadError',
  ].some((fragment) => message.includes(fragment));
}

export function canAttemptChunkRecovery(storage: StorageLike | null, currentPath: string): boolean {
  if (!storage) {
    return false;
  }

  return storage.getItem(CHUNK_RELOAD_STORAGE_KEY) !== currentPath;
}

function markChunkRecoveryAttempt(storage: StorageLike | null, currentPath: string): void {
  storage?.setItem(CHUNK_RELOAD_STORAGE_KEY, currentPath);
}

function clearChunkRecoveryAttempt(storage: StorageLike | null): void {
  storage?.removeItem(CHUNK_RELOAD_STORAGE_KEY);
}

export function reloadDocument(): void {
  window.location.reload();
}

export async function loadLazyPageModule<T extends LazyPageModule>(
  importer: () => Promise<T>,
  cssLoaders: Array<() => Promise<unknown>>,
  options: { reload?: () => void } = {},
): Promise<T> {
  const storage = getChunkReloadStorage();
  const currentPath = typeof window !== 'undefined'
    ? `${window.location.pathname}${window.location.search}${window.location.hash}`
    : '';
  const reload = options.reload || reloadDocument;

  try {
    const [module] = await Promise.all([importer(), ...cssLoaders.map((loadCss) => loadCss())]);
    clearChunkRecoveryAttempt(storage);
    return module;
  } catch (error) {
    if (
      typeof window !== 'undefined'
      && isRecoverableDynamicImportError(error)
      && canAttemptChunkRecovery(storage, currentPath)
    ) {
      lazyPagesLog.warn('Recoverable lazy chunk error detected, forcing a one-time reload', {
        path: currentPath,
        error: error instanceof Error ? error.message : String(error ?? ''),
      });
      markChunkRecoveryAttempt(storage, currentPath);
      reload();
      return new Promise<T>(() => {});
    }

    throw error;
  }
}

const lazyWithCss = <T extends LazyPageModule>(
  importer: () => Promise<T>,
  cssLoaders: Array<() => Promise<unknown>> = [],
) =>
  lazy(async () => {
    return loadLazyPageModule(importer, cssLoaders);
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
export const ResumeEntryPage = lazyWithCss(() => import('../pages/ResumeEntryPage'), editorialCssLoaders);
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
export const FirmCreditsPage = lazyWithCss(() => import('../pages/FirmCreditsPage'), editorialCssLoaders);
export const FirmCreditsDetailPage = lazyWithCss(() => import('../pages/FirmCreditsDetailPage'), editorialCssLoaders);
export const InsufficientCreditsPage = lazyWithCss(() => import('../pages/InsufficientCreditsPage'), editorialCssLoaders);
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
export const AdminWorkspacePage = lazyWithCss(() => import('../pages/AdminWorkspacePage'), resumesEditorialCssLoaders);
export const AppToaster = lazy(() => import('../components/AppToaster'));
