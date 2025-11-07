import { Test, TestingModule } from '@nestjs/testing';
import { IndexerController } from './indexer.controller';
import { IndexerService } from './indexer.service';
import { PrismaService } from '@app/prisma';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';

describe('IndexerController', () => {
  let indexerController: IndexerController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [IndexerController],
      providers: [
        IndexerService,
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: ConfigService,
          useValue: {},
        },
        {
          provide: getQueueToken('indexer-events'),
          useValue: {},
        },
      ],
    }).compile();

    indexerController = app.get<IndexerController>(IndexerController);
  });

  it('should be defined', () => {
    expect(indexerController).toBeDefined();
  });
});
