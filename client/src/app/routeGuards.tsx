import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PublicHomePage } from './lazyPages';
import { usePublicHomeEnabled } from './publicHomeSetting';

interface RouteProps {
  children: ReactNode;
}

export const ProtectedRoute = ({ children }: RouteProps): JSX.Element => {
  const { isAuthenticated } = useAuth();
  const publicHomeEnabled = usePublicHomeEnabled();
  const unauthenticatedRedirectPath = publicHomeEnabled ? '/welcome' : '/signin';

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

export const ManagerRoute = ({ children }: RouteProps): JSX.Element => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  if (user?.role !== 'admin' && user?.role !== 'localAdmin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export const PublicHomeRoute = (): JSX.Element => {
  const { isAuthenticated } = useAuth();
  const publicHomeEnabled = usePublicHomeEnabled();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (publicHomeEnabled) {
    return <PublicHomePage />;
  }

  return <Navigate to="/signin" replace />;
};
