import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from 'uuid';
import { extractGraphFromText, type OllamaRuntimeConfig } from "@/lib/server/ollama";
import { upsertNode, upsertEdge } from "@/lib/server/graphrag-db";
import { filterRareRelationships, ONTOLOGY_CONSTRAINTS, EdgeWithSupport } from "@/lib/server/ontology";

interface BuildGraphRequest {
  sourceTables: string[];
  analysisMode: string;
  ollamaEndpoint?: string;
  ollamaModel?: string;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as BuildGraphRequest;

  if (!body.sourceTables?.length) {
    return NextResponse.json(
      { success: false, error: "sourceTables is required" },
      { status: 400 },
    );
  }

  try {
    console.log(`[Build Graph] Starting graph build from ${body.sourceTables.length} tables in ${body.analysisMode} mode using Memgraph.`);
    
    // NOTE: This continues to use the exported JSON as a stand-in for a live DB query.
    const fs = require('fs');
    const path = require('path');
    
    // Navigate from graph-workspace/src/app/api/graphrag/build-graph -> exported_data/
    const fullPath = path.resolve(process.cwd(), "exported_data/graphrag_input.json");
    
    if (!fs.existsSync(fullPath)) {
      return NextResponse.json(
        { success: false, error: `Exported data not found at ${fullPath}. Run export_vectorized_data.py first.` },
        { status: 404 },
      );
    }

    const fileContent = fs.readFileSync(fullPath, "utf-8");
    const data = JSON.parse(fileContent);
    
    const filteredDocuments = (data.documents || []).filter((doc: any) => 
        body.sourceTables.includes(doc.source_table)
    );
    
    console.log(`[Build Graph] Found ${filteredDocuments.length} documents from selected tables.`);
    
    if (filteredDocuments.length === 0) {
      return NextResponse.json(
        { success: false, error: "No documents found in selected tables" },
        { status: 404 },
      );
    }
    
    const nodesToCreate = new Map<string, any>();
    const allExtractedEdges: any[] = [];
    let processedDocs = 0;
    
    for (const doc of filteredDocuments.slice(0, 20)) { // Limit for testing
      processedDocs++;
      const content = doc.chunks.join("\n\n");
      if (!content.trim()) continue;
      
      console.log(`[Build Graph] Processing document ${processedDocs}/${filteredDocuments.length}: ${doc.title}`);
      
      try {
        const extraction = await extractGraphFromText(content, body as OllamaRuntimeConfig);
        
        // Stage nodes for creation
        for (const extractedNode of extraction.nodes) {
          const nodeType = body.analysisMode === "skill_tree_pathfinding" ? "skill" : extractedNode.type;
          const nodeKey = `${nodeType}__${extractedNode.name}`;

          if (!nodesToCreate.has(nodeKey)) {
            nodesToCreate.set(nodeKey, {
              id: uuidv4(),
              type: nodeType,
              canonical_name: extractedNode.name,
              provenance: `table:${doc.source_table}/id:${doc.source_id}`,
              // metadata can be added to the upsert logic if the schema supports it
            });
          }
        }
        
        // Collect all extracted edges
        allExtractedEdges.push(...extraction.edges.map(e => ({...e, docSourceTable: doc.source_table})));

      } catch (error) {
        console.error(`[Build Graph] Failed to process document ${doc.source_id}:`, error);
      }
    }

    // Upsert all unique nodes into Memgraph
    for (const node of nodesToCreate.values()) {
      await upsertNode(node);
    }

    // Prepare edges for filtering by mapping them to their node IDs
    const edgesWithIds: Omit<EdgeWithSupport, 'support_count'>[] = [];
    for (const edge of allExtractedEdges) {
        const sourceNodeType = body.analysisMode === "skill_tree_pathfinding" ? "skill" : edge.source_type || "Concept";
        const targetNodeType = body.analysisMode === "skill_tree_pathfinding" ? "skill" : edge.target_type || "Concept";

        const sourceKey = `${sourceNodeType}__${edge.source}`;
        const targetKey = `${targetNodeType}__${edge.target}`;

        const sourceNode = nodesToCreate.get(sourceKey);
        const targetNode = nodesToCreate.get(targetKey);

        if (sourceNode && targetNode && sourceNode.id !== targetNode.id) {
            edgesWithIds.push({
                id: uuidv4(),
                from: sourceNode.id,
                to: targetNode.id,
                relation_type: edge.relation,
                confidence: edge.confidence ?? 0.7,
                weight: edge.weight ?? 0.7,
            });
        }
    }
    
    // Calculate support count
    const edgeSupportMap = new Map<string, EdgeWithSupport>();
    for (const edge of edgesWithIds) {
        const edgeKey = `${edge.from}-${edge.to}-${edge.relation_type}`;
        if (edgeSupportMap.has(edgeKey)) {
            const existing = edgeSupportMap.get(edgeKey)!;
            existing.support_count++;
            existing.confidence = Math.max(existing.confidence!, edge.confidence!);
            existing.weight! += edge.weight!;
        } else {
            edgeSupportMap.set(edgeKey, { ...edge, support_count: 1 });
        }
    }

    // Filter rare relationships
    const { filtered, removed, stats } = filterRareRelationships(Array.from(edgeSupportMap.values()));

    // Upsert the filtered edges into Memgraph
    for (const edge of filtered) {
      await upsertEdge(edge);
    }

    console.log(`[Build Graph] Complete: ${nodesToCreate.size} nodes, ${filtered.length} edges created. ${removed.length} edges filtered.`);
    
    return NextResponse.json({
      success: true,
      message: `Graph built from ${processedDocs} documents`,
      nodesExtracted: nodesToCreate.size,
      edgesExtracted: filtered.length,
      edgesFiltered: removed.length,
      communities: Math.ceil(nodesToCreate.size / 10), // Estimate
      documentsProcessed: processedDocs,
      analysisMode: body.analysisMode,
      filteringStats: {
        ...stats,
        minConfidence: ONTOLOGY_CONSTRAINTS.MIN_CONFIDENCE,
        minWeight: ONTOLOGY_CONSTRAINTS.MIN_WEIGHT,
        minSupportCount: ONTOLOGY_CONSTRAINTS.MIN_SUPPORT_COUNT,
      },
    });

  } catch (error) {
    console.error(`[Build Graph] Failed:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Graph building failed",
      },
      { status: 500 },
    );
  }
}
