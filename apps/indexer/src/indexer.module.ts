import { Module } from '@nestjs/common';
import { IndexerController } from './indexer.controller';
import { IndexerService } from './indexer.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '@app/prisma';
import { BullModule } from '@nestjs/bullmq';
import { IndexerProcessor } from './indexer.processor';
import { redisProvider } from './redis.provider';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    BullModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.getOrThrow('REDIS_HOST'),
          port: config.getOrThrow<number>('REDIS_PORT'),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'indexer-events',
    }),
  ],
  controllers: [IndexerController],
  providers: [IndexerService, IndexerProcessor, redisProvider],
})
export class IndexerModule {}
