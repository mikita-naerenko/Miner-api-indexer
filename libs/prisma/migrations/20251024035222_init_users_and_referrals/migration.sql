-- CreateTable
CREATE TABLE "IndexerState" (
    "id" SERIAL NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "lastBlock" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndexerState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "address" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3),
    "referrer" TEXT,
    "totalDeposited" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalWithdrawn" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalCompounded" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalCompoundCount" INTEGER NOT NULL DEFAULT 0,
    "totalSellCount" INTEGER NOT NULL DEFAULT 0,
    "referralEarningsUnits" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" SERIAL NOT NULL,
    "referrer" TEXT NOT NULL,
    "referee" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalUnitsRewarded" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lastRewardAt" TIMESTAMP(3),

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralReward" (
    "id" BIGSERIAL NOT NULL,
    "referrer" TEXT NOT NULL,
    "referee" TEXT NOT NULL,
    "units" DECIMAL(65,30) NOT NULL,
    "blockNumber" BIGINT,
    "txHash" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralReward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IndexerState_contractAddress_key" ON "IndexerState"("contractAddress");

-- CreateIndex
CREATE UNIQUE INDEX "User_address_key" ON "User"("address");

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrer_fkey" FOREIGN KEY ("referrer") REFERENCES "User"("address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referee_fkey" FOREIGN KEY ("referee") REFERENCES "User"("address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_referrer_fkey" FOREIGN KEY ("referrer") REFERENCES "User"("address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_referee_fkey" FOREIGN KEY ("referee") REFERENCES "User"("address") ON DELETE CASCADE ON UPDATE CASCADE;
