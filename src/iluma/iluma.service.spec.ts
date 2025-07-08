import { Test, TestingModule } from '@nestjs/testing';
import { IlumaService } from './iluma.service';

describe('IlumaService', () => {
  let service: IlumaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IlumaService],
    }).compile();

    service = module.get<IlumaService>(IlumaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
