/**
 * App Component
 * TypeScript version with lazy loading for better performance
 */

import { Suspense } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { ResumeProvider } from './context/ResumeContext';
import { ChatbotProvider } from './context/ChatbotContext';
import ErrorBoundary from './components/ErrorBoundary';
import { AppRoutes } from './app/appRoutes';
import { AppToaster } from './app/lazyPages';

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
  </div>
);

const App = (): JSX.Element => {
  return (
    <ErrorBoundary>
      <ResumeProvider>
        <ChatbotProvider>
          <Router>
            <Suspense fallback={<PageLoader />}>
              <AppRoutes />
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
