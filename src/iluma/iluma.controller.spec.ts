import { Test, TestingModule } from '@nestjs/testing';
import { IlumaController } from './iluma.controller';

describe('IlumaController', () => {
  let controller: IlumaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IlumaController],
    }).compile();

    controller = module.get<IlumaController>(IlumaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
