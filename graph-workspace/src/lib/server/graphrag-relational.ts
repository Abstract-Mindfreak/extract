import { db } from "@/lib/db";
import { ensureWorkspaceTables } from "@/lib/server/bootstrap";
import { chunkText, makeNodeKey, serializeGraphResponse, toJsonString, upsertScopedNode } from "@/lib/server/graph-data";
import { extractGraphFromText, type OllamaRuntimeConfig } from "@/lib/server/ollama";

export async function ingestDocument(input: {
  title: string;
  content: string;
  fileType?: string;
  runtime?: OllamaRuntimeConfig;
}) {
  await ensureWorkspaceTables();
  const chunks = chunkText(input.content);
  const extraction = await extractGraphFromText(input.content, input.runtime);

  const document = await db.document.create({
    data: {
      title: input.title,
      content: input.content,
      fileType: input.fileType || "text",
      chunkCount: chunks.length,
    },
  });

  if (chunks.length) {
    await db.chunk.createMany({
      data: chunks.map((chunk, index) => ({
        documentId: document.id,
        index,
        content: chunk,
        embedding: "[]",
      })),
    });
  }

  const nodeIds = new Map<string, string>();
  for (const node of extraction.nodes) {
    const storedNode = await upsertScopedNode({
      namespace: "graphrag",
      key: makeNodeKey(["graphrag", node.type, node.name]),
      name: node.name,
      type: node.type,
      metadata: {
        description: node.description || null,
        documentId: document.id,
      },
    });
    nodeIds.set(node.name, storedNode.id);
  }

  let edgesExtracted = 0;
  for (const edge of extraction.edges) {
    const sourceId = nodeIds.get(edge.source);
    const targetId = nodeIds.get(edge.target);
    if (!sourceId || !targetId || sourceId === targetId) {
      continue;
    }

    await db.edge.create({
      data: {
        namespace: "graphrag",
        sourceId,
        targetId,
        relation: edge.relation,
        weight: edge.weight ?? 0.7,
        description: edge.description || extraction.summary || null,
        edgeType: "EXTRACTED",
      },
    });
    edgesExtracted += 1;
  }

  return {
    document,
    chunksCreated: chunks.length,
    nodesExtracted: nodeIds.size,
    edgesExtracted,
    summary: extraction.summary,
  };
}

export async function getGraphRagGraph() {
  await ensureWorkspaceTables();
  const [nodes, edges, documents] = await Promise.all([
    db.graphNode.findMany({
      where: { namespace: "graphrag" },
      orderBy: { createdAt: "asc" },
    }),
    db.edge.findMany({
      where: { namespace: "graphrag" },
      orderBy: { createdAt: "asc" },
    }),
    db.document.findMany({
      orderBy: { updatedAt: "desc" },
      take: 24,
    }),
  ]);

  const serialized = serializeGraphResponse({ nodes, edges });
  return {
    ...serialized,
    stats: {
      totalDocuments: documents.length,
      totalNodes: nodes.length,
      totalEdges: edges.length,
      communities: serialized.communities.length,
      chunkCount: documents.reduce((sum, doc) => sum + doc.chunkCount, 0),
    },
    documents,
  };
}

export function buildGraphContext(input: {
  nodes: Array<{
    id: string;
    name: string;
    type: string;
    metadata: string;
  }>;
  edges: Array<{
    id: string;
    sourceId: string;
    targetId: string;
    relation: string;
    description: string | null;
  }>;
}) {
  const nodeNames = new Map(input.nodes.map((node) => [node.id, node.name]));
  return toJsonString({
    nodes: input.nodes.map((node) => ({
      id: node.id,
      name: node.name,
      type: node.type,
      metadata: node.metadata,
    })),
    edges: input.edges.map((edge) => ({
      id: edge.id,
      source: nodeNames.get(edge.sourceId) || edge.sourceId,
      target: nodeNames.get(edge.targetId) || edge.targetId,
      relation: edge.relation,
      description: edge.description,
    })),
  });
}
