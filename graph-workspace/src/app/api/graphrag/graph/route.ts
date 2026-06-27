import { NextResponse } from "next/server";
import { getGraph, checkGraphDbStatus } from "@/lib/server/graphrag-db";

export async function GET() {
  const [graph, stats] = await Promise.all([
    getGraph(),
    checkGraphDbStatus()
  ]);

  return NextResponse.json({ ...graph, stats });
}
