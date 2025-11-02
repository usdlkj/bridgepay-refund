import { CreatePaymentGatewayDto } from './dto/create-payment-gateway.dto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentGateway } from './entities/payment-gateway.entity';
import { Repository } from 'typeorm';
import { firstValueFrom, timeout, TimeoutError } from 'rxjs';
import { EncryptorClient } from '../utils/encryptor.client';

@Injectable()
export class PaymentGatewayService {
  private readonly logger = new Logger(PaymentGatewayService.name);

  constructor(
    @InjectRepository(PaymentGateway)
    private repository: Repository<PaymentGateway>,
    private encryptorClient: EncryptorClient,
  ) {}

  // == Handles REST API calls ==

  async findOne(id: string) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { credential, ...rest } = await this.repository.findOneBy({ id });
    return rest;
  }

  // async getCredential(id: string) {
  //   const { credentialEncrypted } = await this.repository.findOneBy({ id });
  //   const credential = this.cryptoService.decrypt(credentialEncrypted);
  //   return credential;
  // }

  async getCredential(pgCode: string) {
    const entity = await this.repository.findOneByOrFail({ pgCode });
    const aad = Buffer.from(`payment_gateways:${pgCode}`, 'utf8');

    if (entity.credential_alg !== 'AES-256-GCM') {
      throw new Error(`Unsupported cipher algorithm: ${entity.credential_alg}`);
    }

    const payload = {
      payload: {
        enc: entity.credential_enc.toString('base64'),
        iv: entity.credential_iv.toString('base64'),
        tag: entity.credential_tag.toString('base64'),
        edk: entity.credential_edk.toString('base64'),
        alg: entity.credential_alg,
        kmd: entity.credential_kmd,
      },
      aad: aad.toString('base64'),
      context: { table: 'payment_gateways', pgCode },
    };

    // --- send request to bridgepay-encryptor ---
    try {
      const response = await firstValueFrom(
        this.encryptorClient.proxy.send('decrypt', payload).pipe(timeout(5000)),
      );

      if (!response) {
        throw new Error('Invalid decrypt response');
      }

      return response;
    } catch (err) {
      if (err instanceof TimeoutError) {
        throw new Error('Encryptor microservice timeout');
      }

      console.error('[EncryptorClient] decrypt_aead failed:', err);
      throw new Error('Failed to decrypt credential');
    }
  }

  async createOrUpdate(dto: CreatePaymentGatewayDto, id?: string) {
    const entity = id
      ? await this.repository.findOneByOrFail({ id })
      : this.repository.create();

    entity.pgCode = dto.pgCode.trim().toLowerCase();
    entity.pgName = dto.pgName;
    entity.status = dto.status;
    entity.weight = dto.weight ?? 0;
    entity.percentageRange = dto.percentageRange ?? null;

    if (dto.credential) {
      const aad = Buffer.from(`payment_gateways:${dto.pgCode}`, 'utf8');
      const encCtxExtra = {
        table: 'payment_gateways',
        pgCode: String(dto.pgCode),
      };

      // Payload to send to encryptor microservice
      const payload = {
        value: Buffer.from(dto.credential, 'utf8').toString('base64'),
        aad: aad.toString('base64'),
        context: encCtxExtra,
      };

      // --- call bridgepay-encryptor via RabbitMQ ---
      try {
        const encrypted = await firstValueFrom(
          this.encryptorClient.proxy
            .send('encrypt', payload)
            .pipe(timeout(5000)),
        );

        if (
          !encrypted?.enc ||
          !encrypted?.iv ||
          !encrypted?.tag ||
          !encrypted?.edk ||
          !encrypted?.alg
        ) {
          throw new Error('Invalid encrypt response');
        }

        // Optional: wipe plaintext
        dto.credential = '';
        entity.credential = 'FAKEVALUE';

        // 🔒 Store encrypted values
        entity.credential_enc = Buffer.from(encrypted.enc, 'base64');
        entity.credential_iv = Buffer.from(encrypted.iv, 'base64');
        entity.credential_tag = Buffer.from(encrypted.tag, 'base64');
        entity.credential_edk = Buffer.from(encrypted.edk, 'base64');
        entity.credential_alg = encrypted.alg;
        entity.credential_kmd = encrypted.kmd;
      } catch (err) {
        if (err instanceof TimeoutError) {
          throw new Error('Encryptor microservice timeout');
        }

        console.error('[EncryptorClient] encrypt_aead failed:', err);
        this.logger.error('Encryptor encrypt_aead failed', err);
        throw new Error('Failed to encrypt credential');
      }
    }

    return this.repository.save(entity);
  }

  async delete(id: string) {
    return await this.repository.delete(id);
  }

  // == Handles Microservices calls ==

  async findAllByScope(param: object) {
    const results = await this.repository.find(param);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return results.map(({ credential, credentialEncrypted, ...rest }) => rest);
  }

  async findOneByScope(param: object) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { credential, ...rest } = await this.repository.findOne(param);
    return rest;
  }

  async findOneLikeName(param: { pgName: string }) {
    return await this.repository
      .createQueryBuilder('paymentGateway')
      .where("LOWER(paymentGateway.pgName) ILIKE '%" + param.pgName + "%'")
      .getOne();
  }
}
