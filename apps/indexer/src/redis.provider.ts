import { Provider } from '@nestjs/common';
import { createClient } from 'redis';

export const REDIS_PUBLISHER = 'REDIS_PUBLISHER';

export const redisProvider: Provider = {
  provide: REDIS_PUBLISHER,
  useFactory: async () => {
    const client = createClient({
      url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
    });
    await client.connect();
    return client;
  },
};
