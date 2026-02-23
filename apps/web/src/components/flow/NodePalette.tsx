'use client';

const NODE_TYPES = [
  {
    type: 'scene_parser',
    label: 'Scene Parser',
    icon: '📝',
    desc: 'Claude AI',
    color: 'bg-violet-50 border-violet-200 text-violet-800',
  },
  {
    type: 'image_gen',
    label: 'Image Gen',
    icon: '🎨',
    desc: 'Leonardo.ai',
    color: 'bg-orange-50 border-orange-200 text-orange-800',
  },
  {
    type: 'motion',
    label: 'Motion',
    icon: '🎬',
    desc: 'OpenAI Sora',
    color: 'bg-blue-50 border-blue-200 text-blue-800',
  },
  {
    type: 'voice',
    label: 'Voice',
    icon: '🔊',
    desc: 'ElevenLabs',
    color: 'bg-green-50 border-green-200 text-green-800',
  },
  {
    type: 'timeline',
    label: 'Timeline',
    icon: '⏱️',
    desc: 'Sync + Subs',
    color: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  },
  {
    type: 'render',
    label: 'Render',
    icon: '⚙️',
    desc: 'FFmpeg 7',
    color: 'bg-red-50 border-red-200 text-red-800',
  },
  {
    type: 'publish',
    label: 'Publish',
    icon: '📺',
    desc: 'YouTube',
    color: 'bg-pink-50 border-pink-200 text-pink-800',
  },
];

export function NodePalette() {
  function onDragStart(e: React.DragEvent, nodeType: string) {
    e.dataTransfer.setData('application/reactflow', nodeType);
    e.dataTransfer.effectAllowed = 'move';
  }

  return (
    <aside className="w-52 bg-white border-r p-3 overflow-y-auto shrink-0">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Drag to canvas
      </p>
      <div className="space-y-2">
        {NODE_TYPES.map((n) => (
          <div
            key={n.type}
            draggable
            onDragStart={(e) => onDragStart(e, n.type)}
            className={`${n.color} border rounded-lg p-2.5 cursor-grab active:cursor-grabbing select-none`}
          >
            <div className="flex items-center gap-2">
              <span>{n.icon}</span>
              <div>
                <p className="text-xs font-semibold">{n.label}</p>
                <p className="text-xs opacity-70">{n.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
