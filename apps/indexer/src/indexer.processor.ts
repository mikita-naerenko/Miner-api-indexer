import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '@app/prisma';
import { Inject, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { ConfigService } from '@nestjs/config';
import { MINER_ABI } from './miner.abi';
import {
  Decimal,
  PrismaClientKnownRequestError,
} from '@prisma/client/runtime/library';
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
  private readonly userUpdateThrottleMs = 1000;
  private readonly lastUserUpdateAt = new Map<string, number>();

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

  /**
   * Ensures data is visible in DB by reading it back after transaction commit.
   * This guarantees that when SSE event is sent, the data is already available.
   */
  private async ensureDataVisible(address: string): Promise<void> {
    await this.prisma.user.findUnique({
      where: { address },
      select: { id: true },
    });
  }

  private scheduleUserUpdate(address: string): void {
    const key = address.toLowerCase();
    const now = Date.now();
    const last = this.lastUserUpdateAt.get(key) ?? 0;
    if (now - last < this.userUpdateThrottleMs) {
      return;
    }
    this.lastUserUpdateAt.set(key, now);
    void this.publish('user:update', { address });
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
    const paidDecimal = new Decimal(paidEth);

    // Execute all DB operations in a transaction to ensure data consistency
    await this.prisma.$transaction(async (tx) => {
      await this.ensureUser(buyer, ref, tx);
      await tx.user.update({
        where: { address: buyer },
        data: {
          totalDeposited: { increment: paidDecimal },
          lastActiveAt: new Date(),
        },
      });

      // Update buyAmount for referral if referrer exists
      if (ref && ref.toLowerCase() !== buyer.toLowerCase()) {
        // Ensure referrer exists as a User before creating Referral record
        await this.ensureUser(ref, undefined, tx);
        await tx.referral.upsert({
          where: {
            referrer_referee: { referrer: ref, referee: buyer },
          },
          update: {
            buyAmount: { increment: paidDecimal },
          },
          create: {
            referrer: ref,
            referee: buyer,
            buyAmount: paidDecimal,
          },
        });
      }

      // Update Total Value Locked (cumulative deposits)
      await tx.totalValueLocked.upsert({
        where: {
          contractAddress: this.contractAddress,
        },
        update: {
          totalDeposited: { increment: paidDecimal },
        },
        create: {
          contractAddress: this.contractAddress,
          totalDeposited: paidDecimal,
        },
      });

      // Save TVL snapshot after deposit
      await this.saveTvlSnapshotInTransaction(tx, BigInt(blockNumber));

      await this.updateLastBlockInTransaction(tx, BigInt(blockNumber));
    });

    // Ensure data is visible before publishing events
    await this.ensureDataVisible(buyer);
    this.scheduleUserUpdate(buyer);
    if (ref && ref.toLowerCase() !== buyer.toLowerCase()) {
      this.scheduleUserUpdate(ref);
    }
    await this.publish('tvl:update');
  }

  private async handleSoldUnits({
    seller,
    grossValue,
    blockNumber,
  }: IndexerEventPayloads['SoldUnits']) {
    const grossBigInt = this.ensureBigInt(grossValue, 'grossValue');
    const grossEth = ethers.formatEther(grossBigInt);

    // Execute all DB operations in a transaction to ensure data consistency
    await this.prisma.$transaction(async (tx) => {
      await this.ensureUser(seller, undefined, tx);
      await tx.user.update({
        where: { address: seller },
        data: {
          totalWithdrawn: {
            increment: new Decimal(grossEth),
          },
          totalSellCount: { increment: 1 },
          lastActiveAt: new Date(),
        },
      });

      // Save TVL snapshot after withdrawal
      await this.saveTvlSnapshotInTransaction(tx, BigInt(blockNumber));

      await this.updateLastBlockInTransaction(tx, BigInt(blockNumber));
    });

    // Ensure data is visible before publishing events
    await this.ensureDataVisible(seller);
    this.scheduleUserUpdate(seller);
    await this.publish('tvl:update');
  }

  private async handleCompoundUnits({
    user,
    unitsUsed,
    blockNumber,
  }: IndexerEventPayloads['CompoundUnits']) {
    const unitsBigInt = this.ensureBigInt(unitsUsed, 'unitsUsed');
    const unitsDecimal = this.decimalFromBigInt(unitsBigInt);

    // Execute all DB operations in a transaction to ensure data consistency
    await this.prisma.$transaction(async (tx) => {
      await this.ensureUser(user, undefined, tx);
      await tx.user.update({
        where: { address: user },
        data: {
          totalCompounded: { increment: unitsDecimal },
          totalCompoundCount: { increment: 1 },
          lastActiveAt: new Date(),
        },
      });

      await this.updateLastBlockInTransaction(tx, BigInt(blockNumber));
    });

    // Ensure data is visible before publishing events
    await this.ensureDataVisible(user);
    this.scheduleUserUpdate(user);
  }

  private async handleReferralRewarded({
    referrer,
    from,
    units,
    timestamp,
    blockNumber,
    txHash,
  }: IndexerEventPayloads['ReferralRewarded']) {
    const unitsBigInt = this.ensureBigInt(units, 'units');
    const unitsDecimal = this.decimalFromBigInt(unitsBigInt);

    // Execute all DB operations in a transaction to ensure data consistency
    await this.prisma.$transaction(async (tx) => {
      await this.ensureUser(referrer, undefined, tx);
      await this.ensureUser(from, referrer, tx);

      // Record referral reward
      await tx.referralReward.create({
        data: {
          referrer,
          referee: from,
          units: unitsDecimal,
          blockNumber,
          txHash,
          timestamp: new Date(Number(timestamp) * 1000),
        },
      });

      // Update aggregates
      await tx.user.update({
        where: { address: referrer },
        data: { referralEarningsUnits: { increment: unitsDecimal } },
      });

      await tx.referral.upsert({
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

      await this.updateLastBlockInTransaction(tx, BigInt(blockNumber));
    });

    // Ensure data is visible before publishing events
    await Promise.all([
      this.ensureDataVisible(referrer),
      this.ensureDataVisible(from),
    ]);
    this.scheduleUserUpdate(referrer);
    this.scheduleUserUpdate(from);
  }

  private async handleReferralSet({
    user,
    ref,
    blockNumber,
  }: IndexerEventPayloads['ReferralSet']) {
    // Execute all DB operations in a transaction to ensure data consistency
    await this.prisma.$transaction(async (tx) => {
      await this.ensureUser(user, ref, tx);
      await this.updateLastBlockInTransaction(tx, BigInt(blockNumber));
    });

    // Publish events only after transaction is committed
    this.scheduleUserUpdate(ref);
    this.scheduleUserUpdate(user);
  }

  private async ensureUser(
    address: string,
    referrer?: string | null,
    tx?: Prisma.TransactionClient,
  ) {
    try {
      const prisma = tx || this.prisma;
      await prisma.user.upsert({
        where: { address },
        update: {},
        create: { address, referrer: referrer || null },
      });
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return;
      }
      throw error;
    }
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

  private async updateLastBlockInTransaction(
    tx: Prisma.TransactionClient,
    blockNumber: bigint,
  ) {
    await tx.indexerState.upsert({
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
      await this.prisma.$transaction(async (tx) => {
        await this.saveTvlSnapshotInTransaction(tx, blockNumber);
      });

      await this.publish('tvl:update');
    } catch (error) {
      this.logger.error(
        `Error saving TVL snapshot: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Do not rethrow to avoid interrupting event processing
    }
  }

  private async saveTvlSnapshotInTransaction(
    tx: Prisma.TransactionClient,
    blockNumber: bigint,
  ) {
    const balance = await this.contractHttp.getBalance();
    // getBalance returns bigint in ethers v6
    const balanceBigInt =
      typeof balance === 'bigint' ? balance : BigInt(String(balance));
    const tvlEth = ethers.formatEther(balanceBigInt);
    const tvlDecimal = new Decimal(tvlEth);
    const blockValue = BigInt(blockNumber);

    const existing = await tx.tvlSnapshot.findFirst({
      where: {
        contractAddress: this.contractAddress,
        blockNumber: blockValue,
      },
    });

    if (existing) {
      if (!existing.tvl.equals(tvlDecimal)) {
        await tx.tvlSnapshot.update({
          where: { id: existing.id },
          data: {
            tvl: tvlDecimal,
            timestamp: new Date(),
          },
        });
      }
    } else {
      await tx.tvlSnapshot.create({
        data: {
          contractAddress: this.contractAddress,
          tvl: tvlDecimal,
          blockNumber: blockValue,
          timestamp: new Date(),
        },
      });
    }
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

  private decimalFromBigInt(value: bigint): Decimal {
    return new Decimal(value.toString());
  }
}
