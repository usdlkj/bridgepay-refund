import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateRefundDto } from './create-refund.dto';

const payload = (idType: unknown) => ({
  reqData: {
    account: {
      bankId: 'BCA', accountNo: '1234567890', name: 'Test Customer',
      accountType: 'p', idNo: '3171234567890001', idType,
    },
    invoice: {
      orderId: 'ORD-1', refundAmount: 100000, reason: 'test', passengers: 'A',
      originalOrderNumber: 'ORD-0', notifyUrl: 'https://example.test/cb', ticketOffice: 'jkt',
    },
  },
  signMsg: 'QUJD',
});

const errors = (idType: unknown) => validate(plainToInstance(CreateRefundDto, payload(idType)));

describe('CreateRefundDto idType (A = KTP, B = passport)', () => {
  it.each(['A', 'B'])('accepts %s', async (code) => {
    expect(await errors(code)).toHaveLength(0);
  });

  it.each(['1', '2', '3', 'C', 'a', '', 1, null])('rejects %p', async (code) => {
    expect((await errors(code)).length).toBeGreaterThan(0);
  });
});
