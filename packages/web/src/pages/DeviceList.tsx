import { useState } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientApi } from '@/api/client';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';

export const DeviceList = () => {
  const queryClient = useQueryClient();
  const [renameModal, setRenameModal] = useState<{ isOpen: boolean; clientId?: string; name?: string }>({
    isOpen: false,
  });
  const [renameValue, setRenameValue] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => clientApi.list(),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ clientId, enabled }: { clientId: string; enabled: boolean }) =>
      clientApi.setEnabled(clientId, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ clientId, name }: { clientId: string; name: string }) =>
      clientApi.rename(clientId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setRenameModal({ isOpen: false });
    },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1">
          <PageContainer title="设备管理" subtitle="当前账号下的 NAS 客户端设备">
            {isLoading ? (
              <div className="text-center py-12 text-gray-500">加载中...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {data?.clients?.map((client) => (
                  <Card key={client.clientId} padding="none" hover>
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900">{client.name}</h3>
                          <p className="text-sm text-gray-500 mt-0.5">{client.clientId}</p>
                        </div>
                        <StatusBadge
                          status={client.enabled === false ? 'offline' : client.status}
                          label={client.enabled === false ? '已下线' : client.status === 'online' ? '在线' : '离线'}
                        />
                      </div>

                      <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">是否启用</span>
                          <span className="font-medium">{client.enabled === false ? '否' : '是'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">最后在线</span>
                          <span className="text-gray-700">{client.lastSeen || '-'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-end">
                      <Button
                        variant="secondary"
                        className="mr-2"
                        onClick={() => {
                          setRenameValue(client.name);
                          setRenameModal({ isOpen: true, clientId: client.clientId, name: client.name });
                        }}
                      >
                        修改名称
                      </Button>
                      <Button
                        variant="secondary"
                        isLoading={toggleMutation.isPending}
                        onClick={() =>
                          toggleMutation.mutate({ clientId: client.clientId, enabled: client.enabled === false })
                        }
                      >
                        {client.enabled === false ? '上线' : '下线'}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </PageContainer>
        </main>
      </div>

      <Modal
        isOpen={renameModal.isOpen}
        onClose={() => setRenameModal({ isOpen: false })}
        title="修改设备名称"
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="设备名称"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setRenameModal({ isOpen: false })}>
              取消
            </Button>
            <Button
              isLoading={renameMutation.isPending}
              onClick={() =>
                renameModal.clientId && renameMutation.mutate({ clientId: renameModal.clientId, name: renameValue.trim() })
              }
            >
              保存
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
