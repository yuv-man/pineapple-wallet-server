-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('APARTMENT', 'HOUSE', 'LAND', 'COMMERCIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "SizeUnit" AS ENUM ('SQM', 'SQFT');

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "estimatedValue" DECIMAL(20,2),
ADD COLUMN     "estimatedValueCurrency" TEXT,
ADD COLUMN     "estimatedValueDate" TIMESTAMP(3),
ADD COLUMN     "propertyType" "PropertyType",
ADD COLUMN     "size" DECIMAL(20,2),
ADD COLUMN     "sizeUnit" "SizeUnit",
ADD COLUMN     "valuationSource" TEXT;
