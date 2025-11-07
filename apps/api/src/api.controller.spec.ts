import { Test, TestingModule } from '@nestjs/testing';
import { ApiController } from './api.controller';
import { PrismaService } from '@app/prisma';
import { ConfigService } from '@nestjs/config';
import { ApiService } from './api.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('ApiController', () => {
  let apiController: ApiController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ApiController],
      providers: [
        ApiService,
        EventEmitter2,
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: ConfigService,
          useValue: {},
        },
      ],
    }).compile();

    apiController = app.get<ApiController>(ApiController);
  });

  it('should be defined', () => {
    expect(apiController).toBeDefined();
  });
});
