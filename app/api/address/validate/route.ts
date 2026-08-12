import { NextResponse } from "next/server";
import { validateAddressWithGoogle, type ValidatedAddress } from "@/lib/integrations/google-address";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Partial<ValidatedAddress> | null;
  if (!body?.address || !body.state || !body.zip) {
    return NextResponse.json({ error: "Missing address information." }, { status: 400 });
  }

  try {
    const address = await validateAddressWithGoogle({
      address: body.address.trim(),
      city: body.city?.trim() || "",
      state: body.state.trim().toUpperCase(),
      zip: body.zip.trim(),
    });
    return NextResponse.json({ address });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google address validation failed.";
    console.warn(message);
    return NextResponse.json({ error: "Address validation is temporarily unavailable." }, { status: 502 });
  }
}
