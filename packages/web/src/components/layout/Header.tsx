import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useTunnelStore } from '@/stores/tunnelStore';

export const Header = () => {
  const { user, logout, isLoggingOut } = useAuth();
  const { wsConnected } = useTunnelStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-gray-50/60 backdrop-blur">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            <img src="/favicon.png" alt="CloudDock" className="w-8 h-8 rounded-lg" />
            <span className="font-semibold text-gray-900">CloudDock</span>
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 border-l border-gray-200 pl-4">
              <StatusBadge status={wsConnected ? 'online' : 'offline'} label={wsConnected ? '已连接' : '未连接'} size="sm" />
            </div>
            {user && (
              <div className="flex items-center gap-3 border-l border-gray-200 pl-4">
                <div className="text-sm text-right">
                  <p className="font-medium text-gray-900">{user.username}</p>
                  <p className="text-gray-500 text-xs">{user.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
                >
                  {isLoggingOut ? '退出中...' : '退出'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
