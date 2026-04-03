import { NextRequest, NextResponse } from 'next/server';
import { seedDatabase } from '@/lib/seed';
import { getAuthUser, unauthorized } from '@/lib/get-auth';

export async function POST(request: NextRequest) {
  // Allow seed without auth when using ?force=true (for initial setup)
  const { searchParams } = new URL(request.url);
  const force = searchParams.get('force') === 'true';

  let user = null;
  if (!force) {
    user = await getAuthUser(request);
    if (!user) return unauthorized();
    if (user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Hanya pemilik yang dapat mengakses' }, { status: 403 });
    }
  }

  try {
    const result = await seedDatabase();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json(
      { error: 'Failed to seed database', details: String(error) },
      { status: 500 }
    );
  }
}
