"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_COOKIE, accessToken } from "@/lib/access";

export async function submitAccessCode(_prev: string | null, form: FormData): Promise<string | null> {
  const expected = process.env.ACCESS_CODE;
  const code = String(form.get("code") ?? "").trim();
  const next = String(form.get("next") ?? "/");
  if (expected && code !== expected) {
    await new Promise((r) => setTimeout(r, 800)); // Brute-Force bremsen
    return "Falscher Zugangscode.";
  }
  (await cookies()).set(ACCESS_COOKIE, await accessToken(code), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}
