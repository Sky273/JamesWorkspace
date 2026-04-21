import { Routes, Route } from 'react-router-dom';
import Layout from '../components/Layout';
import { ProtectedRoute, PublicHomeRoute } from './routeGuards';
import {
  renderAdminRoutes,
  renderManagerRoutes,
  renderPublicRoutes,
  renderWorkspaceRoutes,
} from './appRouteGroups';

export function AppRoutes(): JSX.Element {
  return (
    <Routes>
      {renderPublicRoutes()}
      <Route path="/welcome" element={<PublicHomeRoute />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        {renderWorkspaceRoutes()}
        {renderAdminRoutes()}
        {renderManagerRoutes()}
      </Route>
    </Routes>
  );
}
