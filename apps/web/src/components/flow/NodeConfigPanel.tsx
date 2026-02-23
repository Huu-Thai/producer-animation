'use client';
import { useWorkflowStore } from '@/store/workflow.store';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

interface NodeConfigPanelProps {
  episodeId: string;
  seriesId: string;
}

export function NodeConfigPanel({ episodeId, seriesId }: NodeConfigPanelProps) {
  const { selectedNodeId, nodes, updateNodeConfig } = useWorkflowStore();
  const node = nodes.find((n) => n.id === selectedNodeId);

  const { data: characters } = useQuery({
    queryKey: ['characters', seriesId],
    queryFn: () => api.get(`/series/${seriesId}/characters`).then((r) => r.data),
    enabled: !!seriesId,
  });

  const { data: channels } = useQuery({
    queryKey: ['channels', seriesId],
    queryFn: () => api.get(`/series/${seriesId}/channels`).then((r) => r.data),
    enabled: !!seriesId,
  });

  if (!node) {
    return (
      <div className="w-72 border-l bg-gray-50 p-4 flex items-center justify-center text-sm text-gray-400">
        Select a node to configure
      </div>
    );
  }

  const config = node.data?.config ?? {};

  function update(key: string, value: any) {
    updateNodeConfig(node!.id, { ...config, [key]: value });
  }

  return (
    <div className="w-72 border-l bg-white overflow-y-auto">
      <div className="p-4 border-b bg-gray-50">
        <p className="text-xs text-gray-400 uppercase tracking-wide">Node Config</p>
        <p className="font-semibold text-sm text-gray-900 mt-0.5">{node.type}</p>
        <p className="text-xs text-gray-400">{node.id}</p>
      </div>

      <div className="p-4 space-y-4">
        {node.type === 'scene_parser' && <SceneParserConfig config={config} update={update} />}
        {node.type === 'image_gen' && (
          <ImageGenConfig config={config} update={update} characters={characters ?? []} />
        )}
        {node.type === 'motion' && <MotionConfig config={config} update={update} />}
        {node.type === 'voice' && (
          <VoiceConfig config={config} update={update} characters={characters ?? []} />
        )}
        {node.type === 'timeline' && <TimelineConfig config={config} update={update} />}
        {node.type === 'render' && <RenderConfig config={config} update={update} />}
        {node.type === 'publish' && (
          <PublishConfig config={config} update={update} channels={channels ?? []} />
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full rounded-md border border-gray-200 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400';
const selectCls = inputCls;
const textareaCls = `${inputCls} min-h-[80px] resize-y`;

function SceneParserConfig({ config, update }: any) {
  return (
    <>
      <Field label="Language">
        <select
          className={selectCls}
          value={config.language ?? 'en'}
          onChange={(e) => update('language', e.target.value)}
        >
          <option value="en">English</option>
          <option value="vi">Vietnamese</option>
        </select>
      </Field>
      <Field label="Scenes per episode (max)">
        <input
          type="number"
          className={inputCls}
          value={config.maxScenes ?? 10}
          min={1}
          max={30}
          onChange={(e) => update('maxScenes', Number(e.target.value))}
        />
      </Field>
    </>
  );
}

function ImageGenConfig({ config, update, characters }: any) {
  return (
    <>
      <Field label="Art Style">
        <select
          className={selectCls}
          value={config.style ?? 'anime'}
          onChange={(e) => update('style', e.target.value)}
        >
          <option value="anime">Anime</option>
          <option value="realistic">Realistic</option>
          <option value="cartoon">Cartoon</option>
          <option value="watercolor">Watercolor</option>
        </select>
      </Field>
      <Field label="Width">
        <input
          type="number"
          className={inputCls}
          value={config.width ?? 1024}
          step={64}
          onChange={(e) => update('width', Number(e.target.value))}
        />
      </Field>
      <Field label="Height">
        <input
          type="number"
          className={inputCls}
          value={config.height ?? 576}
          step={64}
          onChange={(e) => update('height', Number(e.target.value))}
        />
      </Field>
      <Field label="Character refs">
        <select
          multiple
          className={selectCls}
          style={{ height: '100px' }}
          value={config.characterRefs ?? []}
          onChange={(e) =>
            update(
              'characterRefs',
              [...e.target.selectedOptions].map((o) => o.value),
            )
          }
        >
          {characters.map((c: any) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="LoRA ID (optional)">
        <input
          type="text"
          className={inputCls}
          placeholder="e.g. lora-abc123"
          value={config.loraId ?? ''}
          onChange={(e) => update('loraId', e.target.value)}
        />
      </Field>
    </>
  );
}

function MotionConfig({ config, update }: any) {
  return (
    <>
      <Field label="Duration (seconds)">
        <input
          type="number"
          className={inputCls}
          value={config.durationSeconds ?? 5}
          min={1}
          max={20}
          onChange={(e) => update('durationSeconds', Number(e.target.value))}
        />
      </Field>
      <Field label="Motion prompt override">
        <textarea
          className={textareaCls}
          placeholder="Leave empty to use auto-generated prompt"
          value={config.motionPromptOverride ?? ''}
          onChange={(e) => update('motionPromptOverride', e.target.value)}
        />
      </Field>
    </>
  );
}

function VoiceConfig({ config, update, characters }: any) {
  return (
    <>
      <Field label="Default character voice">
        <select
          className={selectCls}
          value={config.defaultCharacterId ?? ''}
          onChange={(e) => update('defaultCharacterId', e.target.value)}
        >
          <option value="">— Select narrator character —</option>
          {characters.map((c: any) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.voiceId ?? 'no voice'})
            </option>
          ))}
        </select>
      </Field>
      <Field label="Speech rate">
        <input
          type="range"
          min={0.5}
          max={2}
          step={0.1}
          className="w-full"
          value={config.speechRate ?? 1}
          onChange={(e) => update('speechRate', Number(e.target.value))}
        />
        <span className="text-xs text-gray-400">{config.speechRate ?? 1}x</span>
      </Field>
    </>
  );
}

function TimelineConfig({ config, update }: any) {
  return (
    <>
      <Field label="Subtitle language">
        <select
          className={selectCls}
          value={config.subtitleLanguage ?? 'en'}
          onChange={(e) => update('subtitleLanguage', e.target.value)}
        >
          <option value="">None</option>
          <option value="en">English</option>
          <option value="vi">Vietnamese</option>
        </select>
      </Field>
      <Field label="Audio offset (ms)">
        <input
          type="number"
          className={inputCls}
          value={config.audioOffsetMs ?? 0}
          step={50}
          onChange={(e) => update('audioOffsetMs', Number(e.target.value))}
        />
      </Field>
    </>
  );
}

function RenderConfig({ config, update }: any) {
  return (
    <>
      <Field label="Resolution">
        <select
          className={selectCls}
          value={config.resolution ?? '1920x1080'}
          onChange={(e) => update('resolution', e.target.value)}
        >
          <option value="1920x1080">1080p (1920×1080)</option>
          <option value="1280x720">720p (1280×720)</option>
          <option value="3840x2160">4K (3840×2160)</option>
        </select>
      </Field>
      <Field label="Video bitrate (kbps)">
        <input
          type="number"
          className={inputCls}
          value={config.bitrate ?? 8000}
          step={1000}
          onChange={(e) => update('bitrate', Number(e.target.value))}
        />
      </Field>
      <Field label="GPU encoding">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={config.useGpu ?? true}
            onChange={(e) => update('useGpu', e.target.checked)}
          />
          Use h264_nvenc (GPU)
        </label>
      </Field>
    </>
  );
}

function PublishConfig({ config, update, channels }: any) {
  return (
    <>
      <Field label="YouTube channel">
        <select
          className={selectCls}
          value={config.channelId ?? ''}
          onChange={(e) => update('channelId', e.target.value)}
        >
          <option value="">— Select channel —</option>
          {channels.map((c: any) => (
            <option key={c.id} value={c.id}>
              {c.name ?? c.id}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Title override (optional)">
        <input
          type="text"
          className={inputCls}
          placeholder="Leave empty to use episode title"
          value={config.titleOverride ?? ''}
          onChange={(e) => update('titleOverride', e.target.value)}
        />
      </Field>
      <Field label="Privacy">
        <select
          className={selectCls}
          value={config.privacyStatus ?? 'private'}
          onChange={(e) => update('privacyStatus', e.target.value)}
        >
          <option value="private">Private</option>
          <option value="unlisted">Unlisted</option>
          <option value="public">Public</option>
        </select>
      </Field>
    </>
  );
}
