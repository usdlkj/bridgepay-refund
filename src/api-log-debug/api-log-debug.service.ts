import { Injectable } from '@nestjs/common';
import { CreateApiLogDebugDto } from './dto/create-api-log-debug.dto';
import { UpdateApiLogDebugDto } from './dto/update-api-log-debug.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiLogDebug } from './entities/api-log-debug.entity';
import { LessThan, Repository } from 'typeorm';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class ApiLogDebugService {
  constructor(
    @InjectRepository(ApiLogDebug)
    private repository: Repository<ApiLogDebug>,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ApiLogDebugService.name);
  }

  create(createApiLogDebugDto: CreateApiLogDebugDto) {
    return this.repository.save(createApiLogDebugDto);
  }

  findAll() {
    return this.repository.find();
  }

  async searchAllWithPagination(currentPage: number, pageSize: number) {
    const recordsTotal = await this.repository.count();
    const [apiLogs, recordsFiltered] = await this.repository
      .createQueryBuilder('ald')
      .skip((currentPage - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return {
      recordsTotal: recordsTotal,
      recordsFiltered: recordsFiltered,
      data: apiLogs,
    };
  }

  findOne(id: number) {
    return this.repository.findOneBy({ id: id });
  }

  update(id: number, updateApiLogDebugDto: UpdateApiLogDebugDto) {
    return this.repository.update(id, updateApiLogDebugDto);
  }

  remove(id: number) {
    return this.repository.delete(id);
  }

  async dbCleanup(deletionDate: Date) {
    const count = await this.repository.count({
      where: {
        createdAt: LessThan(deletionDate),
      },
    });
    this.logger.info(`Cleaning ${count} records`);
    return this.repository.delete({
      createdAt: LessThan(deletionDate), // ✅ Delete records older than deletionDate
    });
  }
}
