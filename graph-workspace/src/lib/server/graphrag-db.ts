
import neo4j, { Driver, Session } from 'neo4j-driver';
import { validateNode, validateEdge, BaseNodeSchema, BaseEdgeSchema, ValidationResult } from './ontology';
import { z } from 'zod';

// #region Connection Management

const MEMGRAPH_URI = process.env.MEMGRAPH_URI || 'bolt://localhost:7687';
const MEMGRAPH_USERNAME = process.env.MEMGRAPH_USERNAME || '';
const MEMGRAPH_PASSWORD = process.env.MEMGRAPH_PASSWORD || '';

let driver: Driver | null = null;

/**
 * Returns the singleton Neo4j driver instance.
 * Creates a new one if it doesn't exist.
 */
export const getDriver = (): Driver => {
  if (!driver) {
    console.log('Creating new Memgraph driver...');
    driver = neo4j.driver(MEMGRAPH_URI, neo4j.auth.basic(MEMGRAPH_USERNAME, MEMGRAPH_PASSWORD));
  }
  return driver;
};

/**
 * Returns a new session from the driver.
 * Remember to close the session when you're done.
 */
export const getSession = (): Session => {
  return getDriver().session();
};

/**
 * Closes the driver connection.
 * Should be called on application shutdown.
 */
export const closeDriver = async (): Promise<void> => {
  if (driver) {
    console.log('Closing Memgraph driver...');
    await driver.close();
    driver = null;
  }
};

// #endregion

// #region Health Check

export interface DbStatus {
  connected: boolean;
  dbName?: string;
  dbVersion?: string;
  nodeCount?: number;
  edgeCount?: number;
  avgDegree?: number;
  density?: number;
  clusteringCoefficient?: number;
  embeddingDims?: number;
}

/**
 * Checks the connection status and basic stats of the graph database.
 */
export const checkGraphDbStatus = async (): Promise<DbStatus> => {
  const session = getSession();
  try {
    const versionResult = await session.run(`
      CALL dbms.components() YIELD name, versions
      WHERE name = "Memgraph"
      RETURN versions[0] AS version
    `);
    const dbVersion = versionResult.records[0]?.get('version') || 'Unknown';

    const nodeCountResult = await session.run('MATCH (n) RETURN count(n) AS count');
    const nodeCount = nodeCountResult.records[0]?.get('count').low || 0;

    const edgeCountResult = await session.run('MATCH ()-[r]->() RETURN count(r) AS count');
    const edgeCount = edgeCountResult.records[0]?.get('count').low || 0;

    let clusteringCoefficient = 0;
    if (nodeCount > 0) {
      const clusteringResult = await session.run(`
        MATCH (n)
        CALL clustering_coefficient.get(n) YIELD coefficient
        RETURN avg(coefficient) as avgCoefficient
      `);
      clusteringCoefficient = clusteringResult.records[0]?.get('avgCoefficient') || 0;
    }

    const avgDegree = nodeCount > 0 ? (2 * edgeCount) / nodeCount : 0;
    const density = nodeCount > 1 ? (2 * edgeCount) / (nodeCount * (nodeCount - 1)) : 0;

    return {
      connected: true,
      dbName: 'Memgraph',
      dbVersion,
      nodeCount,
      edgeCount,
      avgDegree,
      density,
      clusteringCoefficient,
      embeddingDims: 384, // Placeholder
    };
  } catch (error) {
    console.error('Graph DB status check failed:', error);
    return {
      connected: false,
    };
  } finally {
    await session.close();
  }
};

// #endregion

// #region Data Manipulation

type NodeInput = z.infer<typeof BaseNodeSchema>;
type EdgeInput = z.infer<typeof BaseEdgeSchema>;

/**
 * Gets all unique node "type" property values from the graph.
 */
export const getUniqueNodeTypes = async (): Promise<string[]> => {
  const session = getSession();
  try {
    const result = await session.run(`
      MATCH (n:Entity)
      RETURN collect(distinct n.type) as types
    `);
    return result.records[0]?.get('types') || [];
  } catch (error) {
    console.error(`[Get Unique Node Types] Failed:`, error);
    return [];
  } finally {
    await session.close();
  }
};


/**
 * Inserts or updates a node in the graph, performing validation.
 * @param node - The node data to upsert.
 */
export const upsertNode = async (node: NodeInput): Promise<ValidationResult> => {
  const validation = validateNode(node);
  if (!validation.success) {
    // TODO: Handle quarantine logic
    return validation;
  }

  const session = getSession();
  try {
    await session.writeTransaction(async (tx) => {
      // Use MERGE to create or update the node based on its ID.
      // We set properties on create and on match to ensure it's always up-to-date.
      await tx.run(
        `MERGE (n:Entity {id: $id})
         ON CREATE SET n += $props, n.created_at = datetime(), n.updated_at = datetime()
         ON MATCH SET n += $props, n.updated_at = datetime()`,
        {
          id: validation.data.id,
          props: validation.data,
        }
      );
    });
    return validation;
  } catch (error) {
    console.error('Failed to upsert node:', error);
    return { success: false, data: node, errors: [(error as Error).message] };
  } finally {
    await session.close();
  }
};

/**
 * Inserts or updates an edge in the graph, performing validation.
 * @param edge - The edge data to upsert.
 */
export const upsertEdge = async (edge: EdgeInput): Promise<ValidationResult> => {
  const validation = validateEdge(edge);
  if (!validation.success) {
    // TODO: Handle quarantine logic
    return validation;
  }

  const session = getSession();
  try {
    await session.writeTransaction(async (tx) => {
      // Find the source and target nodes first.
      // Then, MERGE the relationship between them.
      await tx.run(
        `MATCH (from:Entity {id: $from}), (to:Entity {id: $to})
         MERGE (from)-[r:${validation.data.relation_type} {id: $id}]->(to)
         ON CREATE SET r += $props, r.created_at = datetime(), r.updated_at = datetime()
         ON MATCH SET r += $props, r.updated_at = datetime()`,
        {
          id: validation.data.id,
          from: validation.data.from,
          to: validation.data.to,
          props: validation.data,
        }
      );
    });
    return validation;
  } catch (error) {
    console.error('Failed to upsert edge:', error);
    return { success: false, data: edge, errors: [(error as Error).message] };
  } finally {
    await session.close();
  }
};

/**
 * Gets the full graph from Memgraph.
 */
export const getGraph = async (): Promise<{ nodes: any[], edges: any[], communities: any[] }> => {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (n:Entity)
       OPTIONAL MATCH (n)-[r]->(m:Entity)
       RETURN n, r, m`
    );

    const nodes = new Map<string, any>();
    const edges = new Map<string, any>();
    const communities = new Map<string, any>();

    result.records.forEach(record => {
      const nodeN = record.get('n');
      if (nodeN && !nodes.has(nodeN.properties.id)) {
        nodes.set(nodeN.properties.id, {
          id: nodeN.properties.id,
          name: nodeN.properties.canonical_name,
          type: nodeN.properties.type,
          group: nodeN.properties.communityLevel1Id ?? 0,
        });
        if (nodeN.properties.communityLevel1Id) {
            communities.set(nodeN.properties.communityLevel1Id, {
                id: nodeN.properties.communityLevel1Id,
                nodeIds: [],
            });
        }
      }
      
      const nodeM = record.get('m');
      if (nodeM && !nodes.has(nodeM.properties.id)) {
        nodes.set(nodeM.properties.id, {
            id: nodeM.properties.id,
            name: nodeM.properties.canonical_name,
            type: nodeM.properties.type,
            group: nodeM.properties.communityLevel1Id ?? 0,
        });
        if (nodeM.properties.communityLevel1Id) {
            communities.set(nodeM.properties.communityLevel1Id, {
                id: nodeM.properties.communityLevel1Id,
                nodeIds: [],
            });
        }
      }

      const edgeR = record.get('r');
      if (edgeR && !edges.has(edgeR.properties.id)) {
        edges.set(edgeR.properties.id, {
          id: edgeR.properties.id,
          source: edgeR.startNodeElementId,
          target: edgeR.endNodeElementId,
          relation: edgeR.type,
          weight: edgeR.properties.weight ?? 1,
        });
      }
    });

    for(const node of nodes.values()){
        if(node.group && communities.has(node.group)){
            communities.get(node.group).nodeIds.push(node.id);
        }
    }

    return { nodes: Array.from(nodes.values()), edges: Array.from(edges.values()), communities: Array.from(communities.values()) };
  } catch (error) {
    console.error('Failed to get graph:', error);
    return { nodes: [], edges: [], communities: [] };
  } finally {
    await session.close();
  }
};

/**
 * Placeholder for merging communities.
 */
export const mergeCommunities = async () => {
  // TODO: Implement community merging logic
};

/**
 * Placeholder for getting a subgraph by a chunk ID.
 */
export const getSubgraphByChunk = async (chunkId: string) => {
  // TODO: Implement subgraph retrieval logic for a given chunk
  return { nodes: [], edges: [] };
};

/**
 * Retrieves a subgraph containing the specified nodes and the edges between them.
 * @param nodeIds - An array of node IDs to include in the subgraph.
 */
export const getSubgraphByIds = async (nodeIds: string[]): Promise<{ nodes: any[], edges: any[] }> => {
  if (nodeIds.length === 0) {
    return { nodes: [], edges: [] };
  }

  const session = getSession();
  try {
    const result = await session.readTransaction(async (tx) => {
      // Query for the specified nodes and all relationships between them.
      const res = await tx.run(
        `MATCH (n:Entity) WHERE n.id IN $nodeIds
         OPTIONAL MATCH (n)-[r]-(m:Entity) WHERE m.id IN $nodeIds
         RETURN n, r, m`,
        { nodeIds }
      );
      return res;
    });

    const nodes = new Map<string, any>();
    const edges = new Map<string, any>();

    result.records.forEach(record => {
      const nodeN = record.get('n');
      if (nodeN) {
        nodes.set(nodeN.properties.id, nodeN.properties);
      }
      
      const nodeM = record.get('m');
      if (nodeM) {
        nodes.set(nodeM.properties.id, nodeM.properties);
      }

      const edgeR = record.get('r');
      if (edgeR) {
        edges.set(edgeR.identity.toString(), {
          id: edgeR.properties.id,
          from: edgeR.start.toString(),
          to: edgeR.end.toString(),
          relation_type: edgeR.type,
          ...edgeR.properties
        });
      }
    });

    return { nodes: Array.from(nodes.values()), edges: Array.from(edges.values()) };
  } catch (error) {
    console.error('Failed to get subgraph:', error);
    return { nodes: [], edges: [] };
  } finally {
    await session.close();
  }
};

/**
 * Finds and merges duplicate nodes of a given type based on canonical_name.
 * This function uses a procedural approach to avoid complex, unsupported Cypher queries.
 * @param nodeType The type of node to perform the merge operation on.
 */
export const mergeDuplicateNodes = async (nodeType: string): Promise<{ mergedCount: number, type: string }> => {
  const session = getSession();
  let totalMergedCount = 0;

  try {
    // 1. Find all sets of duplicate nodes for the given type
    const duplicateSetsResult = await session.run(`
      MATCH (n:Entity {type: $nodeType})
      WITH n.canonical_name AS name, collect(n) AS nodes
      WHERE size(nodes) > 1
      RETURN nodes
    `, { nodeType });

    const duplicateNodesets = duplicateSetsResult.records.map(record => record.get('nodes'));

    for (const nodes of duplicateNodesets) {
      // 2. For each set, designate a master and duplicates
      const masterNode = nodes.shift(); // The first one is the master
      if (!masterNode) continue;

      for (const duplicateNode of nodes) {
        const masterId = masterNode.properties.id;
        const duplicateId = duplicateNode.properties.id;

        // 3. Get all relationships connected to the duplicate node
        const relsResult = await session.run(`
          MATCH (duplicate:Entity {id: $duplicateId})-[r]-(peer)
          RETURN type(r) as rel_type, properties(r) as props, startNode(r).id as startId, endNode(r).id as endId
        `, { duplicateId });

        // 4. Re-create each relationship on the master node
        for (const record of relsResult.records) {
          const rel_type = record.get('rel_type');
          const props = record.get('props');
          const startId = record.get('startId');
          const endId = record.get('endId');

          let newStartId = startId === duplicateId ? masterId : startId;
          let newEndId = endId === duplicateId ? masterId : endId;
          
          // Avoid self-referencing loops created by the merge
          if (newStartId === newEndId) continue;

          await session.run(`
            MATCH (s:Entity {id: $newStartId}), (e:Entity {id: $newEndId})
            MERGE (s)-[new_r:${rel_type}]->(e)
            ON CREATE SET new_r = $props
            ON MATCH SET new_r += $props
          `, { newStartId, newEndId, props });
        }

        // 5. Delete the duplicate node and all its relationships
        await session.run(`
          MATCH (duplicate:Entity {id: $duplicateId})
          DETACH DELETE duplicate
        `, { duplicateId });

        totalMergedCount++;
      }
    }
    
    console.log(`[Merge Nodes] Merged ${totalMergedCount} nodes of type '${nodeType}'`);
    return { mergedCount: totalMergedCount, type: nodeType };

  } catch (error) {
    console.error(`[Merge Nodes] Failed for type '${nodeType}':`, error);
    return { mergedCount: 0, type: nodeType };
  } finally {
    await session.close();
  }
};

/**
 * Runs the Louvain community detection algorithm and stores the result as a property on each node.
 */
export const runCommunityDetection = async (level: number = 1): Promise<{ nodeCount: number, communityCount: number }> => {
  const session = getSession();
  try {
    const result = await session.writeTransaction(async (tx) => {
      // 1. Run the Louvain algorithm
      const detectionResult = await tx.run(`
        CALL mage.louvain.get()
        YIELD node, community_id
        RETURN node, community_id
      `);

      let communityCount = 0;
      const communityIdMap = new Map<any, number>();
      
      // 2. Update each node with its community ID
      for (const record of detectionResult.records) {
        const node = record.get('node');
        const communityId = record.get('community_id');

        if (!communityIdMap.has(communityId)) {
          communityIdMap.set(communityId, communityCount++);
        }
        const mappedId = communityIdMap.get(communityId);

        await tx.run(
          `MATCH (n:Entity {id: $nodeId})
           SET n.communityLevel${level}Id = $communityId`,
          { nodeId: node.properties.id, communityId: mappedId }
        );
      }

      return { nodeCount: detectionResult.records.length, communityCount };
    });

    console.log(`[Community Detection] Assigned ${result.communityCount} communities to ${result.nodeCount} nodes at level ${level}.`);
    return result;

  } catch (error) {
    console.error(`[Community Detection] Failed at level ${level}:`, error);
    // This could fail if MAGE is not installed or the graph is empty.
    return { nodeCount: 0, communityCount: 0 };
  } finally {
    await session.close();
  }
};


// #endregion
