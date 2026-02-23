'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import api from '@/lib/api';

export default function ChannelsPage() {
  const qc = useQueryClient();
  const [seriesId, setSeriesId] = useState('');

  const { data: seriesList = [] } = useQuery({
    queryKey: ['series'],
    queryFn: () => api.get('/series').then((r) => r.data?.data ?? []),
  });

  const { data: channels = [] } = useQuery({
    queryKey: ['channels', seriesId],
    queryFn: () => api.get(`/series/${seriesId}/channels`).then((r) => r.data),
    enabled: !!seriesId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/channels/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channels', seriesId] }),
  });

  async function connectYouTube() {
    if (!seriesId) return;
    const { data } = await api.get('/channels/youtube/auth', { params: { seriesId } });
    window.open(data.url, '_blank', 'width=600,height=700,noopener');
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Channels</h1>
        <button
          onClick={connectYouTube}
          disabled={!seriesId}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium text-sm"
        >
          + Connect YouTube
        </button>
      </div>

      <select
        value={seriesId}
        onChange={(e) => setSeriesId(e.target.value)}
        className="border px-3 py-2 rounded-lg text-sm mb-6 w-64"
      >
        <option value="">Select a series</option>
        {seriesList.map((s: any) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      <div className="space-y-3">
        {channels.map((c: any) => (
          <div
            key={c.id}
            className="bg-white border rounded-xl p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center font-bold text-red-700 text-sm">
                YT
              </div>
              <div>
                <p className="font-medium text-sm text-gray-900">{c.name}</p>
                <p className="text-xs text-gray-500">YouTube</p>
              </div>
            </div>
            <button
              onClick={() => deleteMutation.mutate(c.id)}
              className="text-red-500 hover:text-red-700 text-sm"
            >
              Disconnect
            </button>
          </div>
        ))}
      </div>

      {channels.length === 0 && seriesId && (
        <div className="text-center py-16 text-gray-400">
          <p>No channels connected</p>
          <p className="text-sm mt-1">Connect a YouTube channel to enable publishing</p>
        </div>
      )}
    </div>
  );
}
