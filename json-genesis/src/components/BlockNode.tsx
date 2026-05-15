import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Braces, 
  List, 
  Quote, 
  Hash, 
  ToggleLeft, 
  CircleSlash,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { JSONBlock, JSONType } from '../types';
import { cn } from '../lib/utils';

interface BlockNodeProps {
  block: JSONBlock;
  onUpdate: (id: string, updates: Partial<JSONBlock>) => void;
  onDelete: (id: string) => void;
  onAddChild: (id: string, type: JSONType) => void;
  tagColorMap?: Record<string, string>;
  depth?: number;
}

const TYPE_CONFIG = {
  object: { 
    icon: Braces, 
    color: 'text-purple-400', 
    bg: 'bg-purple-600/5', 
    border: 'border-purple-500/20',
    label: '{ }' 
  },
  array: { 
    icon: List, 
    color: 'text-blue-400', 
    bg: 'bg-blue-600/5', 
    border: 'border-blue-500/20',
    label: '[ ]' 
  },
  string: { 
    icon: Quote, 
    color: 'text-orange-400', 
    bg: 'bg-orange-600/10', 
    border: 'border-orange-500/30',
    label: '" "' 
  },
  number: { 
    icon: Hash, 
    color: 'text-green-400', 
    bg: 'bg-green-600/10', 
    border: 'border-green-500/30',
    label: '#' 
  },
  boolean: { 
    icon: ToggleLeft, 
    color: 'text-pink-400', 
    bg: 'bg-pink-600/10', 
    border: 'border-pink-500/30',
    label: 'T/F' 
  },
  null: { 
    icon: CircleSlash, 
    color: 'text-zinc-500', 
    bg: 'bg-zinc-600/10', 
    border: 'border-zinc-500/30',
    label: 'null' 
  },
};

export const BlockNode: React.FC<BlockNodeProps> = ({ 
  block, 
  onUpdate, 
  onDelete, 
  onAddChild, 
  tagColorMap = {},
  depth = 0 
}) => {
  const config = TYPE_CONFIG[block.type];
  const Icon = config.icon;
  const tagColor = tagColorMap[block.key];

  const toggleExpand = () => {
    onUpdate(block.id, { isExpanded: !block.isExpanded });
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    let val: any = e.target.value;
    if (block.type === 'number') val = Number(val);
    if (block.type === 'boolean') val = val === 'true';
    onUpdate(block.id, { value: val });
  };

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate(block.id, { key: e.target.value });
  };

  return (
    <motion.div 
      layout
      className="relative"
    >
      <div 
        className={cn(
          "flex items-center gap-2 py-1.5 px-3 rounded-md group border transition-all duration-300",
          config.bg, config.border, 
          "hover:border-zinc-500/50 hover:shadow-[0_0_15px_rgba(0,0,0,0.2)]"
        )}
      >
        <div className="flex items-center gap-2 flex-grow min-w-0">
          {(block.type === 'object' || block.type === 'array') && (
            <button 
              onClick={toggleExpand}
              className="p-1 hover:bg-white/5 rounded cursor-pointer transition-colors text-zinc-600 hover:text-zinc-400"
            >
              {block.isExpanded ? <Minimize2 size={10} className="rotate-90" /> : <Maximize2 size={10} />}
            </button>
          )}
          
          <div className={cn("text-[10px] font-mono font-bold opacity-40 px-1 w-6 text-center shrink-0", config.color)}>
            {config.label}
          </div>

          {block.key !== 'root' && (
            <div className="flex items-center">
              <input 
                type="text"
                value={block.key}
                onChange={handleKeyChange}
                placeholder="key"
                className={cn(
                  "bg-transparent border-none text-[11px] font-mono w-24 focus:outline-none focus:text-zinc-100 transition-colors",
                  tagColor || "text-zinc-500"
                )}
              />
              <span className="text-zinc-700 font-mono text-[10px] mx-1">:</span>
            </div>
          )}

          <div className="flex-grow flex items-center gap-2 min-w-0">
            {block.type === 'string' && (
              <div className="flex items-center gap-1 flex-grow">
                <span className="text-orange-500/40 font-mono italic shrink-0">"</span>
                <input 
                  type="text"
                  value={block.value}
                  onChange={handleValueChange}
                  className="bg-transparent border-none text-orange-400 text-xs font-mono flex-grow outline-none truncate placeholder:text-orange-900/30"
                  placeholder="empty string"
                />
                <span className="text-orange-500/40 font-mono italic shrink-0">"</span>
              </div>
            )}
            {block.type === 'number' && (
              <input 
                type="number"
                value={block.value}
                onChange={handleValueChange}
                className="bg-transparent border-none text-green-400 text-xs font-mono w-full outline-none"
              />
            )}
            {block.type === 'boolean' && (
              <select 
                value={block.value.toString()}
                onChange={handleValueChange}
                className="bg-transparent border-none text-pink-400 text-xs font-mono outline-none cursor-pointer hover:text-pink-300 transition-colors"
              >
                <option value="true" className="bg-bg-panel text-pink-400">true</option>
                <option value="false" className="bg-bg-panel text-pink-400">false</option>
              </select>
            )}
            {(block.type === 'object' || block.type === 'array') && (
              <span className="text-[9px] font-mono opacity-20 uppercase tracking-tighter overflow-hidden text-ellipsis whitespace-nowrap">
                {block.children?.length || 0} items
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
          {(block.type === 'object' || block.type === 'array') && (
            <div className="flex gap-0.5 mr-2 bg-black/40 rounded-full p-0.5 border border-white/5 backdrop-blur-sm">
              {(['string', 'number', 'object', 'array'] as JSONType[]).map(t => {
                const TConfig = TYPE_CONFIG[t];
                return (
                  <button
                    key={t}
                    onClick={() => onAddChild(block.id, t)}
                    title={`Add ${t}`}
                    className={cn("p-1.5 hover:bg-white/10 rounded-full transition-all hover:scale-110", TConfig.color)}
                  >
                    <Plus size={10} />
                  </button>
                );
              })}
            </div>
          )}
          <button 
            onClick={() => onDelete(block.id)}
            className="p-1.5 hover:bg-red-500/20 text-red-900 hover:text-red-400 rounded-lg transition-all"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {block.isExpanded && block.children && block.children.length > 0 && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="ml-6 border-l border-zinc-800/40 mt-1 space-y-1"
          >
            {block.children.map(child => (
              <div key={child.id} className="relative">
                <div className="absolute top-4 left-0 w-3 h-[1px] bg-zinc-800/40" />
                <div className="pl-4">
                  <BlockNode 
                    block={child}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                    onAddChild={onAddChild}
                    tagColorMap={tagColorMap}
                    depth={depth + 1}
                  />
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
