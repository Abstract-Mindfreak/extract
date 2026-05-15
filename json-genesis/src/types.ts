import { v4 as uuidv4 } from 'uuid';

export type JSONType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

export interface JSONBlock {
  id: string;
  type: JSONType;
  key: string;
  value: any;
  children?: JSONBlock[];
  isExpanded?: boolean;
  libraryName?: string; // For library items
  sourcePromptBlockId?: string;
}

export interface Project {
  id: string;
  name: string;
  root: JSONBlock;
  createdAt: number;
}

export const createDefaultBlock = (type: JSONType, key: string = ''): JSONBlock => {
  const id = uuidv4();
  const base = { id, type, key, isExpanded: true };

  switch (type) {
    case 'object': return { ...base, value: {}, children: [] };
    case 'array': return { ...base, value: [], children: [] };
    case 'string': return { ...base, value: '' };
    case 'number': return { ...base, value: 0 };
    case 'boolean': return { ...base, value: false };
    case 'null': return { ...base, value: null };
  }
};

export const jsonToBlocks = (obj: any, key: string = 'root'): JSONBlock => {
  const type = obj === null ? 'null' : typeof obj as JSONType;
  const id = uuidv4();

  if (Array.isArray(obj)) {
    return {
      id,
      type: 'array',
      key,
      value: [],
      children: obj.map((item, index) => jsonToBlocks(item, index.toString())),
      isExpanded: true
    };
  }

  if (type === 'object' && obj !== null) {
    return {
      id,
      type: 'object',
      key,
      value: {},
      children: Object.entries(obj).map(([k, v]) => jsonToBlocks(v, k)),
      isExpanded: true
    };
  }

  return { id, type, key, value: obj };
};

export const blocksToJson = (block: JSONBlock): any => {
  if (block.type === 'object') {
    const obj: any = {};
    block.children?.forEach(child => {
      obj[child.key] = blocksToJson(child);
    });
    return obj;
  }

  if (block.type === 'array') {
    return block.children?.map(child => blocksToJson(child)) || [];
  }

  return block.value;
};

export const chunkJSON = (json: any, maxItems: number = 20): JSONBlock[] => {
  if (Array.isArray(json)) {
    const chunks: JSONBlock[] = [];
    for (let i = 0; i < json.length; i += maxItems) {
      const fragment = json.slice(i, i + maxItems);
      const block = jsonToBlocks(fragment, `chunk_${i / maxItems}`);
      block.libraryName = `Array Chunk ${i / maxItems + 1} (${fragment.length} items)`;
      chunks.push(block);
    }
    return chunks;
  }

  if (typeof json === 'object' && json !== null) {
    const keys = Object.keys(json);
    if (keys.length > maxItems) {
      const chunks: JSONBlock[] = [];
      for (let i = 0; i < keys.length; i += maxItems) {
        const sliceKeys = keys.slice(i, i + maxItems);
        const fragment: any = {};
        sliceKeys.forEach(k => { fragment[k] = json[k]; });
        const block = jsonToBlocks(fragment, `object_part_${i / maxItems}`);
        block.libraryName = `Object Part ${i / maxItems + 1} (${sliceKeys.length} keys)`;
        chunks.push(block);
      }
      return chunks;
    }
  }

  const block = jsonToBlocks(json, 'fragment');
  block.libraryName = 'Imported Fragment';
  return [block];
};
