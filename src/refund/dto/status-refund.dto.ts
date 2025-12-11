import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';

class InvoiceStatusDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;
}

class ReqDataStatusDto {
  @ValidateNested()
  @Type(() => InvoiceStatusDto)
  invoice: InvoiceStatusDto;
}

export class StatusRefundDto {
  @ValidateNested()
  @Type(() => ReqDataStatusDto)
  reqData: ReqDataStatusDto;
}
