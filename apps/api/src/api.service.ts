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
}

export interface WeeklyCompoundEntry {
  rank: number;
  address: string;
  compoundCount: number;
  totalCompounded: string;
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

    // Получаем количество наград для каждого реферала
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
    }));
  }

  async getWeeklyCompoundRanking(
    weekStart?: Date,
  ): Promise<WeeklyCompoundEntry[]> {
    // Если не указана дата, берем текущую неделю
    const targetWeekStart = weekStart || this.getWeekStart(new Date());

    // Получаем записи, отсортированные по totalCompounded (по убыванию)
    // Ранги уже обновляются в процессоре при каждом компаунде
    await this.syncWeeklyRanks(targetWeekStart);

    const rankings = await this.prisma.weeklyCompoundRanking.findMany({
      where: { weekStart: targetWeekStart },
      orderBy: [
        { totalCompounded: 'desc' },
        { compoundCount: 'desc' },
        { userAddress: 'asc' },
      ],
      include: {
        user: {
          select: {
            address: true,
          },
        },
      },
    });

    const result: WeeklyCompoundEntry[] = rankings.map((r, index) => ({
      rank: r.rank ?? index + 1,
      address: r.user.address,
      compoundCount: r.compoundCount,
      totalCompounded: String(r.totalCompounded),
    }));

    return result;
  }

  async getUserWeeklyRanking(
    address: string,
    weekStart?: Date,
  ): Promise<WeeklyCompoundEntry | null> {
    const targetWeekStart = weekStart || this.getWeekStart(new Date());

    await this.syncWeeklyRanks(targetWeekStart);

    const ranking = await this.prisma.weeklyCompoundRanking.findUnique({
      where: {
        weekStart_userAddress: {
          weekStart: targetWeekStart,
          userAddress: address,
        },
      },
      include: {
        user: {
          select: {
            address: true,
          },
        },
      },
    });

    if (!ranking) {
      return null;
    }

    return {
      rank: ranking.rank ?? 1,
      address: ranking.user.address,
      compoundCount: ranking.compoundCount,
      totalCompounded: String(ranking.totalCompounded),
    };
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

  async updateWeeklyRankings(): Promise<void> {
    // Этот метод должен вызываться еженедельно (через cron или scheduler)
    // для обновления рангов всех пользователей за прошедшую неделю
    const now = new Date();
    const weekStart = this.getWeekStart(now);

    // Получаем все записи за эту неделю
    try {
      await this.syncWeeklyRanks(weekStart);
    } catch (error) {
      this.logger.error(
        'Error updating weekly rankings',
        error instanceof Error ? error.stack : undefined,
      );
    }
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

  /**
   * Numeric metrics are kept as strings in DTOs to avoid precision loss when serializing Decimal/BigInt values.
   */
  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getUTCDay();
    const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1); // Понедельник = 1
    const weekStart = new Date(d.setUTCDate(diff));
    weekStart.setUTCHours(0, 0, 0, 0);
    return weekStart;
  }

  private async syncWeeklyRanks(weekStart: Date): Promise<void> {
    await this.prisma.$executeRaw`
      WITH ranked AS (
        SELECT
          "id",
          RANK() OVER (
            ORDER BY "totalCompounded" DESC,
                     "compoundCount" DESC,
                     "userAddress" ASC
          ) AS computed_rank
        FROM "WeeklyCompoundRanking"
        WHERE "weekStart" = ${weekStart}
      )
      UPDATE "WeeklyCompoundRanking" w
      SET "rank" = r.computed_rank
      FROM ranked r
      WHERE w."id" = r."id"
        AND (w."rank" IS DISTINCT FROM r.computed_rank);
    `;
  }
}
