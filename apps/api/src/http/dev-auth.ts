import { prisma } from "../shared/database/prisma";
import type { AuthUser } from "../shared/types/auth";

export type DevAuthenticatedUser = AuthUser & {
  email: string;
  name: string;
};

export async function getDevAuthenticatedUser(
  email: string | undefined,
): Promise<DevAuthenticatedUser | null> {
  if (!email) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!user) {
    return null;
  }

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}
