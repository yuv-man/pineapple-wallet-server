import { PrismaClient, CategoryType } from '@prisma/client';

const prisma = new PrismaClient();

const EXPENSE_CATEGORIES = [
  'Design',
  'Build',
  'Lawyer',
  'Maintenance',
  'Taxes',
  'Insurance',
  'Management Fees',
];

const PROFIT_CATEGORIES = ['Rent', 'Sale', 'Other Income'];

async function main() {
  console.log('Seeding predefined property categories...');

  // Create expense categories
  for (const name of EXPENSE_CATEGORIES) {
    // Check if category already exists
    const existing = await prisma.propertyCategory.findFirst({
      where: {
        name,
        type: CategoryType.EXPENSE,
        isSystem: true,
      },
    });

    if (!existing) {
      await prisma.propertyCategory.create({
        data: {
          name,
          type: CategoryType.EXPENSE,
          isSystem: true,
          userId: null,
        },
      });
      console.log(`  Created expense category: ${name}`);
    } else {
      console.log(`  Expense category already exists: ${name}`);
    }
  }

  // Create profit categories
  for (const name of PROFIT_CATEGORIES) {
    // Check if category already exists
    const existing = await prisma.propertyCategory.findFirst({
      where: {
        name,
        type: CategoryType.PROFIT,
        isSystem: true,
      },
    });

    if (!existing) {
      await prisma.propertyCategory.create({
        data: {
          name,
          type: CategoryType.PROFIT,
          isSystem: true,
          userId: null,
        },
      });
      console.log(`  Created profit category: ${name}`);
    } else {
      console.log(`  Profit category already exists: ${name}`);
    }
  }

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
