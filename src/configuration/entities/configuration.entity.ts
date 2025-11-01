import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('configurations')
export class Configuration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'config_name' })
  configName: string;

  @Column({ type: 'text', name: 'config_value' })
  configValue: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
