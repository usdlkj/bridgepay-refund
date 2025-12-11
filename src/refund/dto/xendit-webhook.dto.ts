import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ChannelPropertiesDto {
  @IsString()
  @IsNotEmpty()
  account_number: string;

  @IsOptional()
  @IsString()
  account_holder_name?: string;

  @IsOptional()
  @IsString()
  account_type?: string;
}

class XenditWebhookDataDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsNumber()
  amount: number;

  @IsString()
  @IsNotEmpty()
  channel_code: string;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsString()
  @IsNotEmpty()
  status: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty()
  reference_id: string;

  @IsString()
  @IsNotEmpty()
  created: string;

  @IsString()
  @IsNotEmpty()
  updated: string;

  @IsOptional()
  @IsString()
  estimated_arrival_time?: string;

  @IsOptional()
  @IsString()
  business_id?: string;

  @ValidateNested()
  @Type(() => ChannelPropertiesDto)
  channel_properties: ChannelPropertiesDto;

  @IsOptional()
  @IsString()
  failure_code?: string;
}

export class XenditWebhookDto {
  @IsString()
  @IsNotEmpty()
  event: string;

  @IsString()
  @IsNotEmpty()
  business_id: string;

  @IsString()
  @IsNotEmpty()
  created: string;

  @ValidateNested()
  @Type(() => XenditWebhookDataDto)
  data: XenditWebhookDataDto;
}
