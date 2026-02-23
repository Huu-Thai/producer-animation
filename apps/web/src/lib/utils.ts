import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date));
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    processing: 'bg-blue-100 text-blue-700',
    rendering: 'bg-purple-100 text-purple-700',
    ready: 'bg-green-100 text-green-700',
    publishing: 'bg-yellow-100 text-yellow-700',
    public: 'bg-emerald-100 text-emerald-700',
    failed: 'bg-red-100 text-red-700',
  };
  return map[status] ?? 'bg-gray-100 text-gray-700';
}

export function nodeStatusBorder(status: string): string {
  const map: Record<string, string> = {
    pending: '#9ca3af',
    running: '#3b82f6',
    completed: '#22c55e',
    failed: '#ef4444',
  };
  return map[status] ?? '#9ca3af';
}
