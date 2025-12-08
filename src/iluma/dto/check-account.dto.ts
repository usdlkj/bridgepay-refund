import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AccountInfoDto {
  @IsString()
  @IsNotEmpty()
  bankId: string;

  @IsString()
  @IsNotEmpty()
  accountNo: string;
}

export class ReqDataDto {
  @ValidateNested()
  @Type(() => AccountInfoDto)
  account: AccountInfoDto;
}

export class CheckAccountDto {
  @ValidateNested()
  @Type(() => ReqDataDto)
  reqData: ReqDataDto;
}
