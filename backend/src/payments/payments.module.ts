import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { JwtStrategy } from '../auth/jwt.strategy';
@Module({ imports: [PassportModule], controllers: [PaymentsController], providers: [PaymentsService, JwtStrategy] })
export class PaymentsModule { }
