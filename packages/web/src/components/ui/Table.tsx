import { type HTMLAttributes, forwardRef } from 'react';

interface TableProps extends HTMLAttributes<HTMLTableElement> {
  columns: Array<{
    key: string;
    header: string;
    render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
    className?: string;
  }>;
  data: Record<string, unknown>[];
  emptyMessage?: string;
}

export const Table = forwardRef<HTMLTableElement, TableProps>(
  ({ columns, data, emptyMessage = '暂无数据', className = '', ...props }, ref) => {
    return (
      <div className="overflow-x-auto">
        <table ref={ref} className={`w-full ${className}`} {...props}>
          <thead>
            <tr className="border-b border-gray-200">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${col.className || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-gray-50">
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 text-sm text-gray-900 ${col.className || ''}`}>
                      {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  },
);

Table.displayName = 'Table';
