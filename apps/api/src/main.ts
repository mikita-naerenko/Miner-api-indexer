import { NestFactory } from '@nestjs/core';
import { ApiModule } from './api.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(ApiModule);

  const config = new DocumentBuilder()
    .setTitle('DApp Backend API')
    .setDescription('REST API documentation for the blockchain event indexer')
    .setVersion('1.0.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 API server is running on http://localhost:${port}`);
  console.log(`📘 Swagger UI available at http://localhost:${port}/docs`);
}

void bootstrap();
