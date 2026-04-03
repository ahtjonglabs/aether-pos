import { NextRequest } from 'next/server';
import { seedDatabase } from '@/lib/seed';
import { getAuthUser, unauthorized } from '@/lib/get-auth';
import { safeJson } from '@/lib/safe-response';

export async function POST(request: NextRequest) {
  // Allow seed without auth when using ?force=true (for initial setup)
  const { searchParams } = new URL(request.url);
  const force = searchParams.get('force') === 'true';

  let user = null;
  if (!force) {
    user = await getAuthUser(request);
    if (!user) return unauthorized();
    if (user.role !== 'OWNER') {
      return safeJson({ error: 'Hanya pemilik yang dapat mengakses' }, 403);
    }
  }

  try {
    const result = await seedDatabase();
    return safeJson(result);
  } catch (error) {
    console.error('Seed error:', error);
    return safeJson(
      { error: 'Failed to seed database', details: String(error) },
      500
    );
  }
}
