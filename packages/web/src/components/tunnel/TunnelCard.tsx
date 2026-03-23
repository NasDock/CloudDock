import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { Tunnel } from '@cloud-dock/shared';
import { getPublicBaseUrl } from '@/utils/runtimeConfig';

interface TunnelCardProps {
  tunnel: Tunnel;
  onDelete?: (tunnelId: string) => void;
  onToggle?: (tunnelId: string, enabled: boolean) => void;
  deviceName?: string;
}

export const TunnelCard = ({ tunnel, onDelete, onToggle, deviceName }: TunnelCardProps) => {
  const protocolLabels = {
    http: 'HTTP',
    tcp: 'TCP',
    udp: 'UDP',
  };
  const baseUrl = getPublicBaseUrl((import.meta.env.VITE_PUBLIC_BASE_URL as string) || window.location.origin);
  const fullUrl = `${baseUrl.replace(/\/+$/, '')}${tunnel.publicPath.replace(/\/$/, '')}`;
  const [copied, setCopied] = useState(false);

  return (
    <Card hover padding="none" className="overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-gray-900">{tunnel.name}</h3>
              <StatusBadge
                status={(tunnel as any).enabled === false ? 'offline' : tunnel.status}
                label={(tunnel as any).enabled === false ? '已下线' : tunnel.status === 'online' ? '在线' : '离线'}
                size="sm"
              />
            </div>
            <p className="mt-1 text-sm text-gray-500">
              <span className="badge-primary mr-2">{protocolLabels[tunnel.protocol]}</span>
              {tunnel.localAddress}
            </p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 text-sm">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-gray-500">访问路径</p>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-700 transition-colors"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(fullUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
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
              {copied && <span className="text-xs text-green-600">已复制</span>}
            </div>
            <div className="mt-0.5">
              <p className="font-mono text-xs text-primary-600">{fullUrl}</p>
            </div>
          </div>
          {deviceName && (
            <div className="mt-3">
              <p className="text-gray-500">设备</p>
              <p className="text-gray-700 mt-0.5">{deviceName}</p>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
        <Link
          to={`/tunnels/${tunnel.tunnelId}`}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          查看详情
        </Link>
        {onToggle && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggle(tunnel.tunnelId, !(tunnel as any).enabled);
            }}
            className="text-sm text-gray-600 hover:text-gray-900 font-medium"
          >
            {(tunnel as any).enabled === false ? '上线' : '下线'}
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(tunnel.tunnelId);
            }}
            className="text-sm text-danger-500 hover:text-danger-700 font-medium"
          >
            删除
          </button>
        )}
      </div>
    </Card>
  );
};
