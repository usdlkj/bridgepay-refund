import {
  IsNotEmpty,
  IsString,
  IsNumber,
  ValidateNested,
  IsOptional,
  IsObject,
  Matches,
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

  @IsString()
  @IsNotEmpty()
  accountType: string; 
  
  @IsString()
  @IsNotEmpty()
  idNo: string;
  
  // Real traffic carries 1, B, KTP and Passport (T47); the value is stored and never used, so bound it, do not enumerate it.
  @IsString()
  @Matches(/^[A-Za-z0-9]{1,10}$/)
  idType: string;
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

  @IsString()
  @IsNotEmpty()
  passengers:string;

  @IsString()
  @IsNotEmpty()
  originalOrderNumber:string;

  @IsString()
  @IsNotEmpty()
  notifyUrl:string;

  @IsString()
  @IsNotEmpty()
  ticketOffice:string;
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

  @IsString()
  @IsNotEmpty()
  signMsg: string;

  /**
   * ticketCall = 0 → skip ticketing
   * ticketCall = 1 (default) → call ticketing
   */
  @IsOptional()
  @IsNumber()
  ticketCall?: number;
}
