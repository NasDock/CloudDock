import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Table } from '@/components/ui/Table';
import { useTunnel, useDeleteTunnel, useTunnelLogs, useSetTunnelEnabled } from '@/hooks/useTunnel';
import type { AccessLog } from '@/api/tunnel';
import { formatDate, formatDuration, formatBytes } from '@/utils/formatters';

export const TunnelDetail = () => {
  const { tunnelId } = useParams<{ tunnelId: string }>();
  const navigate = useNavigate();

  const { data: tunnel, isLoading } = useTunnel(tunnelId!);
  const [logPage, setLogPage] = useState(1);
  const logLimit = 20;
  const { data: logsData } = useTunnelLogs(tunnelId!, { limit: logLimit, page: logPage });
  const deleteTunnel = useDeleteTunnel();
  const toggleTunnel = useSetTunnelEnabled();
  const baseUrl = (import.meta.env.VITE_PUBLIC_BASE_URL as string) || window.location.origin;
  const fullUrl = tunnel ? `${baseUrl.replace(/\/+$/, '')}${tunnel.publicPath.replace(/\/$/, '')}` : '';

  const [deleteModal, setDeleteModal] = useState(false);

  if (isLoading) {
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

  if (!tunnel) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1">
            <PageContainer title="隧道不存在">
              <Card className="text-center py-8">
                <p className="text-gray-500 mb-4">未找到指定的隧道</p>
                <Link to="/tunnels">
                  <Button>返回隧道列表</Button>
                </Link>
              </Card>
            </PageContainer>
          </main>
        </div>
      </div>
    );
  }

  const handleDelete = async () => {
    await deleteTunnel.mutateAsync(tunnelId!);
    navigate('/tunnels');
  };

  const protocolLabels = { http: 'HTTP', tcp: 'TCP', udp: 'UDP' };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1">
          <PageContainer
            title={tunnel.name}
            subtitle={`${protocolLabels[tunnel.protocol]} 隧道`}
            breadcrumbs={[
              { label: '首页', to: '/dashboard' },
              { label: '隧道管理', to: '/tunnels' },
              { label: tunnel.name },
            ]}
            actions={
              <div className="flex items-center gap-3">
                <StatusBadge
                  status={(tunnel as any).enabled === false ? 'offline' : tunnel.status}
                  label={(tunnel as any).enabled === false ? '已下线' : tunnel.status === 'online' ? '在线' : '离线'}
                />
                <Button
                  variant="secondary"
                  onClick={() => toggleTunnel.mutate({ tunnelId: tunnel.tunnelId, enabled: (tunnel as any).enabled === false })}
                >
                  {(tunnel as any).enabled === false ? '上线' : '下线'}
                </Button>
                <Button
                  variant="danger"
                  onClick={() => setDeleteModal(true)}
                  isLoading={deleteTunnel.isPending}
                >
                  删除
                </Button>
                <Button variant="secondary" onClick={() => navigate('/tunnels')}>
                  返回
                </Button>
              </div>
            }
          >
            <div className="grid grid-cols-1 gap-6">
              {/* Main Content */}
              <div className="space-y-6">
                {/* Basic Info */}
                <Card>
                  <h3 className="font-medium text-gray-900 mb-4">基本信息</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600">协议类型</span>
                      <span className="font-medium">{protocolLabels[tunnel.protocol]}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600">本地地址</span>
                      <span className="font-mono text-sm">{tunnel.localAddress}</span>
                    </div>
                    {tunnel.localHostname && (
                      <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-gray-600">本地 Host</span>
                        <span className="font-medium">{tunnel.localHostname}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">访问路径</span>
                        <button
                          type="button"
                          className="text-gray-400 hover:text-gray-700 transition-colors"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(fullUrl);
                            } catch {
                              // ignore
                            }
                          }}
                          aria-label="复制访问路径"
                          title="复制"
                        >
                          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v11a2 2 0 002 2h9a2 2 0 002-2v-2" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 3H10a2 2 0 00-2 2v11a2 2 0 002 2h6a2 2 0 002-2V5a2 2 0 00-2-2z" />
                          </svg>
                        </button>
                      </div>
                      <span className="font-mono text-sm text-primary-600">{fullUrl}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-gray-600">创建时间</span>
                      <span className="text-sm">{formatDate(tunnel.createdAt)}</span>
                    </div>
                  </div>
                </Card>

                {/* Statistics */}
                {tunnel.statistics && (
                  <Card>
                    <h3 className="font-medium text-gray-900 mb-4">流量统计</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary-600">
                          {tunnel.statistics.totalRequests.toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-600">总请求数</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {formatBytes(tunnel.statistics.bytesIn)}
                        </div>
                        <div className="text-sm text-gray-600">入站流量</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {formatBytes(tunnel.statistics.bytesOut)}
                        </div>
                        <div className="text-sm text-gray-600">出站流量</div>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Access Logs */}
                <Card padding="none">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <h3 className="font-medium text-gray-900">访问日志</h3>
                  </div>
                  {logsData?.logs && logsData.logs.length > 0 ? (
                    <Table
                      columns={[
                        { key: 'timestamp', header: '时间', render: (v) => formatDate(v as string) },
                        { key: 'clientIp', header: '客户端 IP' },
                        { key: 'method', header: '方法', render: (v) => <span className="font-mono text-xs">{v as string}</span> },
                        { key: 'path', header: '路径', className: 'max-w-xs truncate' },
                        {
                          key: 'statusCode',
                          header: '状态',
                          render: (v) => {
                            const code = v as number;
                            const color = code >= 200 && code < 300 ? 'text-green-600' : code >= 400 ? 'text-red-600' : 'text-gray-600';
                            return <span className={`font-medium ${color}`}>{code}</span>;
                          },
                        },
                        { key: 'responseTime', header: '响应时间', render: (v) => formatDuration(v as number) },
                      ]}
                      data={logsData.logs.map((log: AccessLog) => ({
                        ...log,
                        timestamp: log.timestamp,
                      }))}
                    />
                  ) : (
                    <div className="p-8 text-center text-gray-500">暂无访问日志</div>
                  )}
                  {logsData?.pagination && logsData.pagination.total > logLimit && (
                    <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm">
                      <span className="text-gray-500">
                        第 {logsData.pagination.page} / {Math.ceil(logsData.pagination.total / logsData.pagination.limit)} 页
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                          disabled={logsData.pagination.page <= 1}
                        >
                          上一页
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            setLogPage((p) =>
                              p >= Math.ceil(logsData.pagination.total / logsData.pagination.limit) ? p : p + 1
                            )
                          }
                          disabled={
                            logsData.pagination.page >=
                            Math.ceil(logsData.pagination.total / logsData.pagination.limit)
                          }
                        >
                          下一页
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-6" />
            </div>
          </PageContainer>
        </main>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModal}
        onClose={() => setDeleteModal(false)}
        title="删除隧道"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            确定要删除隧道 <strong>{tunnel.name}</strong> 吗？此操作不可恢复。
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteModal(false)}>
              取消
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              删除
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};
