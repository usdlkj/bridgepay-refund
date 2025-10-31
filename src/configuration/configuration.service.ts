import { Injectable, Logger } from '@nestjs/common';
import { CreateConfigurationDto } from './dto/create-configuration.dto';
import { UpdateConfigurationDto } from './dto/update-configuration.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Configuration } from './entities/configuration.entity';
import { Repository } from 'typeorm';

@Injectable()
export class ConfigurationService {
  private readonly logger = new Logger(ConfigurationService.name);

  constructor(
    @InjectRepository(Configuration)
    private repository: Repository<Configuration>,
  ) {}

  async findByConfigName(name: string): Promise<Configuration | null> {
    return await this.repository.findOne({ where: { configName: name } });
  }
}
