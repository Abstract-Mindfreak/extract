import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSubgraphByIds } from "@/lib/server/graphrag-db";
import { generateJson, type OllamaRuntimeConfig } from "@/lib/server/ollama";
import { EDGE_TYPES } from "@/lib/server/ontology";

interface DiscoverRelationshipsRequest {
  nodeIds: string[];
  context: string;
  ollamaEndpoint?: string;
  ollamaModel?: string;
}

interface SuggestedEdge {
    source: string; // node canonical_name
    target: string; // node canonical_name
    relation: string;
    justification: string;
    confidence: number;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as DiscoverRelationshipsRequest;

  const { nodeIds, context, ...runtimeConfig } = body;

  if (!nodeIds?.length || !context) {
    return NextResponse.json(
      { success: false, error: "nodeIds and context are required" },
      { status: 400 },
    );
  }

  try {
    // 1. Fetch the context subgraph from Memgraph
    const subgraph = await getSubgraphByIds(nodeIds);
    if (subgraph.nodes.length === 0) {
      return NextResponse.json(
        { success: false, error: "Could not find context subgraph for the given nodeIds." },
        { status: 404 },
      );
    }

    // 2. Prepare the prompt for the LLM
    const systemPrompt = `You are a relationship discovery expert. Your task is to analyze a new piece of text in the context of an existing knowledge graph. Based on this, you must propose new relationships (edges) between the nodes in the graph.

- You must only propose edges between the nodes provided in the "Existing Nodes" list.
- The proposed relationship type must be one of the "Valid Relationship Types".
- Each proposed relationship must have a clear "justification" explaining why you are suggesting it, based on the new text.
- Provide a confidence score (0.0 to 1.0) for your suggestion.
- Return a JSON object with a single key: "suggestions", containing an array of suggested edges.
- If no new relationships can be inferred, return an empty array.`;

    const userPrompt = `Please analyze the following "New Text" and propose new relationships between the "Existing Nodes".

## Existing Nodes:
${subgraph.nodes.map(n => `- ${n.canonical_name} (type: ${n.type})`).join('
')}

## Existing Edges:
${subgraph.edges.map(e => `- ${e.from} -> ${e.relation_type} -> ${e.to}`).join('
')}

## Valid Relationship Types:
${EDGE_TYPES.join(', ')}

## New Text:
"""
${context}
"""

Now, provide your suggestions in the specified JSON format.`;

    // 3. Call the LLM to get suggestions
    const llmResult = await generateJson<{ suggestions?: SuggestedEdge[] }>({
      ...runtimeConfig,
      system: systemPrompt,
      prompt: userPrompt,
      fallback: { suggestions: [] },
    });

    const suggestions = llmResult.suggestions || [];
    if (suggestions.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No new relationships were discovered.",
        suggestionsAdded: 0,
      });
    }

    // 4. Save the suggestions to the database
    let suggestionsAdded = 0;
    for (const suggestion of suggestions) {
        const sourceNode = subgraph.nodes.find(n => n.canonical_name === suggestion.source);
        const targetNode = subgraph.nodes.find(n => n.canonical_name === suggestion.target);

        if (sourceNode && targetNode) {
            await db.suggestedRelationship.create({
                data: {
                    fromNodeId: sourceNode.id,
                    toNodeId: targetNode.id,
                    fromNodeName: sourceNode.canonical_name,
                    toNodeName: targetNode.canonical_name,
                    relation_type: suggestion.relation,
                    justification: suggestion.justification,
                    confidence: suggestion.confidence,
                    status: 'PENDING',
                }
            });
            suggestionsAdded++;
        }
    }
    
    return NextResponse.json({
      success: true,
      message: `Successfully discovered and saved ${suggestionsAdded} new relationship suggestions.`,
      suggestionsAdded,
    });

  } catch (error) {
    console.error(`[Discover Relationships] Failed:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Relationship discovery failed",
      },
      { status: 500 },
    );
  }
}
