
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { ProductsModule } from './products/products.module';
import { AuthModule } from './auth/auth.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { HealthController } from './health.controller';
import { AuditModule } from './audit/audit.module';
import { AdminModule } from './admin/admin.module';
import { PromotionsModule } from './promotions/promotions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuditModule,
    ProductsModule,
    AuthModule,
    OrdersModule,
    PaymentsModule,
    AdminModule,
    PromotionsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
