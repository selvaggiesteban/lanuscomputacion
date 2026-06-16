// auth.ts
// Authentication helpers for Cloudflare Pages + D1

export type User = {
  id: number;
  email: string;
  name: string;
  password_hash: string | null;
  google_id: string | null;
  facebook_id: string | null;
  is_admin: number;
  is_b2b: number;
  created_at: string;
};

// Hash password using Web Crypto API (available in Workers)
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

// Generate JWT token
export async function generateToken(
  payload: { userId: number; email: string; isAdmin: boolean },
  secret: string,
  expiresInHours = 24
): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const exp = now + expiresInHours * 3600;

  const tokenPayload = {
    ...payload,
    iat: now,
    exp,
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header));
  const payloadB64 = btoa(JSON.stringify(tokenPayload));

  const signature = await crypto.subtle.sign(
    "HMAC",
    await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    ),
    encoder.encode(`${headerB64}.${payloadB64}`)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

// Verify JWT token
export async function verifyToken(
  token: string,
  secret: string
): Promise<{ userId: number; email: string; isAdmin: boolean } | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;

    const encoder = new TextEncoder();
    const signature = Uint8Array.from(atob(signatureB64), c => c.charCodeAt(0));

    const valid = await crypto.subtle.verify(
      "HMAC",
      await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
      ),
      signature,
      encoder.encode(`${headerB64}.${payloadB64}`)
    );

    if (!valid) return null;

    const payload = JSON.parse(atob(payloadB64));

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      userId: Number(payload.userId),
      email: payload.email,
      isAdmin: payload.isAdmin,
    };
  } catch {
    return null;
  }
}

// Get user from request (checks cookie)
export async function getUserFromRequest(
  request: Request,
  db: D1Database,
  jwtSecret: string
): Promise<User | null> {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/session_token=([^;]+)/);
  if (!match) return null;

  const payload = await verifyToken(match[1], jwtSecret);
  if (!payload) return null;

  const user = await db.prepare(
    "SELECT * FROM customers WHERE id = ?"
  ).bind(payload.userId).first<User>();

  return user ?? null;
}

// Create session cookie
export function createSessionCookie(token: string, maxAge = 86400): string {
  return `session_token=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

// Clear session cookie
export function clearSessionCookie(): string {
  return "session_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}

// Generate random ID
export function generateId(): string {
  return crypto.randomUUID();
}
