import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: config.get<string>('FRONTEND_ORIGIN', 'http://localhost:3000'), credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => {
        const fields = errors.map((error) => {
          const constraints = error.constraints ?? {};

          if (error.property === 'email') {
            return 'Vui lòng nhập email hợp lệ.';
          }

          if (error.property === 'password') {
            if (constraints.minLength) {
              return 'Mật khẩu phải có ít nhất 8 ký tự.';
            }
            if (constraints.maxLength) {
              return 'Mật khẩu không được vượt quá 72 ký tự.';
            }
            return 'Mật khẩu không hợp lệ.';
          }

          if (error.property === 'name') {
            return 'Tên hiển thị không được vượt quá 100 ký tự.';
          }

          return 'Thông tin nhập chưa hợp lệ. Vui lòng kiểm tra lại.';
        });

        return new BadRequestException(fields[0] ?? 'Thông tin nhập chưa hợp lệ.');
      },
    }),
  );
  const port = Number(config.get<string>('PORT', '3001'));
  await app.listen(port, '0.0.0.0');
  console.log(`BrewLite API listening on http://localhost:${port}/api`);
}
bootstrap();
