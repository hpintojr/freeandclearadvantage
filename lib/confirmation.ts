import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed, stateless confirmation tokens for the post-booking results page.
 *
 * The token carries only non-sensitive appointment timing plus a signature, so
 * the ICS route can serve a calendar file without a database lookup and without
 * exposing an endpoint that could be used to enumerate other people's
 * appointments. No consumer PII (name, DOB, debt, address, IP) is ever encoded.
 */

export const confirmationRetentionDays = 30;

export type ConfirmationClaims = {
  /** GHL appointment ID (or demo booking ID). */
  bookingId: string;
  /** Appointment start, ISO-8601 UTC. */
  startTime: string;
  /** Appointment end, ISO-8601 UTC. */
  endTime: string;
  /** Expiry, epoch seconds. */
  expiresAt: number;
};

type TokenPayload = { b: string; s: string; e: string; x: number };

const devFallbackSecret = "fca-development-only-confirmation-secret";

function signingSecret() {
  const configured =
    process.env.BOOKING_TOKEN_SECRET ||
    process.env.CRON_SECRET ||
    process.env.GHL_WEBHOOK_SECRET;
  if (configured) return configured;
  // Never fall back to a hardcoded secret in production — the caller degrades
  // gracefully (no ICS link) rather than issuing forgeable tokens.
  return process.env.NODE_ENV === "production" ? "" : devFallbackSecret;
}

export function confirmationSigningAvailable() {
  return Boolean(signingSecret());
}

function base64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64url(value: string) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function sign(payload: string, secret: string) {
  return base64url(createHmac("sha256", secret).update(payload).digest());
}

export function createConfirmationToken(claims: Omit<ConfirmationClaims, "expiresAt">) {
  const secret = signingSecret();
  if (!secret) return null;

  const expiresAt =
    Math.floor(new Date(claims.endTime).getTime() / 1000) +
    confirmationRetentionDays * 24 * 60 * 60;
  const payload: TokenPayload = {
    b: claims.bookingId,
    s: claims.startTime,
    e: claims.endTime,
    x: expiresAt,
  };
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded, secret)}`;
}

export function verifyConfirmationToken(bookingId: string, token: string): ConfirmationClaims | null {
  const secret = signingSecret();
  if (!secret || !token) return null;

  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded, secret);
  const provided = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (provided.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(provided, expectedBuffer)) return null;

  let payload: TokenPayload;
  try {
    payload = JSON.parse(fromBase64url(encoded).toString("utf8")) as TokenPayload;
  } catch {
    return null;
  }

  if (!payload?.b || !payload.s || !payload.e || !payload.x) return null;
  // The signature covers the booking ID, so a token minted for one appointment
  // cannot be replayed against another appointment's URL.
  if (payload.b !== bookingId) return null;
  if (payload.x * 1000 < Date.now()) return null;
  if (!Number.isFinite(new Date(payload.s).getTime())) return null;
  if (!Number.isFinite(new Date(payload.e).getTime())) return null;

  return { bookingId: payload.b, startTime: payload.s, endTime: payload.e, expiresAt: payload.x };
}

export function icsPathFor(bookingId: string, token: string) {
  return `/api/booking/${encodeURIComponent(bookingId)}/ics?token=${encodeURIComponent(token)}`;
}
