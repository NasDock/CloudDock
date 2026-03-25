import { useState } from 'react';
import type { TunnelStatusFilter } from '@/hooks/useTunnel';
import { Link } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useTunnels, useDeleteTunnel, useSetTunnelEnabled } from '@/hooks/useTunnel';
import { useQuery } from '@tanstack/react-query';
import { clientApi } from '@/api/client';

export const TunnelList = () => {
  const [statusFilter, setStatusFilter] = useState<TunnelStatusFilter>('all');
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; tunnelId?: string; name?: string }>({
    isOpen: false,
  });

  const { data, isLoading, refetch } = useTunnels({
    status: statusFilter,
    limit: 50,
  });
  const { data: clientsData } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => clientApi.list(),
  });
  const clientNameById = new Map(
    clientsData?.clients?.map((c) => [c.clientId, c.name]) ?? []
  );

  const deleteTunnel = useDeleteTunnel();
  const toggleTunnel = useSetTunnelEnabled();

  const handleDelete = (tunnelId: string) => {
    const tunnel = data?.tunnels.find((t) => t.tunnelId === tunnelId);
    if (tunnel) {
      setDeleteModal({ isOpen: true, tunnelId, name: tunnel.name });
    }
  };

  const confirmDelete = async () => {
    if (deleteModal.tunnelId) {
      await deleteTunnel.mutateAsync(deleteModal.tunnelId);
      setDeleteModal({ isOpen: false });
    }
  };

  const handleToggle = async (tunnelId: string, enabled: boolean) => {
    await toggleTunnel.mutateAsync({ tunnelId, enabled });
    refetch();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1">
          <PageContainer
            title="隧道管理"
            subtitle="查看和管理您的所有隧道"
            actions={
              <Link to="/tunnels/create">
                <Button>
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  创建隧道
                </Button>
              </Link>
            }
          >
            <div className="mb-6 flex items-center gap-2">
              {(['all', 'online', 'offline'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    statusFilter === status
                      ? 'bg-primary-100 text-primary-700'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {status === 'all' ? '全部' : status === 'online' ? '在线' : '离线'}
                </button>
              ))}
            </div>

            {isLoading ? (
              <div className="text-center py-12 text-gray-500">加载中...</div>
            ) : data?.tunnels.length === 0 ? (
              <Card>
                <div className="text-center py-12">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">暂无隧道</h3>
                  <p className="text-gray-500 mb-4">创建一个隧道来开始使用内网穿透服务</p>
                  <Link to="/tunnels/create">
                    <Button>创建第一个隧道</Button>
                  </Link>
                </div>
              </Card>
            ) : (
              <Card>
                <div className="divide-y">
                  {data?.tunnels.map((tunnel) => (
                    <div key={tunnel.tunnelId} className="py-4 flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{tunnel.name}</span>
                          <StatusBadge
                            status={tunnel.status}
                            label={tunnel.status === 'online' ? '在线' : '离线'}
                            size="sm"
                          />
                        </div>
                        <div className="text-sm text-gray-500">
                          {tunnel.localAddress} • {tunnel.protocol.toUpperCase()}
                        </div>
                        {tunnel.clientId && (
                          <div className="text-xs text-gray-400">
                            设备：{clientNameById.get(tunnel.clientId) || tunnel.clientId}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Link to={`/tunnels/${tunnel.tunnelId}`} className="text-sm text-primary-600 hover:text-primary-700">
                          查看
                        </Link>
                        <Button variant="secondary" onClick={() => handleToggle(tunnel.tunnelId, (tunnel as any).enabled === false)}>
                          {(tunnel as any).enabled === false ? '上线' : '下线'}
                        </Button>
                        <Button variant="secondary" onClick={() => handleDelete(tunnel.tunnelId)}>
                          删除
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </PageContainer>
        </main>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false })}
        title="删除隧道"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            确定要删除隧道 <strong>{deleteModal.name}</strong> 吗？此操作不可恢复。
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteModal({ isOpen: false })}>
              取消
            </Button>
            <Button
              variant="danger"
              isLoading={deleteTunnel.isPending}
              onClick={confirmDelete}
            >
              删除
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
