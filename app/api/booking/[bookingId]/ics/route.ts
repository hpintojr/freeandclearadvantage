import { NextResponse } from "next/server";
import { verifyConfirmationToken } from "@/lib/confirmation";
import { buildConsultationIcs, icsFileName } from "@/lib/ics";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const { bookingId } = await params;
  const token = new URL(request.url).searchParams.get("token") || "";

  const claims = verifyConfirmationToken(bookingId, token);
  if (!claims) {
    // Deliberately vague: do not distinguish "unknown booking" from "bad
    // signature" or "expired", so the route cannot be probed for valid IDs.
    return NextResponse.json(
      { error: "This calendar link is no longer valid. Please call us and we can resend it." },
      { status: 404 },
    );
  }

  const body = buildConsultationIcs({
    bookingId: claims.bookingId,
    startTime: claims.startTime,
    endTime: claims.endTime,
  });

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${icsFileName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
