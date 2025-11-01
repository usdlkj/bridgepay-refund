import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
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
    name: 'pg_code',
  })
  @Index()
  pgCode: string; // e.g., 'doku', 'xendit', 'finnet'

  @Column({ name: 'pg_name' })
  pgName: string;

  // --- Legacy (can be deprecated later) ---
  @Column({ type: 'text' }) credential: string;
  @Column({
    name: 'credential_encrypted',
    type: 'text',
    nullable: true, // temporary during migration
  })
  credentialEncrypted?: string;

  // --- Encrypted fields ---
  @Column({ type: 'bytea', nullable: true }) credential_enc: Buffer | null;
  @Column({ type: 'bytea', nullable: true }) credential_iv: Buffer | null;
  @Column({ type: 'bytea', nullable: true }) credential_tag: Buffer | null;
  @Column({ type: 'bytea', nullable: true }) credential_edk: Buffer | null;
  @Column({ type: 'varchar', length: 32, default: 'AES-256-GCM' })
  credential_alg: string;
  @Column({ type: 'jsonb', default: () => `'{}'` }) credential_kmd: Record<
    string,
    any
  >;

  @Column({
    type: 'enum',
    enum: PaymentGatewayStatus,
    default: PaymentGatewayStatus.DEVELOPMENT,
  })
  status: string;

  @Column()
  weight: number;

  @Column({ name: 'percentage_range' })
  percentageRange: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;
}
