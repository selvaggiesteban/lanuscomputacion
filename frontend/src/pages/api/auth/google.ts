import type { APIRoute } from "astro";
import { generateToken, createSessionCookie, hashPassword } from "../../lib/auth";
import { checkRateLimit, getClientIp } from "../../lib/rate-limit";

export const GET: APIRoute = async ({ locals, request }) => {
  const db = locals.runtime.env.DB as D1Database;
  const jwtSecret = locals.runtime.env.JWT_SECRET as string;
  const clientId = locals.runtime.env.GOOGLE_CLIENT_ID as string;
  const clientSecret = locals.runtime.env.GOOGLE_CLIENT_SECRET as string;

  if (!clientId || !clientSecret) {
    return new Response(null, { status: 302, headers: { Location: "/login?error=google_not_configured" } });
  }

  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`google-auth:${ip}`, 20, 60000);
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({ error: "Demasiados intentos." }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return new Response(null, { status: 302, headers: { Location: "/login?error=google_cancelled" } });
  }

  if (!code) {
    const redirectUri = `${origin}/api/auth/google`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "consent",
    });
    return new Response(null, {
      status: 302,
      headers: { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` },
    });
  }

  try {
    const redirectUri = `${origin}/api/auth/google`;
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("Google token exchange failed:", errText);
      return new Response(null, { status: 302, headers: { Location: "/login?error=google_token_failed" } });
    }

    const tokenData = await tokenRes.json<{ id_token: string }>();

    const payload = JSON.parse(
      atob(tokenData.id_token.split(".")[1])
    ) as {
      sub: string;
      email: string;
      name: string;
      picture?: string;
    };

    const googleId = payload.sub;
    const email = payload.email;
    const name = payload.name;

    let user = await db.prepare(
      "SELECT * FROM customers WHERE google_id = ? OR email = ?"
    ).bind(googleId, email).first<{
      id: number;
      email: string;
      name: string;
      google_id: string | null;
      is_admin: number;
    }>();

    if (!user) {
      const randomPassword = await hashPassword(crypto.randomUUID());
      const result = await db.prepare(`
        INSERT INTO customers (email, name, password_hash, google_id, is_admin, is_b2b, created_at)
        VALUES (?, ?, ?, ?, 0, 0, datetime('now'))
      `).bind(email, name, randomPassword, googleId).run();

      user = {
        id: result.meta.last_row_id as number,
        email,
        name,
        google_id: googleId,
        is_admin: 0,
      };
    } else if (!user.google_id) {
      await db.prepare(
        "UPDATE customers SET google_id = ? WHERE id = ?"
      ).bind(googleId, user.id).run();
    }

    const token = await generateToken(
      { userId: user.id, email: user.email, isAdmin: user.is_admin === 1 },
      jwtSecret
    );

    const cookie = createSessionCookie(token);

    return new Response(null, {
      status: 302,
      headers: {
        Location: "/",
        "Set-Cookie": cookie,
      },
    });
  } catch (err) {
    console.error("Google OAuth error:", err);
    return new Response(null, { status: 302, headers: { Location: "/login?error=google_failed" } });
  }
};
