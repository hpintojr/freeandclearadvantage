import type { LeadPayload } from "../types";

type GoogleValidationResponse = {
  result?: {
    address?: {
      formattedAddress?: string;
      postalAddress?: {
        locality?: string;
        administrativeArea?: string;
        postalCode?: string;
      };
    };
  };
};

export type ValidatedAddress = Pick<LeadPayload, "address" | "city" | "state" | "zip">;

export async function validateAddressWithGoogle(address: ValidatedAddress): Promise<ValidatedAddress | null> {
  const apiKey = process.env.GOOGLE_ADDRESS_VALIDATION_API_KEY?.trim();
  if (!apiKey) return null;

  const localityLine = [address.city, address.state, address.zip].filter(Boolean).join(" ");
  const response = await fetch(
    `https://addressvalidation.googleapis.com/v1:validateAddress?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: {
          regionCode: "US",
          addressLines: [address.address, localityLine].filter(Boolean),
        },
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) throw new Error(`Google address validation failed: ${response.status}`);

  const payload = (await response.json()) as GoogleValidationResponse;
  const validated = payload.result?.address;
  const postal = validated?.postalAddress;
  if (!validated && !postal) return null;

  return {
    // Keep the selected/manual street line stable; use Google for structured locality fields.
    address: address.address,
    city: postal?.locality || address.city,
    state: postal?.administrativeArea || address.state,
    zip: postal?.postalCode || address.zip,
  };
}
