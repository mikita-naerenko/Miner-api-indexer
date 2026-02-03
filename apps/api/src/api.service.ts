import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@app/prisma';
import { ConfigService } from '@nestjs/config';

export interface LeaderboardEntry {
  rank: number;
  address: string;
  totalDeposited: string;
  totalWithdrawn: string;
  totalCompounded: string;
  totalCompoundCount: number;
  referralEarningsUnits: string;
  lastActiveAt: Date | null;
}

export interface UserReferral {
  referee: string;
  totalUnitsRewarded: string;
  lastRewardAt: Date | null;
  totalRewards: number;
  buyAmount: string;
}

export interface TvlDataPoint {
  timestamp: Date;
  tvl: string;
}

@Injectable()
export class ApiService {
  private readonly logger = new Logger(ApiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getLeaderboard(
    limit: number = 100,
    offset: number = 0,
  ): Promise<LeaderboardEntry[]> {
    const users = await this.prisma.user.findMany({
      orderBy: [{ totalDeposited: 'desc' }, { address: 'asc' }],
      take: limit,
      skip: offset,
      select: this.leaderboardSelect,
    });

    return users.map((user, index) => ({
      rank: offset + index + 1,
      address: user.address,
      totalDeposited: user.totalDeposited.toString(),
      totalWithdrawn: user.totalWithdrawn.toString(),
      totalCompounded: user.totalCompounded.toString(),
      totalCompoundCount: user.totalCompoundCount,
      referralEarningsUnits: user.referralEarningsUnits.toString(),
      lastActiveAt: user.lastActiveAt,
    }));
  }

  async getUserLeaderboardData(
    address: string,
  ): Promise<LeaderboardEntry | null> {
    const user = await this.prisma.user.findUnique({
      where: { address },
      select: this.leaderboardSelect,
    });

    if (!user) {
      return null;
    }

    const higherRankedUsers = await this.prisma.user.count({
      where: {
        OR: [
          { totalDeposited: { gt: user.totalDeposited } },
          {
            totalDeposited: { equals: user.totalDeposited },
            address: { lt: user.address },
          },
        ],
      },
    });

    return {
      rank: higherRankedUsers + 1,
      address: user.address,
      totalDeposited: user.totalDeposited.toString(),
      totalWithdrawn: user.totalWithdrawn.toString(),
      totalCompounded: user.totalCompounded.toString(),
      totalCompoundCount: user.totalCompoundCount,
      referralEarningsUnits: user.referralEarningsUnits.toString(),
      lastActiveAt: user.lastActiveAt,
    };
  }

  async getUserReferrals(address: string): Promise<UserReferral[]> {
    const referrals = await this.prisma.referral.findMany({
      where: { referrer: address },
      include: {
        refereeUser: {
          select: {
            address: true,
          },
        },
      },
      orderBy: { totalUnitsRewarded: 'desc' },
    });

    // Retrieve reward counts for each referee
    const referralRewardCounts = await this.prisma.referralReward.groupBy({
      by: ['referee'],
      where: { referrer: address },
      _count: {
        id: true,
      },
    });

    const rewardCountMap = new Map(
      referralRewardCounts.map((r) => [r.referee, r._count.id]),
    );

    return referrals.map((ref) => ({
      referee: ref.referee,
      totalUnitsRewarded: ref.totalUnitsRewarded.toString(),
      lastRewardAt: ref.lastRewardAt,
      totalRewards: rewardCountMap.get(ref.referee) || 0,
      buyAmount: ref.buyAmount.toString(),
    }));
  }

  async getTvlChart(
    from?: Date,
    to?: Date,
    limit: number = 1000,
  ): Promise<TvlDataPoint[]> {
    const contractAddress = this.config.getOrThrow<string>(
      'TEST_MINER_CONTRACT',
    );

    const where: any = {
      contractAddress,
    };

    if (from || to) {
      where.timestamp = {};
      if (from) {
        where.timestamp.gte = from;
      }
      if (to) {
        where.timestamp.lte = to;
      }
    }

    const snapshots = await this.prisma.tvlSnapshot.findMany({
      where,
      orderBy: { timestamp: 'asc' },
      take: limit,
      select: {
        timestamp: true,
        tvl: true,
      },
    });

    const result: TvlDataPoint[] = snapshots.map((snapshot) => ({
      timestamp: snapshot.timestamp,
      tvl: String(snapshot.tvl),
    }));
    return result;
  }

  async getTotalValueLocked(): Promise<{ totalDeposited: string }> {
    const contractAddress = this.config.getOrThrow<string>(
      'TEST_MINER_CONTRACT',
    );

    const tvl = await this.prisma.totalValueLocked.findUnique({
      where: { contractAddress },
      select: { totalDeposited: true },
    });

    return {
      totalDeposited: tvl?.totalDeposited.toString() || '0',
    };
  }

  private readonly leaderboardSelect = {
    address: true,
    totalDeposited: true,
    totalWithdrawn: true,
    totalCompounded: true,
    totalCompoundCount: true,
    referralEarningsUnits: true,
    lastActiveAt: true,
  } as const;

}
