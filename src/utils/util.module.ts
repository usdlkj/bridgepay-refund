import { Module } from '@nestjs/common';
import { CryptoService } from './crypto.service';
import { EncryptorClient } from './encryptor.client';
import { QueueService } from './queue.service';

@Module({
  providers: [CryptoService, EncryptorClient,QueueService],
  exports: [CryptoService, EncryptorClient,QueueService],
})
export class UtilsModule {}
