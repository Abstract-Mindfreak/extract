
import { z } from 'zod';

// #region Base Ontology Schemas

/**
 * Defines the required attributes for all nodes (entities) in the graph.
 */
export const BaseNodeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  canonical_name: z.string().min(1),
  source_session_id: z.string().optional(),
  provenance: z.string().optional(),
  created_at: z.string().datetime().default(new Date().toISOString()),
  updated_at: z.string().datetime().default(new Date().toISOString()),
});

/**
 * Defines the required attributes for all edges (relationships) in the graph.
 */
export const BaseEdgeSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  relation_type: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
  weight: z.number().optional(),
  source_chunk_id: z.string().optional(),
  source_row_id: z.string().optional(),
  direction: z.enum(['directed', 'undirected']).default('directed'),
  created_at: z.string().datetime().default(new Date().toISOString()),
});

// #endregion

// #region Node Types

/**
 * A list of all valid node types (entities).
 * Used for strict validation during data ingestion.
 */
export const NODE_TYPES = [
  'Session',
  'Track',
  'Artist',
  'User',
  'ActionEvent',
  'Playlist',
  'Tag',
  'Concept',
  'Community',
  'ClusterSummary',
  'UNKNOWN_ENTITY_TYPE', // For quarantine
] as const;

export const NodeTypeEnum = z.enum(NODE_TYPES);

// #endregion

// #region Edge Types

/**
 * A list of all valid edge types (relationships).
 * Used for strict validation during data ingestion.
 */
export const EDGE_TYPES = [
  'PLAYED',
  'SKIPPED',
  'LIKED',
  'BELONGS_TO_PLAYLIST',
  'HAS_TAG',
  'SIMILAR_TO',
  'PART_OF_SESSION',
  'DERIVES_FROM',
  'SUMMARIZES_COMMUNITY',
  'CAUSES',
  'FOLLOWS',
  'CO_OCCURS_WITH',
  'UNKNOWN_RELATION', // For quarantine
] as const;

export const EdgeTypeEnum = z.enum(EDGE_TYPES);

// #endregion

// #region Full Ontology Definition

/**
 * A comprehensive object defining the schema for all nodes and edges.
 * This can be used by LLMs for entity/relationship extraction.
 */
export const FlowmusicOntology = {
  nodes: {
    types: NODE_TYPES,
    base_schema: BaseNodeSchema.shape,
    // TODO: Define specific attributes for each node type if needed
    // e.g., Session: { ...BaseNodeSchema.shape, duration: z.number() }
  },
  edges: {
    types: EDGE_TYPES,
    base_schema: BaseEdgeSchema.shape,
    // TODO: Define specific attributes for each edge type if needed
  },
};

// #endregion

// #region Validation Logic

export interface ValidationResult {
  success: boolean;
  errors?: string[];
  quarantine?: boolean;
  type?: 'node' | 'edge';
  data: any;
}

/**
 * Validates a node against the defined ontology.
 * @param node - The node object to validate.
 * @returns A validation result.
 */
export const validateNode = (node: unknown): ValidationResult => {
  const parseResult = BaseNodeSchema.extend({
    type: NodeTypeEnum,
  }).safeParse(node);

  if (parseResult.success) {
    return { success: true, data: parseResult.data };
  }

  const quarantineResult = BaseNodeSchema.extend({
    type: z.string(), // Allow any string initially
  }).safeParse(node);

  if (quarantineResult.success) {
    return {
      success: false,
      quarantine: true,
      type: 'node',
      data: { ...quarantineResult.data, type: 'UNKNOWN_ENTITY_TYPE' },
      errors: [`Invalid node type: ${quarantineResult.data.type}`],
    };
  }

  return {
    success: false,
    errors: parseResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
    data: node,
  };
};

/**
 * Validates an edge against the defined ontology.
 * @param edge - The edge object to validate.
 * @returns A validation result.
 */
export const validateEdge = (edge: unknown): ValidationResult => {
    const parseResult = BaseEdgeSchema.extend({
        relation_type: EdgeTypeEnum,
    }).safeParse(edge);

    if (parseResult.success) {
        return { success: true, data: parseResult.data };
    }

    const quarantineResult = BaseEdgeSchema.extend({
        relation_type: z.string(), // Allow any string initially
    }).safeParse(edge);


    if (quarantineResult.success) {
        return {
            success: false,
            quarantine: true,
            type: 'edge',
            data: { ...quarantineResult.data, relation_type: 'UNKNOWN_RELATION' },
            errors: [`Invalid edge type: ${quarantineResult.data.relation_type}`],
        };
    }

  return {
    success: false,
    errors: parseResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
    data: edge,
  };
};

// #endregion

// #region Constraints and Filtering

export const ONTOLOGY_CONSTRAINTS = {
  MIN_CONFIDENCE: 0.7,
  MIN_WEIGHT: 0.5,
  MIN_SUPPORT_COUNT: 1,
  MAX_ENTITY_NAME_LENGTH: 128,
  CONFIDENCE_RANGE: [0, 1] as [number, number],
  WEIGHT_RANGE: [0, Infinity] as [number, number],
};

export type EdgeWithSupport = z.infer<typeof BaseEdgeSchema> & {
  support_count: number;
};

/**
 * Filters out rare or low-confidence relationships from an array.
 */
export function filterRareRelationships(
  relationships: EdgeWithSupport[],
  options?: {
    minConfidence?: number;
    minWeight?: number;
    minSupportCount?: number;
  }
): {
  filtered: z.infer<typeof BaseEdgeSchema>[];
  removed: EdgeWithSupport[];
  stats: { removedByConfidence: number; removedByWeight: number; removedBySupport: number };
} {
  const minConfidence = options?.minConfidence ?? ONTOLOGY_CONSTRAINTS.MIN_CONFIDENCE;
  const minWeight = options?.minWeight ?? ONTOLOGY_CONSTRAINTS.MIN_WEIGHT;
  const minSupportCount = options?.minSupportCount ?? ONTOLOGY_CONSTRAINTS.MIN_SUPPORT_COUNT;

  const filtered: z.infer<typeof BaseEdgeSchema>[] = [];
  const removed: EdgeWithSupport[] = [];
  const stats = {
    removedByConfidence: 0,
    removedByWeight: 0,
    removedBySupport: 0,
  };

  for (const rel of relationships) {
    let shouldRemove = false;
    let removedForSupport = false;
    
    if ((rel.confidence ?? 1.0) < minConfidence) {
      stats.removedByConfidence++;
      shouldRemove = true;
    }

    if ((rel.weight ?? 1.0) < minWeight) {
      stats.removedByWeight++;
      shouldRemove = true;
    }

    if (rel.support_count < minSupportCount) {
      stats.removedBySupport++;
      shouldRemove = true;
      removedForSupport = true;
    }

    if (shouldRemove) {
      // Since confidence and weight can be cumulative, we log support separately
      if (removedForSupport) {
        removed.push(rel);
      }
    } else {
      filtered.push(rel);
    }
  }

  return { filtered, removed, stats };
}

// #endregion
