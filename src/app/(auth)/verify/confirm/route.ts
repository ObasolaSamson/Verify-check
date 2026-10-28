import { NextResponse, type NextRequest } from "next/server";
import { confirmEmailToken } from "@/server/auth/email-verification";

// The link in the sign-up email lands here. It confirms the address, then sends the person on.
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const result = await confirmEmailToken(token);

  let destination: string;
  if (result.status === "confirmed" || result.status === "already") {
    destination = "/login?confirmed=1";
  } else if (result.status === "expired") {
    destination = `/verify?${new URLSearchParams({ email: result.email, link: "expired" })}`;
  } else {
    destination = "/verify?link=invalid";
  }

  const response = NextResponse.redirect(new URL(destination, request.nextUrl));
  // Keep the token out of caches and out of the Referer header of whatever page comes next.
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
