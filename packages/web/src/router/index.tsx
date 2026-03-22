import { createBrowserRouter, RouterProvider, Navigate, type RouteObject } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Login } from '@/pages/Login';
import { Register } from '@/pages/Register';
import { Dashboard } from '@/pages/Dashboard';
import { TunnelList } from '@/pages/TunnelList';
import { TunnelCreate } from '@/pages/TunnelCreate';
import { TunnelDetail } from '@/pages/TunnelDetail';
import { DeviceList } from '@/pages/DeviceList';
import { Profile } from '@/pages/Profile';
import { NotFound } from '@/pages/NotFound';

// Auth guard component
const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Auth redirect component (for login/register pages when already authenticated)
const AuthRedirect = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const routes: RouteObject[] = [
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: '/login',
    element: (
      <AuthRedirect>
        <Login />
      </AuthRedirect>
    ),
  },
  {
    path: '/register',
    element: (
      <AuthRedirect>
        <Register />
      </AuthRedirect>
    ),
  },
  {
    path: '/dashboard',
    element: (
      <RequireAuth>
        <Dashboard />
      </RequireAuth>
    ),
  },
  {
    path: '/tunnels',
    element: (
      <RequireAuth>
        <TunnelList />
      </RequireAuth>
    ),
  },
  {
    path: '/tunnels/create',
    element: (
      <RequireAuth>
        <TunnelCreate />
      </RequireAuth>
    ),
  },
  {
    path: '/tunnels/:tunnelId',
    element: (
      <RequireAuth>
        <TunnelDetail />
      </RequireAuth>
    ),
  },
  {
    path: '/devices',
    element: (
      <RequireAuth>
        <DeviceList />
      </RequireAuth>
    ),
  },
  {
    path: '/profile',
    element: (
      <RequireAuth>
        <Profile />
      </RequireAuth>
    ),
  },
  {
    path: '*',
    element: <NotFound />,
  },
];

export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter(routes);

export const AppRouter = () => {
  return <RouterProvider router={router} />;
};
