import { Handle, Position, NodeProps } from 'reactflow';

export function ImageGenNode({ data }: NodeProps) {
  return (
    <div className="bg-white rounded-lg shadow border-2 p-3 min-w-[150px]">
      <div className="flex items-center gap-2">
        <span className="text-xl">🎨</span>
        <div>
          <p className="font-semibold text-xs text-gray-900">Image Gen</p>
          <p className="text-xs text-gray-400">Leonardo.ai</p>
        </div>
      </div>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
