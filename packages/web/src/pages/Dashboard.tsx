import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TunnelStatus } from '@/components/tunnel/TunnelStatus';
import { useAuth } from '@/hooks/useAuth';
import { useTunnels } from '@/hooks/useTunnel';
import { useWebSocket } from '@/hooks/useWebSocket';

export const Dashboard = () => {
  const { user } = useAuth();
  const { connect } = useWebSocket();
  const { data: tunnelData, isLoading } = useTunnels({ limit: 5 });

  useEffect(() => {
    connect();
  }, [connect]);

  const recentTunnels = tunnelData?.tunnels?.slice(0, 5) || [];
  const onlineCount = tunnelData?.tunnels?.filter((t) => t.status === 'online').length || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1">
          <PageContainer
            title={`欢迎回来, ${user?.username || '用户'}`}
            subtitle="这里是您的控制台概览"
          >
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card className="text-center">
                <div className="text-3xl font-bold text-primary-600">
                  {tunnelData?.pagination.total || 0}
                </div>
                <div className="text-sm text-gray-600 mt-1">总隧道数</div>
              </Card>

              <Card className="text-center">
                <div className="text-3xl font-bold text-green-600">{onlineCount}</div>
                <div className="text-sm text-gray-600 mt-1">在线隧道</div>
              </Card>

              <Card className="text-center">
                <div className="text-3xl font-bold text-gray-600">
                  {(tunnelData?.pagination.total || 0) - onlineCount}
                </div>
                <div className="text-sm text-gray-600 mt-1">离线隧道</div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Recent Tunnels */}
              <div className="lg:col-span-2">
                <Card padding="none">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-medium text-gray-900">最近隧道</h3>
                    <Link to="/tunnels" className="text-sm text-primary-600 hover:text-primary-700">
                      查看全部
                    </Link>
                  </div>

                  {isLoading ? (
                    <div className="p-8 text-center text-gray-500">加载中...</div>
                  ) : recentTunnels.length === 0 ? (
                    <div className="p-8 text-center">
                      <p className="text-gray-500 mb-4">还没有创建隧道</p>
                      <Link
                        to="/tunnels/create"
                        className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                      >
                        创建第一个隧道
                      </Link>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {recentTunnels.map((tunnel) => (
                        <div key={tunnel.tunnelId} className="px-4 py-3 flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{tunnel.name}</span>
                              <StatusBadge
                                status={tunnel.status}
                                label={tunnel.status === 'online' ? '在线' : '离线'}
                                size="sm"
                              />
                            </div>
                            <p className="text-sm text-gray-500 mt-0.5">
                              {tunnel.localAddress} • {tunnel.protocol.toUpperCase()}
                            </p>
                          </div>
                          <div className="text-right">
                            <Link
                              to={`/tunnels/${tunnel.tunnelId}`}
                              className="text-sm text-primary-600 hover:text-primary-700"
                            >
                              查看
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              {/* Connection Status */}
              <div>
                <TunnelStatus />

                {/* Quick Actions */}
                <Card className="mt-6">
                  <h3 className="font-medium text-gray-900 mb-4">快速操作</h3>
                  <div className="space-y-2">
                    <Link
                      to="/tunnels/create"
                      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 text-gray-700"
                    >
                      <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      创建新隧道
                    </Link>
                    <Link
                      to="/devices"
                      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 text-gray-700"
                    >
                      <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      防火墙
                    </Link>
                    <Link
                      to="/profile"
                      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 text-gray-700"
                    >
                      <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      账户设置
                    </Link>
                  </div>
                </Card>
              </div>
            </div>
          </PageContainer>
        </main>
      </div>
    </div>
  );
};
