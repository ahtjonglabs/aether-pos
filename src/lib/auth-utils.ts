import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import type { UserRole } from './types';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  outletId: string;
}

export async function getCurrentUser(): Promise<AuthUser> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error('Unauthorized — please log in');
  }
  const user = session.user as Record<string, unknown>;
  return {
    id: session.user.id,
    name: session.user.name ?? '',
    email: session.user.email ?? '',
    role: user.role as UserRole,
    outletId: user.outletId as string,
  };
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser();
  return user;
}

export async function requireOwner(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (user.role !== 'OWNER') {
    throw new Error('Forbidden — owner access required');
  }
  return user;
}
