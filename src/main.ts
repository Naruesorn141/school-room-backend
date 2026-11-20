import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const frontendOrigin = new URL(process.env.FRONTEND_ORIGIN || 'http://localhost:5173').origin;
  app.enableCors({ origin: frontendOrigin });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
