'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { formatDate, statusColor } from '@/lib/utils';

export default function SeriesDetailPage() {
  const { id: seriesId } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [showEpisode, setShowEpisode] = useState(false);
  const [showSession, setShowSession] = useState(false);
  const [epForm, setEpForm] = useState({ title: '', synopsis: '', language: 'vi', sessionId: '' });
  const [sessForm, setSessForm] = useState({ name: '' });

  const { data: series } = useQuery({
    queryKey: ['series', seriesId],
    queryFn: () => api.get(`/series/${seriesId}`).then((r) => r.data),
  });

  const { data: episodes = [] } = useQuery({
    queryKey: ['episodes', seriesId],
    queryFn: () => api.get(`/series/${seriesId}/episodes`).then((r) => r.data),
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions', seriesId],
    queryFn: () => api.get(`/series/${seriesId}/sessions`).then((r) => r.data),
  });

  const createEp = useMutation({
    mutationFn: (d: typeof epForm) => api.post(`/series/${seriesId}/episodes`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['episodes', seriesId] });
      setShowEpisode(false);
      setEpForm({ title: '', synopsis: '', language: 'vi', sessionId: '' });
    },
  });

  const createSess = useMutation({
    mutationFn: (d: typeof sessForm) => api.post(`/series/${seriesId}/sessions`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions', seriesId] });
      setShowSession(false);
      setSessForm({ name: '' });
    },
  });

  return (
    <div className="p-8">
      <Link href="/series" className="text-blue-600 hover:underline text-sm">
        ← All Series
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mt-2 mb-1">{series?.name}</h1>
      {series?.description && <p className="text-gray-500 text-sm mb-6">{series.description}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sessions */}
        <div className="bg-white rounded-xl border p-5">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold text-sm">Sessions</h2>
            <button
              onClick={() => setShowSession(true)}
              className="text-xs text-blue-600 hover:underline"
            >
              + Add
            </button>
          </div>
          {sessions.length === 0 ? (
            <p className="text-xs text-gray-400">No sessions yet</p>
          ) : (
            <ul className="space-y-1">
              {sessions.map((s: any) => (
                <li key={s.id} className="text-sm text-gray-700 py-1.5 border-b last:border-0">
                  {s.name}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Episodes */}
        <div className="lg:col-span-2 bg-white rounded-xl border p-5">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold text-sm">Episodes</h2>
            <button
              onClick={() => setShowEpisode(true)}
              className="bg-blue-600 text-white px-3 py-1 rounded-lg text-xs hover:bg-blue-700"
            >
              + New Episode
            </button>
          </div>
          {episodes.length === 0 ? (
            <p className="text-xs text-gray-400">No episodes yet</p>
          ) : (
            <div className="space-y-2">
              {episodes.map((ep: any) => (
                <div
                  key={ep.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div>
                    <p className="font-medium text-sm">{ep.title}</p>
                    <p className="text-xs text-gray-400">{formatDate(ep.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(ep.status)}`}
                    >
                      {ep.status}
                    </span>
                    <Link
                      href={`/workflow/${ep.id}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Open DAG
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-80">
            <h2 className="font-semibold mb-4">Create Session</h2>
            <input
              placeholder="Session name"
              value={sessForm.name}
              onChange={(e) => setSessForm({ name: e.target.value })}
              className="w-full border px-3 py-2 rounded-lg text-sm mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => createSess.mutate(sessForm)}
                disabled={!sessForm.name}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm disabled:opacity-50"
              >
                Create
              </button>
              <button
                onClick={() => setShowSession(false)}
                className="flex-1 border py-2 rounded-lg text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showEpisode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="font-semibold mb-4">Create Episode</h2>
            <div className="space-y-3">
              <input
                placeholder="Episode title *"
                value={epForm.title}
                onChange={(e) => setEpForm({ ...epForm, title: e.target.value })}
                className="w-full border px-3 py-2 rounded-lg text-sm"
              />
              <textarea
                placeholder="Synopsis"
                value={epForm.synopsis}
                onChange={(e) => setEpForm({ ...epForm, synopsis: e.target.value })}
                className="w-full border px-3 py-2 rounded-lg text-sm h-16 resize-none"
              />
              <select
                value={epForm.sessionId}
                onChange={(e) => setEpForm({ ...epForm, sessionId: e.target.value })}
                className="w-full border px-3 py-2 rounded-lg text-sm"
              >
                <option value="">Select session *</option>
                {sessions.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                value={epForm.language}
                onChange={(e) => setEpForm({ ...epForm, language: e.target.value })}
                className="w-full border px-3 py-2 rounded-lg text-sm"
              >
                <option value="vi">Vietnamese</option>
                <option value="en">English</option>
              </select>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => createEp.mutate(epForm)}
                disabled={!epForm.title || !epForm.sessionId}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm disabled:opacity-50"
              >
                Create
              </button>
              <button
                onClick={() => setShowEpisode(false)}
                className="flex-1 border py-2 rounded-lg text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
