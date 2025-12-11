import {
  IsNotEmpty,
  IsString,
  IsNumber,
  ValidateNested,
  IsOptional,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * ACCOUNT INFORMATION DTO
 */
class RefundAccountDto {
  @IsString()
  @IsNotEmpty()
  bankId: string;

  @IsString()
  @IsNotEmpty()
  accountNo: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}

/**
 * INVOICE INFORMATION DTO
 */
class RefundInvoiceDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsNumber()
  refundAmount: number;

  @IsString()
  @IsNotEmpty()
  reason: string;
}

/**
 * FULL reqData object
 */
class RefundReqDataDto {
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => RefundAccountDto)
  @IsObject()
  account: RefundAccountDto;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => RefundInvoiceDto)
  @IsObject()
  invoice: RefundInvoiceDto;
}

/**
 * MAIN CREATE REFUND DTO
 * This DTO prevents empty payload and enforces structure.
 */
export class CreateRefundDto {
  @IsObject()
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => RefundReqDataDto)
  reqData: RefundReqDataDto;

  /**
   * ticketCall = 0 → skip ticketing
   * ticketCall = 1 (default) → call ticketing
   */
  @IsOptional()
  @IsNumber()
  ticketCall?: number;
}
