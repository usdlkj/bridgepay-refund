import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AccountInfoDto {
  @IsString()
  @IsNotEmpty()
  bankId: string;

  @IsString()
  @IsNotEmpty()
  accountNo: string;

  @IsString()
  @IsNotEmpty()
  accountType: string; 
  
  @IsString()
  @IsNotEmpty()
  idNo: string;
  
  @IsString()
  @IsNotEmpty()
  idType: string;

  @IsString()
  @IsNotEmpty()
  name: string;
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

  @IsString()
  @IsNotEmpty()
  signMsg: string;
}
