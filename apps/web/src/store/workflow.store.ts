import { create } from 'zustand';
import { Node, Edge } from 'reactflow';

interface WorkflowState {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  nodeRunStatuses: Record<string, string>;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  setSelectedNode: (id: string | null) => void;
  updateNodeConfig: (nodeId: string, config: Record<string, any>) => void;
  updateNodeStatus: (nodeId: string, status: string) => void;
  resetStatuses: () => void;
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  nodeRunStatuses: {},
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setSelectedNode: (id) => set({ selectedNodeId: id }),
  updateNodeConfig: (nodeId, config) =>
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, config } } : n)),
    })),
  updateNodeStatus: (nodeId, status) =>
    set((state) => ({
      nodeRunStatuses: { ...state.nodeRunStatuses, [nodeId]: status },
    })),
  resetStatuses: () => set({ nodeRunStatuses: {} }),
}));
