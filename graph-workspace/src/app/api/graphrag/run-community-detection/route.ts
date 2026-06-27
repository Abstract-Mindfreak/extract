import { NextRequest, NextResponse } from "next/server";
import { runCommunityDetection } from "@/lib/server/graphrag-db";

export async function POST(request: NextRequest) {
  try {
    console.log('[Community Detection] Starting...');

    const result = await runCommunityDetection(1); // Start with level 1

    if (result.nodeCount === 0) {
      return NextResponse.json({
        success: false,
        error: "Community detection failed. Ensure MAGE is installed and the graph is not empty.",
      }, { status: 500 });
    }
    
    console.log('[Community Detection] Process complete.');

    return NextResponse.json({
      success: true,
      message: `Successfully assigned ${result.communityCount} communities to ${result.nodeCount} nodes.`,
      ...result,
    });

  } catch (error) {
    console.error(`[Community Detection] Failed:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Community detection process failed",
      },
      { status: 500 },
    );
  }
}
