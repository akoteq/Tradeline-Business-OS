import { NextResponse } from 'next/server';

// This route was used for Supabase OAuth. Invite links now go to /auth/set-password?token=...
export function GET(request: Request) {
  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/login`);
}
