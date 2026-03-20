import { searchBangumi } from "@repo/anime-core/bangumi";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() || "";

  if (!query) {
    return NextResponse.json([]);
  }

  try {
    const data = await searchBangumi(query);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Bangumi API error", error);
    return NextResponse.json(
      {
        message: "Bangumi API request failed",
      },
      {
        status: 500,
      },
    );
  }
}
