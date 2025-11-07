import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ApiService } from './api.service';
import { PrismaService } from '@app/prisma';
import { Prisma } from '@prisma/client';

const createDecimal = (value: number | string) => new Prisma.Decimal(value);

type PrismaServiceMock = {
  user: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    count: jest.Mock;
  };
  referral: {
    findMany: jest.Mock;
  };
  referralReward: {
    groupBy: jest.Mock;
  };
  weeklyCompoundRanking: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
  };
  tvlSnapshot: {
    findMany: jest.Mock;
  };
  $executeRaw: jest.Mock;
};

describe('ApiService', () => {
  let service: ApiService;
  let prisma: PrismaServiceMock;

  beforeEach(async () => {
    prisma = {
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
      },
      referral: {
        findMany: jest.fn(),
      },
      referralReward: {
        groupBy: jest.fn(),
      },
      weeklyCompoundRanking: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      tvlSnapshot: {
        findMany: jest.fn(),
      },
      $executeRaw: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ApiService,
        {
          provide: PrismaService,
          useValue: prisma as unknown as PrismaService,
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('0xcontract'),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(ApiService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns paginated leaderboard with deterministic ranks', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        address: '0x1',
        totalDeposited: createDecimal(10),
        totalWithdrawn: createDecimal(1),
        totalCompounded: createDecimal(5),
        totalCompoundCount: 2,
        referralEarningsUnits: createDecimal(0),
        lastActiveAt: null,
      },
    ]);

    const result = await service.getLeaderboard(1, 5);

    const leaderboardQuery = prisma.user.findMany.mock.calls[0]?.[0];
    expect(leaderboardQuery).toMatchObject({
      orderBy: [{ totalDeposited: 'desc' }, { address: 'asc' }],
      take: 1,
      skip: 5,
    });
    expect(result).toEqual([
      {
        rank: 6,
        address: '0x1',
        totalDeposited: '10',
        totalWithdrawn: '1',
        totalCompounded: '5',
        totalCompoundCount: 2,
        referralEarningsUnits: '0',
        lastActiveAt: null,
      },
    ]);
  });

  it('calculates user leaderboard rank without loading entire dataset', async () => {
    prisma.user.findUnique.mockResolvedValue({
      address: '0xabc',
      totalDeposited: createDecimal(100),
      totalWithdrawn: createDecimal(10),
      totalCompounded: createDecimal(50),
      totalCompoundCount: 4,
      referralEarningsUnits: createDecimal(5),
      lastActiveAt: new Date('2024-01-01T00:00:00Z'),
    });
    prisma.user.count.mockResolvedValue(3);

    const result = await service.getUserLeaderboardData('0xabc');

    const findUniqueArgs = prisma.user.findUnique.mock.calls[0]?.[0];
    expect(findUniqueArgs).toMatchObject({ where: { address: '0xabc' } });
    const countArgs = prisma.user.count.mock.calls[0]?.[0];
    expect(countArgs?.where?.OR).toHaveLength(2);
    expect(countArgs?.where?.OR?.[0].totalDeposited.gt.toString()).toBe('100');
    const equalThreshold =
      countArgs?.where?.OR?.[1].totalDeposited.equals.toString();
    expect(equalThreshold).toBe('100');
    expect(countArgs?.where?.OR?.[1].address).toEqual({ lt: '0xabc' });
    expect(result).toMatchObject({
      rank: 4,
      address: '0xabc',
      totalDeposited: '100',
    });
  });

  it('returns weekly rankings after syncing ranks', async () => {
    prisma.$executeRaw.mockResolvedValue(2);
    prisma.weeklyCompoundRanking.findMany.mockResolvedValue([
      {
        id: 1,
        weekStart: new Date('2024-01-01T00:00:00Z'),
        weekEnd: new Date('2024-01-07T00:00:00Z'),
        userAddress: '0x1',
        compoundCount: 3,
        totalCompounded: createDecimal(30),
        rank: 1,
        user: {
          address: '0x1',
        },
      },
    ] as any);

    const result = await service.getWeeklyCompoundRanking(
      new Date('2024-01-01T00:00:00Z'),
    );

    expect(prisma.$executeRaw.mock.calls.length).toBeGreaterThan(0);
    const weeklyRankingQuery =
      prisma.weeklyCompoundRanking.findMany.mock.calls[0]?.[0];
    expect(weeklyRankingQuery).toMatchObject({
      orderBy: [
        { totalCompounded: 'desc' },
        { compoundCount: 'desc' },
        { userAddress: 'asc' },
      ],
    });
    expect(result).toEqual([
      {
        rank: 1,
        address: '0x1',
        compoundCount: 3,
        totalCompounded: '30',
      },
    ]);
  });
});
