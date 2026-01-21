import { Module } from '@nestjs/common';
import { EncryptorClient } from './encryptor.client';

@Module({
  providers: [EncryptorClient],
  exports: [EncryptorClient],
})
export class UtilsModule {}
