'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef } from 'react';
import api from '@/lib/api';

export default function CharactersPage() {
  const qc = useQueryClient();
  const [seriesId, setSeriesId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '',
    personalityPrompt: '',
    visualPrompt: '',
    voiceId: '',
  });
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data: seriesList = [] } = useQuery({
    queryKey: ['series'],
    queryFn: () => api.get('/series').then((r) => r.data?.data ?? []),
  });

  const { data: characters = [] } = useQuery({
    queryKey: ['characters', seriesId],
    queryFn: () => api.get(`/series/${seriesId}/characters`).then((r) => r.data),
    enabled: !!seriesId,
  });

  const createMutation = useMutation({
    mutationFn: (d: typeof form) => api.post(`/series/${seriesId}/characters`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['characters', seriesId] });
      setShowCreate(false);
      setForm({ name: '', personalityPrompt: '', visualPrompt: '', voiceId: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/characters/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['characters', seriesId] }),
  });

  const previewVoiceMutation = useMutation({
    mutationFn: async (voiceId: string) => {
      setPreviewingVoiceId(voiceId);
      const res = await api.post('/characters/voice-preview', {
        voiceId,
        text: 'Hello! This is a voice preview.',
      });
      return res.data.audioUrl as string;
    },
    onSuccess: (audioUrl) => {
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play();
      }
    },
    onSettled: () => setPreviewingVoiceId(null),
  });

  return (
    <div className="p-8">
      {/* Hidden audio element for voice preview playback */}
      <audio ref={audioRef} style={{ display: 'none' }} />

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Characters</h1>
        <button
          onClick={() => setShowCreate(true)}
          disabled={!seriesId}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-sm"
        >
          + New Character
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {characters.map((c: any) => (
          <div key={c.id} className="bg-white border rounded-xl p-4">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold text-gray-900">{c.name}</h3>
              <button
                onClick={() => deleteMutation.mutate(c.id)}
                className="text-red-500 hover:text-red-700 text-xs"
              >
                Delete
              </button>
            </div>
            {c.personalityPrompt && (
              <p className="text-xs text-gray-500 line-clamp-2 mb-2">{c.personalityPrompt}</p>
            )}
            {c.voiceId && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">
                  {c.voiceId.slice(0, 8)}…
                </span>
                <button
                  onClick={() => previewVoiceMutation.mutate(c.voiceId)}
                  disabled={previewingVoiceId === c.voiceId}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 disabled:opacity-50"
                >
                  {previewingVoiceId === c.voiceId ? <span>Loading…</span> : <>▶ Preview voice</>}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="font-semibold mb-4">Create Character</h2>
            <div className="space-y-3">
              <input
                placeholder="Name *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border px-3 py-2 rounded-lg text-sm"
              />
              <textarea
                placeholder="Personality prompt"
                value={form.personalityPrompt}
                onChange={(e) => setForm({ ...form, personalityPrompt: e.target.value })}
                className="w-full border px-3 py-2 rounded-lg text-sm h-16 resize-none"
              />
              <textarea
                placeholder="Visual prompt"
                value={form.visualPrompt}
                onChange={(e) => setForm({ ...form, visualPrompt: e.target.value })}
                className="w-full border px-3 py-2 rounded-lg text-sm h-16 resize-none"
              />
              <div>
                <input
                  placeholder="ElevenLabs Voice ID"
                  value={form.voiceId}
                  onChange={(e) => setForm({ ...form, voiceId: e.target.value })}
                  className="w-full border px-3 py-2 rounded-lg text-sm"
                />
                {form.voiceId && (
                  <button
                    type="button"
                    onClick={() => previewVoiceMutation.mutate(form.voiceId)}
                    disabled={!!previewingVoiceId}
                    className="mt-1 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                  >
                    ▶ Preview this voice ID
                  </button>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => createMutation.mutate(form)}
                disabled={!form.name || createMutation.isPending}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm disabled:opacity-50"
              >
                {createMutation.isPending ? 'Creating…' : 'Create'}
              </button>
              <button
                onClick={() => setShowCreate(false)}
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
