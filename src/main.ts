import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import { ConfigService } from "@nestjs/config";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Get environment mode from ENV_MODE or default to 'dev'
  const envMode = configService.get<string>("ENV_MODE") || "dev";
  const isProduction = envMode === "prod" || envMode === "production";

  // Get frontend URL based on environment mode
  const frontendUrl = isProduction
    ? configService.get<string>("PROD_URL")
    : configService.get<string>("DEV_URL") || "http://localhost:3000";

  // CORS configuration - more restrictive in production
  app.enableCors({
    origin: frontendUrl || (isProduction ? false : true), // Allow all origins in dev, specific in prod
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      disableErrorMessages: isProduction, // Hide error details in production
    })
  );

  app.setGlobalPrefix("api");

  const port = configService.get<number>("PORT") || 5001;
  await app.listen(port);

  console.log(`🍍 Pineapple Wallet API running on http://localhost:${port}`);
  console.log(`📦 Environment Mode: ${envMode}`);
  console.log(`🔗 Frontend URL: ${frontendUrl}`);
}
bootstrap();
