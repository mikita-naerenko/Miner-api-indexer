import { Controller, Get } from '@nestjs/common';
import { IndexerService } from './indexer.service';

@Controller()
export class IndexerController {
  constructor(private readonly indexerService: IndexerService) {}

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'indexer',
      timestamp: new Date().toISOString(),
    };
  }
}
