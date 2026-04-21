import { Suspense, type ReactNode } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import DeferredRender from '../components/DeferredRender';
import ErrorBoundary from '../components/ErrorBoundary';
import { AppRoutes } from './appRoutes';
import { AppToaster } from './lazyPages';

const PageLoader = (): JSX.Element => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
  </div>
);

interface AppShellProps {
  children?: ReactNode;
}

export function AppShell({ children }: AppShellProps): JSX.Element {
  return (
    <ErrorBoundary>
      <Router>
        {children}
        <Suspense fallback={<PageLoader />}>
          <AppRoutes />
        </Suspense>
        <DeferredRender delayMs={6000}>
          <Suspense fallback={null}>
            <AppToaster />
          </Suspense>
        </DeferredRender>
      </Router>
    </ErrorBoundary>
  );
}
