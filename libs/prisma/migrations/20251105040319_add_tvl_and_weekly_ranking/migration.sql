-- CreateTable
CREATE TABLE "TvlSnapshot" (
    "id" SERIAL NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "tvl" DECIMAL(65,30) NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TvlSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyCompoundRanking" (
    "id" SERIAL NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "userAddress" TEXT NOT NULL,
    "compoundCount" INTEGER NOT NULL DEFAULT 0,
    "totalCompounded" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "rank" INTEGER,

    CONSTRAINT "WeeklyCompoundRanking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TvlSnapshot_contractAddress_timestamp_idx" ON "TvlSnapshot"("contractAddress", "timestamp");

-- CreateIndex
CREATE INDEX "TvlSnapshot_timestamp_idx" ON "TvlSnapshot"("timestamp");

-- CreateIndex
CREATE INDEX "WeeklyCompoundRanking_weekStart_rank_idx" ON "WeeklyCompoundRanking"("weekStart", "rank");

-- CreateIndex
CREATE INDEX "WeeklyCompoundRanking_userAddress_idx" ON "WeeklyCompoundRanking"("userAddress");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyCompoundRanking_weekStart_userAddress_key" ON "WeeklyCompoundRanking"("weekStart", "userAddress");

-- AddForeignKey
ALTER TABLE "WeeklyCompoundRanking" ADD CONSTRAINT "WeeklyCompoundRanking_userAddress_fkey" FOREIGN KEY ("userAddress") REFERENCES "User"("address") ON DELETE CASCADE ON UPDATE CASCADE;
