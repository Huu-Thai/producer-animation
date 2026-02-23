'use client';
import { useCallback, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Connection,
  addEdge,
  ReactFlowProvider,
  useReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { useWorkflowStore } from '@/store/workflow.store';
import { NodePalette } from './NodePalette';
import { NodeConfigPanel } from './NodeConfigPanel';
import { nodeStatusBorder } from '@/lib/utils';
import { SceneParserNode } from './nodes/SceneParserNode';
import { ImageGenNode } from './nodes/ImageGenNode';
import { MotionNode } from './nodes/MotionNode';
import { VoiceNode } from './nodes/VoiceNode';
import { TimelineNode } from './nodes/TimelineNode';
import { RenderNode } from './nodes/RenderNode';
import { PublishNode } from './nodes/PublishNode';

const nodeTypes = {
  scene_parser: SceneParserNode,
  image_gen: ImageGenNode,
  motion: MotionNode,
  voice: VoiceNode,
  timeline: TimelineNode,
  render: RenderNode,
  publish: PublishNode,
};

interface DagEditorProps {
  episodeId: string;
  seriesId: string;
  initialWorkflow?: { nodes: any[]; edges: any[] } | null;
}

function FlowEditor({ episodeId, seriesId, initialWorkflow }: DagEditorProps) {
  const { nodes, edges, setNodes, setEdges, nodeRunStatuses, setSelectedNode } = useWorkflowStore();
  const { screenToFlowPosition } = useReactFlow();

  useEffect(() => {
    if (initialWorkflow) {
      setNodes(initialWorkflow.nodes ?? []);
      setEdges(initialWorkflow.edges ?? []);
    }
  }, [initialWorkflow, setNodes, setEdges]);

  const styledNodes = nodes.map((node) => ({
    ...node,
    style: {
      ...node.style,
      border: `2px solid ${nodeStatusBorder(nodeRunStatuses[node.id] ?? 'pending')}`,
      borderRadius: 8,
      background: 'white',
    },
  }));

  const onConnect = useCallback(
    (connection: Connection) => setEdges(addEdge(connection, edges)),
    [edges, setEdges],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes(applyNodeChanges(changes, nodes)),
    [nodes, setNodes],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges(applyEdgeChanges(changes, edges)),
    [edges, setEdges],
  );

  const saveMutation = useMutation({
    mutationFn: () =>
      api.patch(`/episodes/${episodeId}`, {
        workflow: { nodes, edges },
      }),
  });

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const nodeType = event.dataTransfer.getData('application/reactflow');
      if (!nodeType) return;

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const newNode = {
        id: `${nodeType}-${Date.now()}`,
        type: nodeType,
        position,
        data: { label: nodeType, config: {} },
      };
      setNodes([...nodes, newNode]);
    },
    [nodes, setNodes, screenToFlowPosition],
  );

  return (
    <div className="flex h-full">
      <NodePalette />
      <div className="flex-1 relative">
        <ReactFlow
          nodes={styledNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }}
          onNodeClick={(_, node) => setSelectedNode(node.id)}
          onPaneClick={() => setSelectedNode(null)}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode="Delete"
        >
          <Background gap={16} />
          <Controls />
          <MiniMap nodeStrokeWidth={3} />
        </ReactFlow>

        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="absolute top-4 right-4 bg-white border shadow-sm px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium z-10"
        >
          {saveMutation.isPending ? 'Saving...' : 'Save Workflow'}
        </button>

        {saveMutation.isSuccess && (
          <div className="absolute top-4 right-36 bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-xs z-10">
            Saved!
          </div>
        )}
      </div>
      <NodeConfigPanel episodeId={episodeId} seriesId={seriesId} />
    </div>
  );
}

export default function DagEditor(props: DagEditorProps) {
  return (
    <ReactFlowProvider>
      <FlowEditor {...props} />
    </ReactFlowProvider>
  );
}
