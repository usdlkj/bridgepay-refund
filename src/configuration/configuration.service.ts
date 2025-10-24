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

  async create(createConfigurationDto: CreateConfigurationDto) {
    const config = this.repository.create(createConfigurationDto);
    return this.repository.save(config);
  }

  findAll(): Promise<Configuration[]> {
    return this.repository.find();
  }

  async searchAllWithPagination(currentPage: number, pageSize: number) {
    console.log('HERE2');
    const recordsTotal = await this.repository.count();
    const [apiLogs, recordsFiltered] = await this.repository
      .createQueryBuilder('co')
      .skip((currentPage - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return {
      recordsTotal: recordsTotal,
      recordsFiltered: recordsFiltered,
      data: apiLogs,
    };
  }

  findOne(id: string): Promise<Configuration> {
    return this.repository.findOneBy({ id: id });
  }

  update(id: string, updateConfigurationDto: UpdateConfigurationDto) {
    return this.repository.update(id, updateConfigurationDto);
  }

  remove(id: string) {
    return this.repository.delete(id);
  }

  async findByConfigName(name: string): Promise<Configuration | null> {
    return await this.repository.findOne({ where: { configName: name } });
  }

  async updateByConfigName(
    name: string,
    value: string,
  ): Promise<Configuration> {
    const existing = await this.findByConfigName(name);
    if (existing) {
      existing.configValue = value;
      return this.repository.save(existing);
    } else {
      const newConfig = this.repository.create({
        configName: name,
        configValue: value,
      });
      return this.repository.save(newConfig);
    }
  }
}
