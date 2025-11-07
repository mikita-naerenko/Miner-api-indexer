import { Controller, Sse, MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { EventsService } from './events.service';
import {
  ApiTags,
  ApiOperation,
  ApiProduces,
  ApiOkResponse,
} from '@nestjs/swagger';
import { EventPayload } from './types/event-payload.dto';

@ApiTags('Events')
@Controller('events')
export class SseGateway {
  constructor(private readonly eventsService: EventsService) {}

  @Sse()
  @ApiOperation({ summary: 'Получить поток сервер-сайд событий' })
  @ApiProduces('text/event-stream')
  @ApiOkResponse({
    description: 'Поток событий в формате Server-Sent Events',
    type: EventPayload,
    isArray: false,
  })
  stream(): Observable<MessageEvent> {
    return this.eventsService.streamEvents().pipe(
      map((payload) => ({
        type: payload.type,
        data: payload.data,
      })),
    );
  }
}
