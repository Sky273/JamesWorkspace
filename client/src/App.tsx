/**
 * App Component
 * TypeScript version with lazy loading for better performance
 */

import { Suspense } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ResumeProvider } from './context/ResumeContext';
import { ChatbotProvider } from './context/ChatbotContext';
import ErrorBoundary from './components/ErrorBoundary';
import DeferredRender from './components/DeferredRender';
import { AppRoutes } from './app/appRoutes';
import { AppToaster } from './app/lazyPages';

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
  </div>
);

const isPublicShareRoute = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.location.pathname.startsWith('/share/');
};

const App = (): JSX.Element => {
  if (isPublicShareRoute()) {
    return (
      <ErrorBoundary>
        <Router>
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

  return (
    <ErrorBoundary>
      <AuthProvider>
        <ResumeProvider>
          <ChatbotProvider>
            <Router>
              <Suspense fallback={<PageLoader />}>
                <AppRoutes />
              </Suspense>
              <DeferredRender delayMs={6000}>
                <Suspense fallback={null}>
                  <AppToaster />
                </Suspense>
              </DeferredRender>
            </Router>
          </ChatbotProvider>
        </ResumeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
