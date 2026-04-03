// Auth route handlers are in individual subdirectories (session, csrf, signin, etc.)
// This file provides a basic info endpoint at /api/auth
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ message: 'Auth endpoints: /api/auth/signin, /api/auth/register' })
}
