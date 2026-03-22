import { useEffect } from 'react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useTunnelStore } from '@/stores/tunnelStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { formatRelativeTime } from '@/utils/formatters';

export const TunnelStatus = () => {
  const { tunnels, wsConnected } = useTunnelStore();
  const { connect, disconnect, isConnected } = useWebSocket();

  const onlineCount = tunnels.filter((t) => t.status === 'online').length;
  const offlineCount = tunnels.filter((t) => t.status === 'offline').length;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <h3 className="font-medium text-gray-900 mb-4">连接状态</h3>

      {/* WebSocket Connection */}
      <div className="flex items-center justify-between py-2 border-b border-gray-100">
        <span className="text-sm text-gray-600">WebSocket 连接</span>
        <StatusBadge
          status={isConnected || wsConnected ? 'online' : 'offline'}
          label={isConnected || wsConnected ? '已连接' : '未连接'}
          size="sm"
        />
      </div>

      {/* Tunnel Summary */}
      <div className="flex items-center justify-between py-2 border-b border-gray-100">
        <span className="text-sm text-gray-600">在线隧道</span>
        <span className="text-sm font-medium text-green-600">{onlineCount} 个</span>
      </div>

      <div className="flex items-center justify-between py-2 border-b border-gray-100">
        <span className="text-sm text-gray-600">离线隧道</span>
        <span className="text-sm font-medium text-gray-500">{offlineCount} 个</span>
      </div>

      <div className="flex items-center justify-between py-2">
        <span className="text-sm text-gray-600">总计</span>
        <span className="text-sm font-medium text-gray-900">{tunnels.length} 个</span>
      </div>

      {/* Last heartbeat */}
      {tunnels.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            最后更新：{formatRelativeTime(new Date())}
          </p>
        </div>
      )}
    </div>
  );
};
