import { Module } from '@nestjs/common';
import { CheckAccountService } from './check-account.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BankData } from 'src/iluma/entities/bank-data.entity';
import { UtilsModule } from 'src/utils/util.module';


@Module({
  imports:[TypeOrmModule.forFeature([BankData]),UtilsModule],
  providers: [CheckAccountService]
})
export class WorkerModule {}
