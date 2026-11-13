-- CreateEnum
CREATE TYPE "CancellationRequestStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentStatus" ADD VALUE 'REFUND_PENDING';
ALTER TYPE "PaymentStatus" ADD VALUE 'REFUNDED';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancellationRequestStatus" "CancellationRequestStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "cancellationRequestedAt" TIMESTAMP(3),
ADD COLUMN     "cancellationReviewedAt" TIMESTAMP(3),
ADD COLUMN     "cancellationReviewedBy" TEXT,
ADD COLUMN     "inventoryRestored" BOOLEAN NOT NULL DEFAULT false;
