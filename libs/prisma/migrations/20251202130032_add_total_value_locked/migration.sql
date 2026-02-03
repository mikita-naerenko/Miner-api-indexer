-- CreateTable
CREATE TABLE "TotalValueLocked" (
    "id" SERIAL NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "totalDeposited" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TotalValueLocked_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TotalValueLocked_contractAddress_key" ON "TotalValueLocked"("contractAddress");

