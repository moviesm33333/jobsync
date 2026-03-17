import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { resolveApiKey } from "@/lib/api-key-resolver";

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    const apiKey = await resolveApiKey(userId, "neuroapi");

    if (!apiKey) {
      return NextResponse.json(
        { error: "NeuroAPI key not configured" },
        { status: 500 }
      );
    }

    const response = await fetch("https://neuroapi.host/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch NeuroAPI models" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching NeuroAPI models:", error);
    return NextResponse.json(
      { error: "Failed to fetch NeuroAPI models" },
      { status: 500 }
    );
  }
}
