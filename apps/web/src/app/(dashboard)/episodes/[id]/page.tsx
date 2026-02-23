'use client';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import { useState } from 'react';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

type NodeRun = {
  id: string;
  nodeId: string;
  nodeType: string;
  status: string;
  input: any;
  output: any;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

export default function EpisodeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [selectedNode, setSelectedNode] = useState<NodeRun | null>(null);

  const { data: episode, refetch } = useQuery({
    queryKey: ['episode', id],
    queryFn: () => api.get(`/episodes/${id}`).then((r) => r.data),
  });

  // Real-time updates via WebSocket
  useSocket(id, () => refetch());

  const nodeRuns: NodeRun[] = episode?.nodeRuns ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Episode header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{episode?.title ?? 'Loading...'}</h1>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[episode?.status ?? 'pending'] ?? STATUS_COLORS.pending}`}
          >
            {episode?.status ?? '—'}
          </span>
        </div>
        {episode?.synopsis && <p className="mt-2 text-gray-500 text-sm">{episode.synopsis}</p>}
      </div>

      {/* Video preview */}
      {episode?.finalVideoUrl && (
        <div className="mb-6 rounded-xl overflow-hidden border shadow-sm">
          <video
            src={episode.finalVideoUrl}
            poster={episode.thumbnailUrl}
            controls
            className="w-full max-h-[480px] bg-black"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Node run log */}
        <div className="lg:col-span-2">
          <h2 className="text-base font-semibold text-gray-800 mb-3">Node Run Log</h2>
          <div className="space-y-2">
            {nodeRuns.length === 0 && (
              <p className="text-gray-400 text-sm py-4 text-center">No node runs yet.</p>
            )}
            {nodeRuns.map((run) => (
              <button
                key={run.id}
                onClick={() => setSelectedNode(run === selectedNode ? null : run)}
                className={`w-full text-left rounded-lg border p-3 transition-colors ${
                  selectedNode?.id === run.id
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[run.status] ?? STATUS_COLORS.pending}`}
                    >
                      {run.status}
                    </span>
                    <span className="text-sm font-medium text-gray-800">{run.nodeType}</span>
                    <span className="text-xs text-gray-400">{run.nodeId}</span>
                  </div>
                  {run.completedAt && run.startedAt && (
                    <span className="text-xs text-gray-400">
                      {(
                        (new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) /
                        1000
                      ).toFixed(1)}
                      s
                    </span>
                  )}
                </div>
                {run.error && <p className="mt-1 text-xs text-red-600 truncate">{run.error}</p>}
              </button>
            ))}
          </div>
        </div>

        {/* Node output inspector */}
        <div>
          <h2 className="text-base font-semibold text-gray-800 mb-3">Output Inspector</h2>
          {selectedNode ? (
            <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Node</p>
                <p className="text-sm text-gray-900">
                  {selectedNode.nodeType} / {selectedNode.nodeId}
                </p>
              </div>

              {/* Media preview if output has URL */}
              {selectedNode.output?.image_url && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Image Output</p>
                  <img
                    src={selectedNode.output.image_url}
                    alt="Node output"
                    className="w-full rounded border"
                  />
                </div>
              )}
              {selectedNode.output?.video_url && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Video Output</p>
                  <video
                    src={selectedNode.output.video_url}
                    controls
                    className="w-full rounded border"
                  />
                </div>
              )}
              {selectedNode.output?.audio_url && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Audio Output</p>
                  <audio src={selectedNode.output.audio_url} controls className="w-full" />
                </div>
              )}

              {/* Raw output JSON */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Raw Output</p>
                <pre className="text-xs bg-gray-50 rounded p-2 overflow-auto max-h-48 text-gray-700">
                  {JSON.stringify(selectedNode.output, null, 2) ?? 'null'}
                </pre>
              </div>

              {selectedNode.error && (
                <div>
                  <p className="text-xs font-medium text-red-500 mb-1">Error</p>
                  <pre className="text-xs bg-red-50 rounded p-2 text-red-700 whitespace-pre-wrap">
                    {selectedNode.error}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-400">
              Select a node run to inspect its output
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
