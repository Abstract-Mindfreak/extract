import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { upsertEdge } from "@/lib/server/graphrag-db";
import { v4 as uuidv4 } from 'uuid';

interface UpdateSuggestionRequest {
  status: 'APPROVED' | 'REJECTED';
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const body = (await request.json().catch(() => ({}))) as UpdateSuggestionRequest;
  const { status } = body;

  if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
    return NextResponse.json(
      { success: false, error: "Invalid status provided. Must be 'APPROVED' or 'REJECTED'." },
      { status: 400 },
    );
  }

  try {
    const suggestion = await db.suggestedRelationship.findUnique({
      where: { id },
    });

    if (!suggestion) {
      return NextResponse.json(
        { success: false, error: "Suggestion not found." },
        { status: 404 },
      );
    }

    if (suggestion.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: `Suggestion is already ${suggestion.status}.`},
        { status: 400 },
      );
    }

    // Update the status in the relational DB
    const updatedSuggestion = await db.suggestedRelationship.update({
      where: { id },
      data: { status },
    });

    // If approved, also add it to the main graph in Memgraph
    if (status === 'APPROVED') {
      await upsertEdge({
        id: uuidv4(),
        from: suggestion.fromNodeId,
        to: suggestion.toNodeId,
        relation_type: suggestion.relation_type,
        confidence: suggestion.confidence,
        weight: suggestion.confidence, // Use confidence as initial weight
      });
    }

    return NextResponse.json({
      success: true,
      suggestion: updatedSuggestion,
    });

  } catch (error) {
    console.error(`[Update Suggestion] Failed for ID ${id}:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update suggestion",
      },
      { status: 500 },
    );
  }
}
