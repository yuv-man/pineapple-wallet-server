-- CreateEnum
CREATE TYPE "LiabilityType" AS ENUM ('CREDIT_CARD', 'MORTGAGE', 'STUDENT_LOAN', 'PERSONAL_LOAN', 'AUTO_LOAN', 'HOME_EQUITY_LOAN', 'MEDICAL_DEBT', 'OTHER');

-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "addedByUserId" TEXT;

-- CreateTable
CREATE TABLE "liabilities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "LiabilityType" NOT NULL,
    "name" TEXT NOT NULL,
    "balance" DECIMAL(20,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "interestRate" DECIMAL(5,4),
    "minimumPayment" DECIMAL(20,2),
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "liabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liability_balance_history" (
    "id" TEXT NOT NULL,
    "liabilityId" TEXT NOT NULL,
    "balance" DECIMAL(20,2) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "liability_balance_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "net_worth_snapshots" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalAssets" DECIMAL(20,2) NOT NULL,
    "totalLiabilities" DECIMAL(20,2) NOT NULL,
    "netWorth" DECIMAL(20,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "snapshotDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "net_worth_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "net_worth_snapshots_userId_snapshotDate_idx" ON "net_worth_snapshots"("userId", "snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX "net_worth_snapshots_userId_snapshotDate_key" ON "net_worth_snapshots"("userId", "snapshotDate");

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_addedByUserId_fkey" FOREIGN KEY ("addedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liabilities" ADD CONSTRAINT "liabilities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liability_balance_history" ADD CONSTRAINT "liability_balance_history_liabilityId_fkey" FOREIGN KEY ("liabilityId") REFERENCES "liabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "net_worth_snapshots" ADD CONSTRAINT "net_worth_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
