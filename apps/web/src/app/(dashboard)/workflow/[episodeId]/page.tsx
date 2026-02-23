'use client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import api from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import { statusColor } from '@/lib/utils';

const DagEditor = dynamic(() => import('@/components/flow/DagEditor'), { ssr: false });

export default function WorkflowPage() {
  const { episodeId } = useParams<{ episodeId: string }>();
  useSocket(episodeId);

  const { data: episode, isLoading } = useQuery({
    queryKey: ['episode', episodeId],
    queryFn: () => api.get(`/episodes/${episodeId}`).then((r) => r.data),
  });

  const startMutation = useMutation({
    mutationFn: () => api.post(`/episodes/${episodeId}/workflow/start`),
  });

  if (isLoading) return <div className="p-8 text-gray-400">Loading episode...</div>;

  const canRun = ['draft', 'failed'].includes(episode?.status ?? '');

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b shrink-0">
        <div>
          <Link
            href={`/series/${episode?.seriesId}`}
            className="text-blue-600 hover:underline text-xs"
          >
            ← Back to Series
          </Link>
          <h1 className="font-semibold text-gray-900">{episode?.title ?? 'Episode'}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(episode?.status ?? 'draft')}`}
          >
            {episode?.status ?? 'draft'}
          </span>
          {startMutation.isError && <span className="text-xs text-red-600">Failed to start</span>}
          <button
            onClick={() => startMutation.mutate()}
            disabled={startMutation.isPending || !canRun}
            className="bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            {startMutation.isPending ? 'Starting...' : 'Run Workflow'}
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <DagEditor
          episodeId={episodeId}
          seriesId={episode?.seriesId ?? ''}
          initialWorkflow={episode?.workflow}
        />
      </div>
    </div>
  );
}
