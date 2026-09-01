import "reflect-metadata";
import { fileURLToPath } from "node:url";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import dotenv from "dotenv";

dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

async function bootstrap(): Promise<void> {
  const { AppModule } = await import("./app.module.js");
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));
  const origins = process.env.CORS_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean) ?? ["http://localhost:5173"];
  app.enableCors({ origin: origins, credentials: true });
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
}

void bootstrap();
