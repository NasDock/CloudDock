import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAuth } from '@/hooks/useAuth';
import { useTunnels } from '@/hooks/useTunnel';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Link } from 'react-router-dom';

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
            <div className="grid gap-4 md:grid-cols-3 mb-8">
              <Card>
                <div className="flex items-center justify-between pb-2">
                  <span className="text-sm text-gray-500">总隧道数</span>
                </div>
                <div className="text-4xl font-bold text-primary-600 text-center py-4">
                  {tunnelData?.pagination.total || 0}
                </div>
              </Card>
              <Card>
                <div className="flex items-center justify-between pb-2">
                  <span className="text-sm text-gray-500">在线隧道</span>
                </div>
                <div className="text-4xl font-bold text-green-600 text-center py-4">
                  {onlineCount}
                </div>
              </Card>
              <Card>
                <div className="flex items-center justify-between pb-2">
                  <span className="text-sm text-gray-500">离线隧道</span>
                </div>
                <div className="text-4xl font-bold text-gray-500 text-center py-4">
                  {(tunnelData?.pagination.total || 0) - onlineCount}
                </div>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
              <Card className="lg:col-span-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">最近隧道</h3>
                  <Link to="/tunnels" className="text-sm text-primary-600 hover:text-primary-700">
                    查看全部
                  </Link>
                </div>
                <div className="space-y-4">
                  {isLoading ? (
                    <div className="text-center text-gray-500 py-10">加载中...</div>
                  ) : recentTunnels.length === 0 ? (
                    <div className="text-center text-gray-500 py-10">暂无隧道</div>
                  ) : (
                    recentTunnels.map((tunnel) => (
                      <div key={tunnel.tunnelId} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{tunnel.name}</p>
                            <StatusBadge status={tunnel.status} label={tunnel.status === 'online' ? '在线' : '离线'} size="sm" />
                          </div>
                          <p className="text-sm text-gray-500">
                            {tunnel.localAddress} • {tunnel.protocol.toUpperCase()}
                          </p>
                        </div>
                        <Link to={`/tunnels/${tunnel.tunnelId}`} className="text-sm text-primary-600 hover:text-primary-700">
                          查看
                        </Link>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <div className="lg:col-span-2 space-y-4">
                <Card>
                  <h3 className="text-lg font-semibold mb-4">连接状态</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">WebSocket 连接</span>
                      <StatusBadge status={wsConnected ? 'online' : 'offline'} label={wsConnected ? '已连接' : '未连接'} size="sm" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">在线隧道</span>
                      <span className="font-medium text-green-600">{onlineCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">离线隧道</span>
                      <span className="font-medium text-gray-500">{(tunnelData?.pagination.total || 0) - onlineCount}</span>
                    </div>
                  </div>
                </Card>

                <Card>
                  <h3 className="text-lg font-semibold mb-4">快速操作</h3>
                  <div className="space-y-2">
                    <Link to="/tunnels/create" className="block px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">
                      创建新隧道
                    </Link>
                    <Link to="/devices" className="block px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">
                      防火墙
                    </Link>
                    <Link to="/profile" className="block px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">
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
