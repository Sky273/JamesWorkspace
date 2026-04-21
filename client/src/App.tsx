import { AppShell } from './app/AppShell';
import { AuthProvider } from './context/AuthContext';
import { ResumeProvider } from './context/ResumeContext';
import { ChatbotProvider } from './context/ChatbotContext';

const isPublicShareRoute = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.location.pathname.startsWith('/share/');
};

const App = (): JSX.Element => {
  if (isPublicShareRoute()) {
    return <AppShell />;
  }

  return (
    <AuthProvider>
      <ResumeProvider>
        <ChatbotProvider>
          <AppShell />
        </ChatbotProvider>
      </ResumeProvider>
    </AuthProvider>
  );
};

export default App;
