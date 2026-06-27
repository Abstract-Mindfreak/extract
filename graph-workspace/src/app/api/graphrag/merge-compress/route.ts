import { NextRequest, NextResponse } from "next/server";
import { getUniqueNodeTypes, mergeDuplicateNodes } from "@/lib/server/graphrag-db";

export async function POST(request: NextRequest) {
  try {
    console.log('[Merge/Compress] Starting duplicate node merge process...');

    // 1. Get all unique node types from the graph
    const nodeTypes = await getUniqueNodeTypes();
    if (nodeTypes.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No node types found in the graph to merge.",
        mergeSummary: [],
      });
    }
    
    console.log(`[Merge/Compress] Found ${nodeTypes.length} unique node types to process.`);

    // 2. Iterate through each type and merge duplicates
    const mergeSummary = [];
    for (const nodeType of nodeTypes) {
      const result = await mergeDuplicateNodes(nodeType);
      mergeSummary.push(result);
    }

    console.log('[Merge/Compress] Process complete.');

    // 3. Return a summary of the merge operations
    return NextResponse.json({
      success: true,
      message: "Duplicate node merge process completed.",
      mergeSummary,
    });

  } catch (error) {
    console.error(`[Merge/Compress] Failed:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Merge/compress process failed",
      },
      { status: 500 },
    );
  }
}
