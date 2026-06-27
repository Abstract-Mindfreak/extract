import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from 'uuid';
import { db } from "@/lib/db";
import { extractGraphFromText, type OllamaRuntimeConfig } from "@/lib/server/ollama";
import { upsertNode, upsertEdge } from "@/lib/server/graphrag-db";

interface IndexChunkRequest {
  chunkId: string;
  ollamaEndpoint?: string;
  ollamaModel?: string;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as IndexChunkRequest;
  const { chunkId, ...runtimeConfig } = body;

  if (!chunkId) {
    return NextResponse.json(
      { success: false, error: "chunkId is required" },
      { status: 400 },
    );
  }

  try {
    // 1. Fetch the chunk from the database
    const chunk = await db.chunk.findUnique({
      where: { id: chunkId },
    });

    if (!chunk) {
      return NextResponse.json(
        { success: false, error: "Chunk not found." },
        { status: 404 },
      );
    }
    
    console.log(`[Index Chunk] Starting indexing for chunk ID: ${chunkId}`);

    // 2. Extract graph from the chunk content
    const extraction = await extractGraphFromText(chunk.content, runtimeConfig);
    if (extraction.nodes.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No entities found in chunk. Nothing to index.",
        nodesExtracted: 0,
        edgesExtracted: 0,
      });
    }

    // 3. Upsert nodes into Memgraph
    const nodeMap = new Map<string, any>();
    for (const extractedNode of extraction.nodes) {
      const node = {
        id: uuidv4(),
        type: extractedNode.type,
        canonical_name: extractedNode.name,
        provenance: `chunk:${chunk.id}`,
      };
      await upsertNode(node);
      nodeMap.set(node.canonical_name, node);
    }

    // 4. Upsert edges into Memgraph
    let edgesExtracted = 0;
    for (const extractedEdge of extraction.edges) {
      const sourceNode = nodeMap.get(extractedEdge.source);
      const targetNode = nodeMap.get(extractedEdge.target);

      if (sourceNode && targetNode && sourceNode.id !== targetNode.id) {
        await upsertEdge({
            id: uuidv4(),
            from: sourceNode.id,
            to: targetNode.id,
            relation_type: extractedEdge.relation,
            confidence: extractedEdge.weight, // Using weight as confidence
            weight: extractedEdge.weight,
            source_chunk_id: chunk.id,
        });
        edgesExtracted++;
      }
    }

    console.log(`[Index Chunk] Complete: ${nodeMap.size} nodes, ${edgesExtracted} edges.`);
    
    return NextResponse.json({
      success: true,
      message: `Successfully indexed chunk ${chunkId}.`,
      nodesExtracted: nodeMap.size,
      edgesExtracted: edgesExtracted,
    });

  } catch (error) {
    console.error(`[Index Chunk] Failed for chunk ID ${chunkId}:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Chunk indexing failed",
      },
      { status: 500 },
    );
  }
}
