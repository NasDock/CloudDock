import { useState, useEffect, useCallback } from 'react';
import { clientApi, Client, PendingPairing } from '@/api/client';

export function ClientList() {
  const [clients, setClients] = useState<Client[]>([]);
  const [pending, setPending] = useState<PendingPairing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pairingInput, setPairingInput] = useState('');
  const [pairingName, setPairingName] = useState('');
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [lastKey, setLastKey] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
    try {
      const data = await clientApi.list();
      setClients(data.clients);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  const fetchPending = useCallback(async () => {
    try {
      const data = await clientApi.listPending();
      setPending(data.pending);
    } catch {
      // Silently ignore
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchClients(), fetchPending()]);
    setLoading(false);
  }, [fetchClients, fetchPending]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchPending, 5000);
    return () => clearInterval(interval);
  }, [fetchAll, fetchPending]);

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairingInput.trim()) return;

    setPairingLoading(true);
    setPairingError(null);
    try {
      const result = await clientApi.approve(pairingInput.trim(), pairingName.trim() || undefined);
      setLastKey(result.clientKey);
      setPairingInput('');
      setPairingName('');
      await fetchClients();
      await fetchPending();
    } catch (err: any) {
      setPairingError(err.message);
    } finally {
      setPairingLoading(false);
    }
  };

  const handleRename = async (clientId: string, currentName: string) => {
    const newName = prompt('New name:', currentName);
    if (!newName || newName === currentName) return;
    try {
      await clientApi.rename(clientId, newName);
      await fetchClients();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (clientId: string, name: string) => {
    if (!confirm(`Delete client "${name}"? This cannot be undone.`)) return;
    try {
      await clientApi.delete(clientId);
      await fetchClients();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage NAS clients connected to your account
          </p>
        </div>
        <button
          onClick={() => fetchAll()}
          className="text-gray-500 hover:text-gray-700 text-sm"
        >
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Pairing Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Pair a New Client</h2>
        <p className="text-sm text-gray-500 mb-4">
          When a NAS client starts without a clientKey, it shows a pairing code.
          Enter that code here to approve the connection.
        </p>

        {pending.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">
              Pending requests ({pending.length}):
            </p>
            <div className="flex gap-2 flex-wrap">
              {pending.map((p) => (
                <span
                  key={p.pairingCode}
                  className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-mono"
                >
                  {p.pairingCode}
                </span>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleApprove} className="flex gap-3 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pairing Code
            </label>
            <input
              type="text"
              value={pairingInput}
              onChange={(e) => setPairingInput(e.target.value)}
              placeholder="000000"
              maxLength={10}
              className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono text-center text-lg tracking-widest uppercase"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Client Name (optional)
            </label>
            <input
              type="text"
              value={pairingName}
              onChange={(e) => setPairingName(e.target.value)}
              placeholder="My NAS"
              className="w-40 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <button
            type="submit"
            disabled={pairingLoading || !pairingInput.trim()}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pairingLoading ? 'Approving...' : 'Approve'}
          </button>
        </form>

        {pairingError && (
          <p className="text-red-600 text-sm mt-2">{pairingError}</p>
        )}

        {lastKey && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800 font-medium">✓ Client paired successfully!</p>
            <p className="text-green-700 text-sm mt-1">
              Client key: <code className="bg-green-100 px-1 rounded">{lastKey}</code>
            </p>
            <button
              onClick={() => copyToClipboard(lastKey)}
              className="mt-2 text-sm text-green-600 hover:text-green-800 underline"
            >
              Copy key
            </button>
          </div>
        )}
      </div>

      {/* Clients List */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Paired Clients ({clients.length})
        </h2>

        {clients.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <p className="text-gray-500">No clients paired yet.</p>
            <p className="text-gray-400 text-sm mt-1">
              Start a NAS client to see it here.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Seen
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {clients.map((client) => (
                  <tr key={client.clientId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-medium text-gray-900">{client.name}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          client.status === 'online'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {client.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {client.lastSeen
                        ? new Date(client.lastSeen).toLocaleString()
                        : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleRename(client.clientId, client.name)}
                        className="text-primary-600 hover:text-primary-900 mr-4"
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => handleDelete(client.clientId, client.name)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
