import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const pendingSuggestions = await db.suggestedRelationship.findMany({
      where: {
        status: 'PENDING',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      suggestions: pendingSuggestions,
    });

  } catch (error) {
    console.error(`[Get Suggested Relationships] Failed:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch suggestions",
      },
      { status: 500 },
    );
  }
}
