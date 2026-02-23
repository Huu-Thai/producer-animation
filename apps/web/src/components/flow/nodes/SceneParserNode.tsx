import { Handle, Position, NodeProps } from 'reactflow';

export function SceneParserNode({ data }: NodeProps) {
  return (
    <div className="bg-white rounded-lg shadow border-2 p-3 min-w-[150px]">
      <div className="flex items-center gap-2">
        <span className="text-xl">📝</span>
        <div>
          <p className="font-semibold text-xs text-gray-900">Scene Parser</p>
          <p className="text-xs text-gray-400">Claude AI</p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
