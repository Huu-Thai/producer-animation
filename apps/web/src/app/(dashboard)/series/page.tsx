'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { formatDate, statusColor } from '@/lib/utils';

export default function SeriesPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', genre: '', defaultLanguage: 'vi' });

  const { data, isLoading } = useQuery({
    queryKey: ['series'],
    queryFn: () => api.get('/series').then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (d: typeof form) => api.post('/series', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['series'] });
      setShowCreate(false);
      setForm({ name: '', description: '', genre: '', defaultLanguage: 'vi' });
    },
  });

  if (isLoading) return <div className="p-8 text-gray-400">Loading...</div>;

  const series = data?.data ?? [];

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Series</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium text-sm"
        >
          + New Series
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {series.map((s: any) => (
          <Link
            key={s.id}
            href={`/series/${s.id}`}
            className="block bg-white rounded-xl border p-5 hover:shadow-md transition-shadow"
          >
            <h2 className="font-semibold text-gray-900 mb-1">{s.name}</h2>
            {s.description && (
              <p className="text-sm text-gray-500 mb-3 line-clamp-2">{s.description}</p>
            )}
            <div className="flex gap-2 flex-wrap">
              {s.genre && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                  {s.genre}
                </span>
              )}
              <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                {s.defaultLanguage ?? 'vi'}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-3">{formatDate(s.createdAt)}</p>
          </Link>
        ))}
      </div>

      {series.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg mb-1">No series yet</p>
          <p className="text-sm">Create your first series to get started</p>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Create Series</h2>
            <div className="space-y-3">
              <input
                placeholder="Series name *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border px-3 py-2 rounded-lg text-sm"
              />
              <textarea
                placeholder="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full border px-3 py-2 rounded-lg h-20 resize-none text-sm"
              />
              <input
                placeholder="Genre"
                value={form.genre}
                onChange={(e) => setForm({ ...form, genre: e.target.value })}
                className="w-full border px-3 py-2 rounded-lg text-sm"
              />
              <select
                value={form.defaultLanguage}
                onChange={(e) => setForm({ ...form, defaultLanguage: e.target.value })}
                className="w-full border px-3 py-2 rounded-lg text-sm"
              >
                <option value="vi">Vietnamese</option>
                <option value="en">English</option>
              </select>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => createMutation.mutate(form)}
                disabled={!form.name || createMutation.isPending}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
              >
                Create
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 border py-2 rounded-lg hover:bg-gray-50 text-sm"
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
