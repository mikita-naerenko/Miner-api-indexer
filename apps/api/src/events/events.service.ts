import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { Observable, Subject } from 'rxjs';
import { EventPayload, isEventPayload } from './types/event-payload.dto';

@Injectable()
export class EventsService implements OnModuleInit {
  private readonly logger = new Logger(EventsService.name);
  private readonly subject = new Subject<EventPayload>();

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const client = createClient({ url: this.resolveRedisUrl() });
    await client.connect();
    await client.subscribe('events', (message) => {
      try {
        const parsed = JSON.parse(message) as unknown;
        if (isEventPayload(parsed)) {
          this.subject.next(parsed);
        } else {
          this.logger.warn('Received malformed event payload');
        }
      } catch (e) {
        this.logger.error(
          'Failed to parse event message',
          e instanceof Error ? e.stack : String(e),
        );
      }
    });

    this.logger.log('Subscribed to Redis channel: events');
  }

  streamEvents(): Observable<EventPayload> {
    return this.subject.asObservable();
  }

  private resolveRedisUrl(): string {
    const directUrl = this.configService.get<string>('EVENTS_REDIS_URL');
    if (directUrl) {
      return directUrl;
    }

    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<string>('REDIS_PORT', '6379');
    return `redis://${host}:${port}`;
  }
}
