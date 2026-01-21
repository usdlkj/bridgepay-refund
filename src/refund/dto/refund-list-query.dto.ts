import { IsArray, IsOptional, ValidateNested, IsString, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for DataTables column filter item
 * Represents a single column filter with search value and column index
 */
export class RefundListColumnDto {
  @IsNumber()
  @Min(0)
  @Max(5) // Max index is 5 (field array has 6 items: indices 0-5)
  data: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => RefundListSearchDto)
  search?: RefundListSearchDto;
}

export class RefundListSearchDto {
  @IsOptional()
  @IsString()
  value?: string;
}

/**
 * DTO for refund list query parameters
 * Validates DataTables-style column filters to prevent SQL injection
 */
export class RefundListQueryDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RefundListColumnDto)
  query?: RefundListColumnDto[];
}
