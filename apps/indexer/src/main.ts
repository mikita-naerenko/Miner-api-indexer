import { NestFactory } from '@nestjs/core';
import { IndexerModule } from './indexer.module';

async function bootstrap() {
  const app = await NestFactory.create(IndexerModule);
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`📡 Indexer service is running on http://localhost:${port}`);
}
void bootstrap();
