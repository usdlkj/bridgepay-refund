import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PaymentGatewayStatus {
  PRODUCTION = 'production',
  DEVELOPMENT = 'development',
  DISABLE = 'disable',
}

export class PaymentGatewayScope {
  get(env) {
    const data = [];
    data['development'] = {
      serviceStatus: ['development', 'production'],
    };
    data['test'] = {
      serviceStatus: ['development', 'production'],
    };
    data['production'] = {
      serviceStatus: ['production'],
    };
    return data[env];
  }
}

@Entity({ name: 'payment_gateways' })
export class PaymentGateway {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    unique: true,
    name: 'pgCode',
  })
  @Index()
  pgCode: string; // e.g., 'doku', 'xendit', 'finnet'

  @Column()
  pgName: string;

  @Column({
    type: 'text',
  })
  credential: string;

  @Column({
    name: 'credentialEncrypted',
    type: 'text',
    nullable: true, // temporary during migration
  })
  credentialEncrypted?: string;

  @Column({
    type: 'enum',
    enum: PaymentGatewayStatus,
    default: PaymentGatewayStatus.DEVELOPMENT,
  })
  status: string;

  @Column()
  weight: number;

  @Column()
  percentageRange: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
