import { Module } from '@nestjs/common';
import { CryptoService } from './crypto.service';
import { EncryptorClient } from './encryptor.client';

@Module({
  providers: [CryptoService, EncryptorClient],
  exports: [CryptoService, EncryptorClient],
})
export class UtilsModule {}
