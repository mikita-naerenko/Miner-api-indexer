import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '@app/prisma';
import { Inject, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { ConfigService } from '@nestjs/config';
import { MINER_ABI } from './miner.abi';
import { Prisma } from '@prisma/client';
import { createClient, type RedisClientType } from 'redis';
import { REDIS_PUBLISHER } from './redis.provider';

interface IndexerEventPayloads {
  BuyUnits: {
    buyer: string;
    paid: string;
    ref: string;
    blockNumber: number;
  };

  SoldUnits: {
    seller: string;
    unitsSold: string;
    grossValue: string;
    fee: string;
    timestamp: number;
    blockNumber: number;
  };

  CompoundUnits: {
    user: string;
    unitsUsed: string;
    newProducers: string;
    marketBoost: string;
    timestamp: number;
    blockNumber: number;
  };

  ReferralRewarded: {
    referrer: string;
    from: string;
    units: string;
    timestamp: number;
    blockNumber: number;
    txHash: string;
  };

  ReferralSet: {
    user: string;
    ref: string;
    timestamp: number;
    blockNumber: number;
  };
}

type IndexerJobName = keyof IndexerEventPayloads;
type IndexerJob<T extends IndexerJobName = IndexerJobName> = Job<
  IndexerEventPayloads[T],
  void,
  T
>;

@Processor('indexer-events', { concurrency: 5 })
export class IndexerProcessor extends WorkerHost {
  private readonly logger = new Logger(IndexerProcessor.name);
  private readonly contractAddress: string;
  private readonly httpProvider: ethers.JsonRpcProvider;
  private readonly contractHttp: ethers.Contract;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(REDIS_PUBLISHER)
    private readonly redisPub: RedisClientType,
  ) {
    super();
    this.contractAddress = this.configService.getOrThrow('TEST_MINER_CONTRACT');
    const httpUrl = this.configService.getOrThrow<string>(
      'PRIVATE_NODE_BASE_SEPOLIA_HTTPS',
    );
    this.httpProvider = new ethers.JsonRpcProvider(httpUrl);
    this.contractHttp = new ethers.Contract(
      this.contractAddress,
      MINER_ABI,
      this.httpProvider,
    );
    this.logger.log(
      `IndexerProcessor initialized for contract: ${this.contractAddress}`,
    );
    this.redisPub = createClient({
      url: `redis://${this.configService.getOrThrow('REDIS_HOST')}:${this.configService.getOrThrow('REDIS_PORT')}`,
    });

    void this.redisPub
      .connect()
      .then(() => this.logger.log('Redis publisher connected'));
  }

  private async publish(event: string, data?: object) {
    try {
      const payload = {
        type: event,
        data: data ?? {},
      };
      await this.redisPub.publish('events', JSON.stringify(payload));
      this.logger.debug(`Published event: ${event}`);
    } catch (err) {
      this.logger.error(
        `Redis publish error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async process(job: IndexerJob): Promise<void> {
    const { name, data } = job;

    this.logger.log(`Processing job: ${name} (id: ${job.id})`);

    try {
      switch (name) {
        case 'BuyUnits':
          this.logger.log(
            `Handling BuyUnits event for buyer: ${(data as IndexerEventPayloads['BuyUnits']).buyer}`,
          );
          await this.handleBuyUnits(data as IndexerEventPayloads['BuyUnits']);
          this.logger.log(
            `BuyUnits event processed successfully for buyer: ${(data as IndexerEventPayloads['BuyUnits']).buyer}`,
          );
          break;

        case 'SoldUnits':
          await this.handleSoldUnits(data as IndexerEventPayloads['SoldUnits']);
          break;

        case 'CompoundUnits':
          await this.handleCompoundUnits(
            data as IndexerEventPayloads['CompoundUnits'],
          );
          break;

        case 'ReferralRewarded':
          await this.handleReferralRewarded(
            data as IndexerEventPayloads['ReferralRewarded'],
          );
          break;

        case 'ReferralSet':
          await this.handleReferralSet(
            data as IndexerEventPayloads['ReferralSet'],
          );
          break;

        default:
          this.logger.warn(`Unhandled job ${name as string}`);
      }
    } catch (error) {
      this.logger.error(
        `Error processing job ${name} (id: ${job.id}): ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error; // Re-throw to let BullMQ handle retries
    }
  }

  private async handleBuyUnits({
    buyer,
    ref,
    paid,
    blockNumber,
  }: IndexerEventPayloads['BuyUnits']) {
    const paidBigInt = this.ensureBigInt(paid, 'paid');
    const paidEth = ethers.formatEther(paidBigInt);

    await this.ensureUser(buyer, ref);
    await this.prisma.user.update({
      where: { address: buyer },
      data: {
        totalDeposited: { increment: new Prisma.Decimal(paidEth) },
        lastActiveAt: new Date(),
      },
    });

    // Сохраняем TVL после депозита
    await this.saveTvlSnapshot(BigInt(blockNumber));

    await this.updateLastBlock(BigInt(blockNumber));
    await this.publish('user:update', { address: buyer });
  }

  private async handleSoldUnits({
    seller,
    grossValue,
    blockNumber,
  }: IndexerEventPayloads['SoldUnits']) {
    await this.ensureUser(seller);
    const grossBigInt = this.ensureBigInt(grossValue, 'grossValue');
    const grossEth = ethers.formatEther(grossBigInt);
    await this.prisma.user.update({
      where: { address: seller },
      data: {
        totalWithdrawn: {
          increment: new Prisma.Decimal(grossEth),
        },
        totalSellCount: { increment: 1 },
        lastActiveAt: new Date(),
      },
    });

    // Сохраняем TVL после вывода
    await this.saveTvlSnapshot(BigInt(blockNumber));

    await this.updateLastBlock(BigInt(blockNumber));
    await this.publish('user:update', { address: seller });
  }

  private async handleCompoundUnits({
    user,
    unitsUsed,
    blockNumber,
  }: IndexerEventPayloads['CompoundUnits']) {
    await this.ensureUser(user);
    const unitsBigInt = this.ensureBigInt(unitsUsed, 'unitsUsed');
    const unitsDecimal = this.decimalFromBigInt(unitsBigInt);
    await this.prisma.user.update({
      where: { address: user },
      data: {
        totalCompounded: { increment: unitsDecimal },
        totalCompoundCount: { increment: 1 },
        lastActiveAt: new Date(),
      },
    });

    // Обновляем еженедельный рейтинг компаундов
    await this.updateWeeklyCompoundRanking(user, unitsBigInt);

    await this.updateLastBlock(BigInt(blockNumber));
    await this.publish('user:update', { address: user });
  }

  private async handleReferralRewarded({
    referrer,
    from,
    units,
    timestamp,
    blockNumber,
    txHash,
  }: IndexerEventPayloads['ReferralRewarded']) {
    await this.ensureUser(referrer);
    await this.ensureUser(from, referrer);
    const unitsBigInt = this.ensureBigInt(units, 'units');
    const unitsDecimal = this.decimalFromBigInt(unitsBigInt);

    // записываем награду
    await this.prisma.referralReward.create({
      data: {
        referrer,
        referee: from,
        units: unitsDecimal,
        blockNumber,
        txHash,
        timestamp: new Date(Number(timestamp) * 1000),
      },
    });

    // обновляем агрегаты
    await this.prisma.user.update({
      where: { address: referrer },
      data: { referralEarningsUnits: { increment: unitsDecimal } },
    });

    await this.prisma.referral.upsert({
      where: {
        referrer_referee: { referrer, referee: from },
      },
      update: {
        totalUnitsRewarded: { increment: unitsDecimal },
        lastRewardAt: new Date(Number(timestamp) * 1000),
      },
      create: {
        referrer,
        referee: from,
        totalUnitsRewarded: unitsDecimal,
        lastRewardAt: new Date(Number(timestamp) * 1000),
      },
    });

    await this.updateLastBlock(BigInt(blockNumber));
    await this.publish('user:update', { address: referrer });
    await this.publish('user:update', { address: from });
  }

  private async handleReferralSet({
    user,
    ref,
    blockNumber,
  }: IndexerEventPayloads['ReferralSet']) {
    await this.ensureUser(user, ref);
    await this.updateLastBlock(BigInt(blockNumber));
    await this.publish('user:update', { address: ref });
    await this.publish('user:update', { address: user });
  }

  private async ensureUser(address: string, referrer?: string | null) {
    await this.prisma.user.upsert({
      where: { address },
      update: {},
      create: { address, referrer: referrer || null },
    });
  }

  private async updateLastBlock(blockNumber: bigint) {
    await this.prisma.indexerState.upsert({
      where: {
        contractAddress: this.contractAddress,
      },
      update: { lastBlock: BigInt(blockNumber) },
      create: {
        contractAddress: this.contractAddress,
        lastBlock: BigInt(blockNumber),
      },
    });
  }

  private async saveTvlSnapshot(blockNumber: bigint) {
    try {
      const balance = await this.contractHttp.getBalance();
      // getBalance возвращает bigint в ethers v6
      const balanceBigInt =
        typeof balance === 'bigint' ? balance : BigInt(String(balance));
      const tvlEth = ethers.formatEther(balanceBigInt);

      await this.prisma.tvlSnapshot.create({
        data: {
          contractAddress: this.contractAddress,
          tvl: new Prisma.Decimal(tvlEth),
          blockNumber,
          timestamp: new Date(),
        },
      });
      await this.publish('tvl:update');
    } catch (error) {
      this.logger.error(
        `Error saving TVL snapshot: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Не выбрасываем ошибку, чтобы не прервать обработку события
    }
  }

  private async updateWeeklyCompoundRanking(
    userAddress: string,
    unitsUsed: bigint,
  ) {
    try {
      const now = new Date();
      const weekStart = this.getWeekStart(now);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      const unitsDecimal = this.decimalFromBigInt(unitsUsed);

      await this.prisma.weeklyCompoundRanking.upsert({
        where: {
          weekStart_userAddress: {
            weekStart,
            userAddress,
          },
        },
        update: {
          compoundCount: { increment: 1 },
          totalCompounded: { increment: unitsDecimal },
        },
        create: {
          weekStart,
          weekEnd,
          userAddress,
          compoundCount: 1,
          totalCompounded: unitsDecimal,
        },
      });

      // Обновляем ранги для текущей недели после каждого компаунда
      await this.updateRanksForWeek(weekStart);
      await this.publish('weekly-compound:update', {
        weekStart: weekStart.toISOString(),
      });
    } catch (error) {
      this.logger.error(
        `Error updating weekly compound ranking: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Не выбрасываем ошибку, чтобы не прервать обработку события
    }
  }

  private async updateRanksForWeek(weekStart: Date) {
    try {
      // Получаем все записи за эту неделю, отсортированные по totalCompounded
      const rankings = await this.prisma.weeklyCompoundRanking.findMany({
        where: { weekStart },
        orderBy: { totalCompounded: 'desc' },
        select: { id: true },
      });

      // Обновляем ранги для всех записей
      const updatePromises = rankings.map((ranking, index) => {
        this.prisma.weeklyCompoundRanking.update({
          where: { id: ranking.id },
          data: { rank: index + 1 },
        });
      });

      await Promise.all(updatePromises);
    } catch (error) {
      this.logger.error(
        `Error updating ranks for week: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Не выбрасываем ошибку
    }
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getUTCDay();
    const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1); // Понедельник = 1
    const weekStart = new Date(d.setUTCDate(diff));
    weekStart.setUTCHours(0, 0, 0, 0);
    return weekStart;
  }

  private ensureBigInt(
    value: string | number | bigint | undefined,
    field: string,
  ): bigint {
    if (value === undefined || value === null) {
      throw new Error(`Value for ${field} is undefined`);
    }
    if (typeof value === 'bigint') {
      return value;
    }
    if (typeof value === 'number') {
      return BigInt(value);
    }
    if (typeof value === 'string' && value !== '') {
      return BigInt(value);
    }
    throw new Error(`Unsupported value for ${field}: ${String(value)}`);
  }

  private decimalFromBigInt(value: bigint): Prisma.Decimal {
    return new Prisma.Decimal(value.toString());
  }
}
