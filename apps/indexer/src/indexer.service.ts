import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type ContractEventPayload, ethers } from 'ethers';
import { MINER_ABI } from './miner.abi';
import { PrismaService } from '@app/prisma';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

type BuyUnitsEvent = {
  buyer: string;
  paid: bigint;
  unitsBought: bigint;
  fee: bigint;
  ref: string;
  timestamp: bigint;
  event: ContractEventPayload;
};

type SoldUnitsEvent = {
  seller: string;
  unitsSold: bigint;
  grossValue: bigint;
  fee: bigint;
  timestamp: bigint;
  event: ContractEventPayload;
};

type CompoundUnitsEvent = {
  user: string;
  unitsUsed: bigint;
  newProducers: bigint;
  marketBoost: bigint;
  timestamp: bigint;
  event: ContractEventPayload;
};

type ReferralRewardedEvent = {
  referrer: string;
  from: string;
  units: bigint;
  timestamp: bigint;
  event: ContractEventPayload;
};

type ReferralSetEvent = {
  user: string;
  ref: string;
  timestamp: bigint;
  event: ContractEventPayload;
};

@Injectable()
export class IndexerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IndexerService.name);
  private wsProvider!: ethers.WebSocketProvider;
  private httpProvider!: ethers.JsonRpcProvider;
  private contractWs!: ethers.Contract;
  private contractHttp!: ethers.Contract;
  private readonly trackedEvents = [
    'BuyUnits',
    'SoldUnits',
    'CompoundUnits',
    'ReferralRewarded',
    'ReferralSet',
  ];
  private wsHeartbeat?: NodeJS.Timeout;
  private readonly wsHeartbeatIntervalMs = 30000;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @InjectQueue('indexer-events')
    private readonly eventsQueue: Queue,
  ) {}

  async onModuleInit() {
    const wsUrl = this.config.getOrThrow<string>(
      'PRIVATE_NODE_BASE_SEPOLIA_WS',
    );
    const httpUrl = this.config.getOrThrow<string>(
      'PRIVATE_NODE_BASE_SEPOLIA_HTTPS',
    );
    const contractAddress = this.config.getOrThrow<string>(
      'TEST_MINER_CONTRACT',
    );

    this.wsProvider = new ethers.WebSocketProvider(wsUrl);
    this.httpProvider = new ethers.JsonRpcProvider(httpUrl);

    this.contractWs = new ethers.Contract(
      contractAddress,
      MINER_ABI,
      this.wsProvider,
    );
    this.contractHttp = new ethers.Contract(
      contractAddress,
      MINER_ABI,
      this.httpProvider,
    );

    this.logger.log(`Connected to contract: ${contractAddress}`);
    this.logger.log(`WebSocket URL: ${wsUrl}`);
    this.logger.log(`HTTP URL: ${httpUrl}`);

    // Проверка подключения WebSocket
    try {
      const blockNumber = await this.wsProvider.getBlockNumber();
      this.logger.log(
        `WebSocket connected successfully. Current block: ${blockNumber}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to connect via WebSocket: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Обработка ошибок WebSocket
    void this.wsProvider.on('error', (error) => {
      this.logger.error(
        `WebSocket error: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    });

    // Обработка закрытия WebSocket соединения
    const ws = (this.wsProvider as any)._websocket;
    if (ws) {
      this.logger.log('WebSocket connection handler attached');
      ws.on('close', () => {
        this.logger.warn(
          'WebSocket connection closed. Attempting to reconnect...',
        );
        void this.reconnectWebSocket();
      });
      ws.on('error', (error: Error) => {
        this.logger.error(`WebSocket native error: ${error.message}`);
      });
      ws.on('open', () => {
        this.logger.log('WebSocket connection opened');
      });
    } else {
      this.logger.warn('WebSocket native object not found');
    }

    await this.recoverMissedEvents();
    this.registerEventListeners();
    this.logger.log('IndexerService initialization completed');

    // Проверяем listeners через 2 секунды после инициализации
    setTimeout(() => {
      void (async () => {
        this.logger.log('Checking event listeners status...');
        const contract = this.contractWs as any;
        if (typeof contract.listenerCount === 'function') {
          try {
            const buyUnitsCount = await contract.listenerCount('BuyUnits');
            this.logger.log(`BuyUnits listeners count: ${buyUnitsCount}`);
            if (!buyUnitsCount) {
              this.logger.error('WARNING: No BuyUnits listeners registered!');
            }
          } catch (error) {
            this.logger.warn(
              `Could not determine BuyUnits listener count: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }
        } else {
          this.logger.warn('Contract does not expose listenerCount()');
        }
      })();
    }, 2000);

    this.startWebSocketHeartbeat();
  }

  private async reconnectWebSocket() {
    const maxRetries = 5;
    let retries = 0;

    this.stopWebSocketHeartbeat();

    while (retries < maxRetries) {
      try {
        await new Promise((resolve) =>
          setTimeout(resolve, 5000 * (retries + 1)),
        );

        const wsUrl = this.config.getOrThrow<string>(
          'PRIVATE_NODE_BASE_SEPOLIA_WS',
        );
        const contractAddress = this.config.getOrThrow<string>(
          'TEST_MINER_CONTRACT',
        );

        this.wsProvider = new ethers.WebSocketProvider(wsUrl);
        this.contractWs = new ethers.Contract(
          contractAddress,
          MINER_ABI,
          this.wsProvider,
        );

        void this.wsProvider.on('error', (error) => {
          this.logger.error(
            `WebSocket error after reconnect: ${error instanceof Error ? error.message : String(error)}`,
            error instanceof Error ? error.stack : undefined,
          );
        });

        const newWs = (this.wsProvider as any)._websocket;
        if (newWs) {
          newWs.on('close', () => {
            this.logger.warn(
              'WebSocket connection closed again. Will retry...',
            );
            void this.reconnectWebSocket();
          });
        }

        this.logger.log('WebSocket reconnected successfully');
        this.registerEventListeners();
        this.startWebSocketHeartbeat();
        return;
      } catch (error) {
        retries++;
        this.logger.error(
          `Reconnection attempt ${retries}/${maxRetries} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    this.logger.error('Failed to reconnect WebSocket after maximum retries');
  }

  private registerEventListeners() {
    this.logger.log('Registering event listeners...');

    // Обработка ошибок для каждого listener
    const handleListenerError = (eventName: string, error: unknown) => {
      this.logger.error(
        `Error in ${eventName} listener: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    };

    // BuyUnits listener
    try {
      this.logger.log('Registering BuyUnits listener...');
      void this.contractWs
        .on(
          'BuyUnits',
          (
            buyer: BuyUnitsEvent['buyer'],
            paid: BuyUnitsEvent['paid'],
            unitsBought: BuyUnitsEvent['unitsBought'],
            _fee: BuyUnitsEvent['fee'],
            ref: BuyUnitsEvent['ref'],
            _timestamp: BuyUnitsEvent['timestamp'],
            event: BuyUnitsEvent['event'],
          ) => {
            const blockNumber = this.extractBlockNumber(event);
            this.logger.log(
              `[BuyUnits Event] buyer=${buyer}, paid=${paid.toString()}, units=${unitsBought.toString()}, ref=${ref}, block=${blockNumber}`,
            );
            void this.eventsQueue
              .add('BuyUnits', {
                buyer,
                paid: paid.toString(),
                ref,
                blockNumber,
              })
              .then(() => {
                this.logger.log(`BuyUnits event added to queue for ${buyer}`);
              })
              .catch((error) => {
                this.logger.error(
                  `Error adding BuyUnits to queue: ${error instanceof Error ? error.message : String(error)}`,
                );
              });
          },
        )
        .catch((error) => {
          this.logger.error(
            `Failed to register BuyUnits listener: ${error instanceof Error ? error.message : String(error)}`,
          );
          handleListenerError('BuyUnits', error);
        });
      this.logger.log('BuyUnits listener registered successfully');
    } catch (error) {
      this.logger.error(
        `Exception while registering BuyUnits listener: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    void this.contractWs
      .on(
        'SoldUnits',
        (
          seller: SoldUnitsEvent['seller'],
          unitsSold: SoldUnitsEvent['unitsSold'],
          grossValue: SoldUnitsEvent['grossValue'],
          fee: SoldUnitsEvent['fee'],
          timestamp: SoldUnitsEvent['timestamp'],
          event: SoldUnitsEvent['event'],
        ) => {
          const blockNumber = this.extractBlockNumber(event);
          this.logger.log(
            `SoldUnits: ${seller}, gross=${grossValue}, block=${blockNumber}`,
          );

          void this.eventsQueue
            .add('SoldUnits', {
              seller,
              unitsSold: unitsSold.toString(),
              grossValue: grossValue.toString(),
              fee: fee.toString(),
              timestamp: Number(timestamp),
              blockNumber,
            })
            .catch((error) => {
              this.logger.error(
                `Error adding SoldUnits to queue: ${error instanceof Error ? error.message : String(error)}`,
              );
            });
        },
      )
      .catch((error) => handleListenerError('SoldUnits', error));

    void this.contractWs
      .on(
        'CompoundUnits',
        (
          user: CompoundUnitsEvent['user'],
          unitsUsed: CompoundUnitsEvent['unitsUsed'],
          newProducers: CompoundUnitsEvent['newProducers'],
          marketBoost: CompoundUnitsEvent['marketBoost'],
          timestamp: CompoundUnitsEvent['timestamp'],
          event: CompoundUnitsEvent['event'],
        ) => {
          const blockNumber = this.extractBlockNumber(event);
          this.logger.log(
            `CompoundUnits: ${user}, producers=${newProducers}, block=${blockNumber}`,
          );

          void this.eventsQueue
            .add('CompoundUnits', {
              user,
              unitsUsed: unitsUsed.toString(),
              newProducers: newProducers.toString(),
              marketBoost: marketBoost.toString(),
              timestamp: Number(timestamp),
              blockNumber,
            })
            .catch((error) => {
              this.logger.error(
                `Error adding CompoundUnits to queue: ${error instanceof Error ? error.message : String(error)}`,
              );
            });
        },
      )
      .catch((error) => handleListenerError('CompoundUnits', error));

    void this.contractWs
      .on(
        'ReferralRewarded',
        (
          referrer: ReferralRewardedEvent['referrer'],
          from: ReferralRewardedEvent['from'],
          units: ReferralRewardedEvent['units'],
          timestamp: ReferralRewardedEvent['timestamp'],
          event: ReferralRewardedEvent['event'],
        ) => {
          const blockNumber = this.extractBlockNumber(event);
          const txHash = this.extractTransactionHash(event);
          this.logger.log(
            `ReferralRewarded: ${from} -> ${referrer} (${units}) block=${blockNumber}`,
          );
          void this.eventsQueue
            .add('ReferralRewarded', {
              referrer,
              from,
              units: units.toString(),
              timestamp: Number(timestamp),
              txHash: txHash,
              blockNumber,
            })
            .catch((error) => {
              this.logger.error(
                `Error adding ReferralRewarded to queue: ${error instanceof Error ? error.message : String(error)}`,
              );
            });
        },
      )
      .catch((error) => handleListenerError('ReferralRewarded', error));

    void this.contractWs
      .on(
        'ReferralSet',
        (
          user: ReferralSetEvent['user'],
          ref: ReferralSetEvent['ref'],
          timestamp: ReferralSetEvent['timestamp'],
          event: ReferralSetEvent['event'],
        ) => {
          const blockNumber = this.extractBlockNumber(event);
          this.logger.log(
            `ReferralSet: ${user} referred by ${ref} block=${blockNumber}`,
          );
          void this.eventsQueue
            .add('ReferralSet', {
              user,
              ref,
              timestamp: Number(timestamp),
              blockNumber,
            })
            .catch((error) => {
              this.logger.error(
                `Error adding ReferralSet to queue: ${error instanceof Error ? error.message : String(error)}`,
              );
            });
        },
      )
      .catch((error) => handleListenerError('ReferralSet', error));
  }

  private async recoverMissedEvents() {
    try {
      const contractAddress = await this.contractHttp.getAddress();
      const state = await this.prisma.indexerState.findUnique({
        where: { contractAddress },
      });

      const latest = await this.httpProvider.getBlockNumber();
      const from = state ? Number(state.lastBlock) + 1 : latest - 1000;
      const to = latest;

      if (from > to) {
        this.logger.log('No missed events to recover');
        return;
      }

      this.logger.log(`Recovering events ${from} → ${to}`);

      for (const eventName of this.trackedEvents) {
        try {
          const logs = await this.contractHttp.queryFilter(eventName, from, to);
          this.logger.log(`Found ${logs.length} ${eventName} events`);

          for (const log of logs) {
            if (log instanceof ethers.EventLog) {
              await this.storeEvent(log, eventName);
            }
          }
          // Rate limiting между запросами
          await new Promise((r) => setTimeout(r, 1000));
        } catch (error) {
          this.logger.error(
            `Error querying ${eventName} events: ${error instanceof Error ? error.message : String(error)}`,
          );
          // Продолжаем обработку других событий
        }
      }

      await this.updateLastBlock(BigInt(to));
    } catch (error) {
      this.logger.error(
        `Error in recoverMissedEvents: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  private async storeEvent(log: ethers.EventLog, eventName: string) {
    try {
      const fragment = log.fragment;
      if (!fragment) {
        this.logger.warn(`Cannot parse event fragment for ${eventName}`);
        return;
      }

      const args = log.args;
      const blockNumber = this.extractBlockNumber(log);
      const transactionHash = this.extractTransactionHash(log);

      switch (eventName) {
        case 'BuyUnits': {
          const buyer = args[0] as string;
          const paid = args[1] as bigint;
          const ref = args[4] as string;
          await this.eventsQueue.add('BuyUnits', {
            buyer,
            paid: paid.toString(),
            ref,
            blockNumber,
          });
          break;
        }

        case 'SoldUnits': {
          const seller = args[0] as string;
          const unitsSold = args[1] as bigint;
          const grossValue = args[2] as bigint;
          const fee = args[3] as bigint;
          const timestamp = args[4] as bigint;
          await this.eventsQueue.add('SoldUnits', {
            seller,
            unitsSold: unitsSold.toString(),
            grossValue: grossValue.toString(),
            fee: fee.toString(),
            timestamp: Number(timestamp),
            blockNumber,
          });
          break;
        }

        case 'CompoundUnits': {
          const user = args[0] as string;
          const unitsUsed = args[1] as bigint;
          const newProducers = args[2] as bigint;
          const marketBoost = args[3] as bigint;
          const timestamp = args[4] as bigint;
          await this.eventsQueue.add('CompoundUnits', {
            user,
            unitsUsed: unitsUsed.toString(),
            newProducers: newProducers.toString(),
            marketBoost: marketBoost.toString(),
            timestamp: Number(timestamp),
            blockNumber,
          });
          break;
        }

        case 'ReferralRewarded': {
          const referrer = args[0] as string;
          const from = args[1] as string;
          const units = args[2] as bigint;
          const timestamp = args[3] as bigint;
          if (!transactionHash) {
            this.logger.warn(
              'Skipping ReferralRewarded during recovery: transactionHash undefined',
            );
            return;
          }
          await this.eventsQueue.add('ReferralRewarded', {
            referrer,
            from,
            units: units.toString(),
            timestamp: Number(timestamp),
            txHash: transactionHash,
            blockNumber,
          });
          break;
        }

        case 'ReferralSet': {
          const user = args[0] as string;
          const ref = args[1] as string;
          const timestamp = args[2] as bigint;
          await this.eventsQueue.add('ReferralSet', {
            user,
            ref,
            timestamp: Number(timestamp),
            blockNumber,
          });
          break;
        }

        default:
          this.logger.warn(`Unhandled event type: ${eventName}`);
      }
    } catch (error) {
      this.logger.error(
        `Error storing event ${eventName} (tx: ${log.transactionHash}): ${error instanceof Error ? error.message : String(error)}`,
      );
      // Не выбрасываем ошибку, чтобы не прервать обработку других событий
    }
  }

  private async updateLastBlock(block: bigint) {
    const addr = await this.contractHttp.getAddress();
    await this.prisma.indexerState.upsert({
      where: { contractAddress: addr },
      update: { lastBlock: block },
      create: { contractAddress: addr, lastBlock: block },
    });
  }

  private extractBlockNumber(event: unknown): number | undefined {
    const payload = event as {
      blockNumber?: number | bigint;
      log?: { blockNumber?: number | bigint };
    };
    const value = payload?.log?.blockNumber ?? payload?.blockNumber;
    if (value === undefined || value === null) {
      return undefined;
    }
    return typeof value === 'bigint' ? Number(value) : value;
  }

  private extractTransactionHash(event: unknown): string | undefined {
    const payload = event as {
      transactionHash?: string;
      log?: { transactionHash?: string };
    };
    return payload?.transactionHash ?? payload?.log?.transactionHash;
  }

  async syncHistory(from: number, to: number) {
    for (const e of this.trackedEvents) {
      const events = await this.contractHttp.queryFilter(e, from, to);
      for (const ev of events) {
        this.logger.log(`Historical ${e} block ${ev.blockNumber}`);
      }
    }
  }

  async onModuleDestroy() {
    if (this.contractWs) {
      this.logger.log('Closing WebSocket connection...');
      await this.contractWs.destroy();
    }
    this.stopWebSocketHeartbeat();
  }

  private startWebSocketHeartbeat() {
    if (this.wsHeartbeat) {
      clearInterval(this.wsHeartbeat);
    }
    this.wsHeartbeat = setInterval(() => {
      void this.runWebSocketHeartbeat();
    }, this.wsHeartbeatIntervalMs);
  }

  private stopWebSocketHeartbeat() {
    if (this.wsHeartbeat) {
      clearInterval(this.wsHeartbeat);
      this.wsHeartbeat = undefined;
    }
  }

  private async runWebSocketHeartbeat() {
    try {
      let timeoutId: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('WebSocket heartbeat timeout')),
          this.wsHeartbeatIntervalMs - 1000,
        );
      });

      await Promise.race([this.wsProvider.getBlockNumber(), timeoutPromise]);

      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      this.logger.debug('WebSocket heartbeat successful');
    } catch (error) {
      this.logger.warn(
        `WebSocket heartbeat failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.stopWebSocketHeartbeat();
      void this.reconnectWebSocket();
    }
  }
}
