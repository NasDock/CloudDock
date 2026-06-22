import { useNavigate, useParams } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { TunnelForm } from '@/components/tunnel/TunnelForm';
import { Card } from '@/components/ui/Card';
import { useTunnel, useUpdateTunnel } from '@/hooks/useTunnel';
import type { CreateTunnelInput } from '@/utils/validators';
import { useQuery } from '@tanstack/react-query';
import { clientApi } from '@/api/client';

export const TunnelEdit = () => {
  const { tunnelId } = useParams<{ tunnelId: string }>();
  const navigate = useNavigate();
  const { data: tunnel, isLoading: tunnelLoading } = useTunnel(tunnelId!);
  const updateTunnel = useUpdateTunnel();
  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => clientApi.list(),
  });

  const onSubmit = async (data: CreateTunnelInput) => {
    const result = await updateTunnel.mutateAsync({
      tunnelId: tunnelId!,
      data: {
        name: data.name,
        localAddress: data.localAddress,
        localHostname: data.localHostname || undefined,
        ipWhitelist: data.ipWhitelist || undefined,
      },
    });
    if (result.data.success) {
      navigate(`/tunnels/${tunnelId}`);
    }
  };

  if (tunnelLoading || !tunnel) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1">
            <PageContainer title="加载中...">加载中...</PageContainer>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1">
          <PageContainer title="编辑隧道" subtitle={`修改 ${tunnel.name} 的配置`}>
            <div className="max-w-2xl">
              <Card>
                <h3 className="text-lg font-semibold mb-4">隧道配置</h3>
                <TunnelForm
                  onSubmit={onSubmit}
                  onCancel={() => navigate(`/tunnels/${tunnelId}`)}
                  isLoading={updateTunnel.isPending}
                  defaultValues={{
                    name: tunnel.name,
                    protocol: tunnel.protocol,
                    localAddress: tunnel.localAddress,
                    localHostname: tunnel.localHostname,
                    clientId: tunnel.clientId,
                    ipWhitelist: (tunnel as any).ipWhitelist?.join(', ') || '',
                  }}
                  clients={clients?.clients ?? []}
                  submitLabel="保存修改"
                  readOnlyFields={['protocol', 'clientId']}
                />
              </Card>
            </div>
          </PageContainer>
        </main>
      </div>
    </div>
  );
};
