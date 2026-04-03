import { NextRequest, NextResponse } from 'next/server'
import { authAction } from '@/lib/auth-handler'

export async function POST(request: Request) {
  try {
    // Call NextAuth signout handler
    const response = await authAction(request, ['signout'])

    // Clone the response so we can add extra Set-Cookie headers
    const responseHeaders = new Headers(response.headers)

    // Ensure all next-auth cookies are cleared as a safety net
    const cookies = request.headers.get('cookie') || ''
    const cookieNames = cookies.split(';').map(c => {
      const name = c.trim().split('=')[0]
      return name.startsWith('next-auth') || name.startsWith('__Secure-next-auth') ? name : null
    }).filter(Boolean) as string[]

    for (const name of cookieNames) {
      responseHeaders.append('Set-Cookie', `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax`)
    }

    // Return JSON redirect info for the client
    return NextResponse.json(
      { url: '/' },
      {
        status: 200,
        headers: responseHeaders,
      }
    )
  } catch (error) {
    console.error('Signout error:', error)
    // Even on error, clear cookies and return success
    const response = NextResponse.json({ url: '/' }, { status: 200 })

    const cookies = request.headers.get('cookie') || ''
    const cookieNames = cookies.split(';').map(c => {
      const name = c.trim().split('=')[0]
      return name.startsWith('next-auth') || name.startsWith('__Secure-next-auth') ? name : null
    }).filter(Boolean) as string[]

    for (const name of cookieNames) {
      response.headers.append('Set-Cookie', `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax`)
    }

    return response
  }
}
