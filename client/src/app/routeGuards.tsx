import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PublicHomePage } from './lazyPages';

interface RouteProps {
  children: ReactNode;
}

const publicHomeEnabled = import.meta.env.VITE_PUBLIC_HOME === 'true';
const unauthenticatedRedirectPath = publicHomeEnabled ? '/welcome' : '/signin';

export const ProtectedRoute = ({ children }: RouteProps): JSX.Element => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to={unauthenticatedRedirectPath} replace />;
  }

  return <>{children}</>;
};

export const AdminRoute = ({ children }: RouteProps): JSX.Element => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export const PublicHomeRoute = (): JSX.Element => {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (publicHomeEnabled) {
    return <PublicHomePage />;
  }

  return <Navigate to="/signin" replace />;
};
