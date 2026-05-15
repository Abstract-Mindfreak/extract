import React from 'react';
import { 
  Braces, 
  List, 
  Quote, 
  Hash, 
  ToggleLeft, 
  CircleSlash,
  Brain,
  Library,
  Box
} from 'lucide-react';
import { JSONType, JSONBlock } from '../types';

const BLOCK_TYPES: { type: JSONType; label: string; icon: any; color: string; indicator: string }[] = [
  { type: 'string', label: 'String Block', icon: Quote, color: 'text-orange-500', indicator: 'border-orange-500' },
  { type: 'number', label: 'Number Block', icon: Hash, color: 'text-green-500', indicator: 'border-green-500' },
  { type: 'object', label: 'Object Shell', icon: Braces, color: 'text-purple-500', indicator: 'border-purple-500' },
  { type: 'array', label: 'Array Stack', icon: List, color: 'text-blue-500', indicator: 'border-blue-500' },
  { type: 'boolean', label: 'Boolean Flux', icon: ToggleLeft, color: 'text-pink-500', indicator: 'border-pink-500' },
  { type: 'null', label: 'Null Void', icon: CircleSlash, color: 'text-zinc-500', indicator: 'border-zinc-500' },
];

interface BlockPaletteProps {
  onAddRoot: (type: JSONType) => void;
  customBlocks?: JSONBlock[];
  onAddCustomBlock?: (block: JSONBlock) => void;
  onPreviewCustomBlock?: (block: JSONBlock) => void;
  activePreviewBlockId?: string | null;
}

export const BlockPalette: React.FC<BlockPaletteProps> = ({ 
  onAddRoot, 
  customBlocks = [], 
  onAddCustomBlock,
  onPreviewCustomBlock,
  activePreviewBlockId
}) => {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Library size={12} className="text-zinc-500" />
            <h2 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Base Primitives</h2>
          </div>
          <span className="text-[9px] font-mono text-zinc-700 bg-white/5 px-1.5 py-0.5 rounded">06</span>
        </div>
        
        <div className="grid grid-cols-1 gap-1.5">
          {BLOCK_TYPES.map((bt) => {
            const Icon = bt.icon;
            return (
              <button
                key={bt.type}
                onClick={() => onAddRoot(bt.type)}
                className={`flex items-center gap-3 p-2.5 bg-bg-deep border-l border-zinc-800 rounded-md hover:bg-zinc-800/50 hover:border-zinc-700 transition-all group text-left cursor-pointer active:scale-95`}
              >
                <div className={`w-6 h-6 flex items-center justify-center bg-black rounded text-xs font-mono shrink-0 shadow-inner ${bt.color}`}>
                  <Icon size={14} />
                </div>
                <span className="text-[11px] font-medium text-zinc-400 group-hover:text-zinc-200 transition-colors">{bt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {customBlocks.length > 0 && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
           <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Box size={12} className="text-orange-500/50" />
              <h2 className="text-[10px] uppercase tracking-widest text-orange-500 font-bold">Imported Fragments</h2>
            </div>
            <span className="text-[9px] font-mono text-orange-500/50 bg-orange-500/5 px-1.5 py-0.5 rounded italic">{customBlocks.length}</span>
          </div>
          <div className="space-y-1.5">
            {customBlocks.map((block) => (
              <div
                key={block.id}
                className={`w-full p-3 border rounded-lg transition-all group ${
                  activePreviewBlockId === block.id
                    ? 'border-orange-500/30 bg-orange-500/10'
                    : 'border-zinc-800 bg-bg-deep hover:bg-orange-500/5 hover:border-orange-500/20'
                }`}
              >
                <div className="flex items-center justify-between mb-1 gap-2">
                  <button
                    onClick={() => onPreviewCustomBlock?.(block)}
                    className="text-[9px] font-mono text-zinc-600 group-hover:text-orange-500/50 uppercase tracking-tighter truncate max-w-[140px] text-left"
                  >
                    {block.libraryName || 'Untitled Block'}
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="text-[8px] bg-white/5 px-1 rounded text-zinc-700 uppercase">{block.type}</div>
                    <button
                      onClick={() => onAddCustomBlock?.(block)}
                      className="text-[8px] px-2 py-1 rounded bg-orange-500/10 text-orange-300 border border-orange-500/20 uppercase"
                    >
                      Add
                    </button>
                  </div>
                </div>
                <div className="text-[10px] font-mono text-zinc-500 line-clamp-1 opacity-40 italic">
                  {JSON.stringify(block.value).substring(0, 40)}...
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Brain size={12} className="text-zinc-500" />
          <h2 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">AI Blueprints</h2>
        </div>
        <div className="space-y-2">
          {['SYSTEM_STATE', 'RECH_GEOM', 'META_REGISTRY'].map((skel) => (
            <div 
              key={skel}
              className="p-3 border border-dashed border-zinc-700/50 rounded bg-bg-deep/50 opacity-60 hover:opacity-100 transition-opacity cursor-pointer group"
            >
              <p className="text-[9px] text-zinc-500 mb-1 group-hover:text-orange-500 transition-colors tracking-tighter">{skel}</p>
              <p className="text-[10px] font-mono text-zinc-400">{"{ status, mode, ... }"}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
