import { IsArray, IsOptional, ValidateNested, IsString, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class RefundLogSearchDto {
  @IsOptional()
  @IsString()
  value?: string;
}

/**
 * DTO for DataTables column filter item for refund logs
 * Represents a single column filter with search value and column index
 */
export class RefundLogColumnDto {
  @IsNumber()
  @Min(0)
  @Max(4) // Max index is 4 (fieldLog array has 5 items: indices 0-4)
  data: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => RefundLogSearchDto)
  search?: RefundLogSearchDto;
}

/**
 * DTO for refund log query parameters
 * Validates DataTables-style column filters to prevent SQL injection
 */
export class RefundLogQueryDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RefundLogColumnDto)
  query?: RefundLogColumnDto[];
}
