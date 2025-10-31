import { Injectable, Logger } from '@nestjs/common';
import { CreatePaymentGatewayDto } from './dto/create-payment-gateway.dto';
import { UpdatePaymentGatewayDto } from './dto/update-payment-gateway.dto';
import { InjectRepository } from '@nestjs/typeorm';
import {
  PaymentGateway,
  PaymentGatewayStatus,
} from './entities/payment-gateway.entity';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { CryptoService } from '../utils/crypto.service';

@Injectable()
export class PaymentGatewayService {
  private readonly logger = new Logger(PaymentGatewayService.name);

  constructor(
    @InjectRepository(PaymentGateway)
    private repository: Repository<PaymentGateway>,
    private readonly cryptoService: CryptoService,
  ) {}

  // == Handles REST API calls ==


  async findOne(id: string) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { credential, ...rest } = await this.repository.findOneBy({ id });
    return rest;
  }

  async getCredential(id: string, userName: string) {
    const { credentialEncrypted } = await this.repository.findOneBy({ id });
    const credential = this.cryptoService.decrypt(credentialEncrypted);
    return credential;
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
