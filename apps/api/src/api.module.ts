import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiController } from './api.controller';
import { ApiService } from './api.service';
import { PrismaModule } from '@app/prisma';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { SseGateway } from './events/sse.gateway';
import { EventsService } from './events/events.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    EventEmitterModule.forRoot(),
  ],
  controllers: [ApiController, SseGateway],
  providers: [ApiService, EventsService],
})
export class ApiModule {}
