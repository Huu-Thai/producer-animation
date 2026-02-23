'use client';
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useWorkflowStore } from '@/store/workflow.store';

export function useSocket(episodeId: string | null, onUpdate?: () => void) {
  const socketRef = useRef<Socket | null>(null);
  const { updateNodeStatus } = useWorkflowStore();

  useEffect(() => {
    if (!episodeId) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001';
    const socket = io(wsUrl, {
      auth: { token: typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '' },
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join:episode', episodeId);
    });

    socket.on('node:status', ({ nodeId, status }: { nodeId: string; status: string }) => {
      updateNodeStatus(nodeId, status);
      onUpdate?.();
    });

    return () => {
      socket.emit('leave:episode', episodeId);
      socket.disconnect();
    };
  }, [episodeId, updateNodeStatus, onUpdate]);

  return socketRef.current;
}
