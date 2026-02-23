'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef } from 'react';
import axios from 'axios';
import api from '@/lib/api';

export default function AssetsPage() {
  const qc = useQueryClient();
  const [typeFilter, setTypeFilter] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: assets = [] } = useQuery({
    queryKey: ['assets', typeFilter],
    queryFn: () =>
      api.get('/assets', { params: typeFilter ? { type: typeFilter } : {} }).then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/assets/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }),
  });

  async function handleUpload(file: File) {
    setUploading(true);
    setProgress(0);
    try {
      const { data } = await api.post('/assets/presign', {
        contentType: file.type,
        fileName: file.name,
        fileSize: file.size,
      });

      await axios.put(data.uploadUrl, file, {
        headers: { 'Content-Type': file.type },
        onUploadProgress: (e) => {
          setProgress(Math.round(((e.loaded ?? 0) / (e.total ?? 1)) * 100));
        },
      });

      qc.invalidateQueries({ queryKey: ['assets'] });
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const typeIcon: Record<string, string> = { image: '🖼️', video: '🎬', audio: '🔊' };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Asset Library</h1>
        <div className="flex gap-3 items-center">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border px-3 py-2 rounded-lg text-sm"
          >
            <option value="">All types</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
            <option value="audio">Audio</option>
          </select>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            {uploading ? `Uploading ${progress}%` : '+ Upload'}
          </button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept="image/jpeg,image/png,video/mp4,audio/mpeg"
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {assets.map((a: any) => (
          <div key={a.id} className="bg-white border rounded-lg p-3 group relative">
            <div className="aspect-square bg-gray-50 rounded flex items-center justify-center mb-2 text-3xl">
              {typeIcon[a.type] ?? '📄'}
            </div>
            <p className="text-xs text-gray-600 truncate">{a.metadata?.fileName ?? a.storageKey}</p>
            <button
              onClick={() => deleteMutation.mutate(a.id)}
              className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {assets.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p>No assets yet</p>
          <p className="text-sm mt-1">Upload images, videos or audio files</p>
        </div>
      )}
    </div>
  );
}
