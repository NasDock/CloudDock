/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Format timestamp to relative time (e.g., "5分钟前")
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const target = new Date(date);
  const diffMs = now.getTime() - target.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHour < 24) return `${diffHour}小时前`;
  if (diffDay < 7) return `${diffDay}天前`;
  return target.toLocaleDateString('zh-CN');
}

/**
 * Format date to localized string
 */
export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format number with thousands separator
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('zh-CN');
}

/**
 * Mask sensitive string
 */
export function maskString(str: string, visibleStart = 4, visibleEnd = 4): string {
  if (str.length <= visibleStart + visibleEnd) return str;
  const start = str.slice(0, visibleStart);
  const end = str.slice(-visibleEnd);
  const masked = '*'.repeat(Math.min(str.length - visibleStart - visibleEnd, 20));
  return `${start}${masked}${end}`;
}
