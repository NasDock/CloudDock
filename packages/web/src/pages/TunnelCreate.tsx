import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { TunnelForm } from '@/components/tunnel/TunnelForm';
import { Card } from '@/components/ui/Card';
import { useCreateTunnel } from '@/hooks/useTunnel';
import type { CreateTunnelInput } from '@/utils/validators';
import { useQuery } from '@tanstack/react-query';
import { clientApi } from '@/api/client';

export const TunnelCreate = () => {
  const navigate = useNavigate();
  const createTunnel = useCreateTunnel();
  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => clientApi.list(),
  });

  const onSubmit = async (data: CreateTunnelInput) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await createTunnel.mutateAsync(data as any);
    if (result.data.success && result.data.data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      navigate(`/tunnels/${(result.data.data as any).tunnelId}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1">
          <PageContainer
            title="创建隧道"
            subtitle="配置一个新的内网穿透隧道"
            breadcrumbs={[
              { label: '首页', to: '/dashboard' },
              { label: '隧道管理', to: '/tunnels' },
              { label: '创建隧道' },
            ]}
          >
            <div className="max-w-2xl">
              <Card>
                <TunnelForm
                  onSubmit={onSubmit}
                  onCancel={() => navigate('/tunnels')}
                  isLoading={createTunnel.isPending}
                  clients={clients?.clients}
                />
              </Card>
            </div>
          </PageContainer>
        </main>
      </div>
    </div>
  );
};
