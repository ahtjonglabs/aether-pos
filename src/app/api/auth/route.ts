// Auth route handler is in /api/auth/[...nextauth]/route.ts
// This file exists for Next.js App Router compatibility
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ message: 'Auth endpoints: /api/auth/signin, /api/auth/register' })
}
