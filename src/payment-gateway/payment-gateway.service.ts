import { CreatePaymentGatewayDto } from './dto/create-payment-gateway.dto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentGateway } from './entities/payment-gateway.entity';
import { Repository } from 'typeorm';
import { CryptoService } from '../utils/crypto.service';
import { EncryptionService } from 'src/security/encryption.service';

@Injectable()
export class PaymentGatewayService {
  private readonly logger = new Logger(PaymentGatewayService.name);

  constructor(
    @InjectRepository(PaymentGateway)
    private repository: Repository<PaymentGateway>,
    private readonly cryptoService: CryptoService,
    private enc: EncryptionService,
  ) {}

  // == Handles REST API calls ==

  async findOne(id: string) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { credential, ...rest } = await this.repository.findOneBy({ id });
    return rest;
  }

  async getCredential(id: string) {
    const { credentialEncrypted } = await this.repository.findOneBy({ id });
    const credential = this.cryptoService.decrypt(credentialEncrypted);
    return credential;
  }

  async createOrUpdate(dto: CreatePaymentGatewayDto, id?: string) {
    const entity = id
      ? await this.repository.findOneByOrFail({ id })
      : this.repository.create();

    entity.pgCode = dto.pgCode;
    entity.pgName = dto.pgName;
    entity.status = dto.status;
    entity.weight = dto.weight ?? 0;
    entity.percentageRange = dto.percentageRange ?? null;

    if (dto.credential) {
      const aad = Buffer.from(`payment_gateways:${dto.pgCode}`, 'utf8');
      const encCtxExtra = { table: 'payment_gateways', pgCode: dto.pgCode };
      const plain = Buffer.from(dto.credential, 'utf8');

      const encrypted = await this.enc.encryptAead(plain, aad, encCtxExtra);
      plain.fill(0); // zeroize plaintext buffer

      // TO BE DELETED
      entity.credential = dto.credential;

      entity.credential_enc = encrypted.enc;
      entity.credential_iv = encrypted.iv;
      entity.credential_tag = encrypted.tag;
      entity.credential_edk = encrypted.edk;
      entity.credential_alg = encrypted.alg;
      entity.credential_kmd = encrypted.kmd;
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
