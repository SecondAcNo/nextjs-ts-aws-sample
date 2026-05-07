import { prisma } from "./shared/database/prisma";

async function main(): Promise<void> {
  const email = process.env.COGNITO_TEST_ADMIN_EMAIL?.trim();
  const cognitoSub = process.env.COGNITO_TEST_ADMIN_SUB?.trim();

  if (!email || !cognitoSub) {
    throw new Error(
      "COGNITO_TEST_ADMIN_EMAIL and COGNITO_TEST_ADMIN_SUB must be set.",
    );
  }

  const user = await prisma.user.upsert({
    where: {
      email,
    },
    update: {
      cognitoSub,
      name: "Cognito Admin User",
      role: "admin",
    },
    create: {
      cognitoSub,
      email,
      name: "Cognito Admin User",
      role: "admin",
    },
  });

  console.log("Linked Cognito test admin user:");
  console.log(`- id: ${user.id}`);
  console.log(`- role: ${user.role}`);
  console.log("- email: configured by COGNITO_TEST_ADMIN_EMAIL");
  console.log("- cognitoSub: configured by COGNITO_TEST_ADMIN_SUB");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
