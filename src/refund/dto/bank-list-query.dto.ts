import { IsArray, IsOptional, ValidateNested, IsString, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class BankListSearchDto {
  @IsOptional()
  @IsString()
  value?: string;
}

/**
 * DTO for DataTables column filter item for bank list
 * Represents a single column filter with search value and column index
 */
export class BankListColumnDto {
  @IsNumber()
  @Min(0)
  @Max(2) // Max index is 2 (BANK_FILTER_CONFIG has 3 items: indices 0-2)
  data: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => BankListSearchDto)
  search?: BankListSearchDto;
}

/**
 * Interface for backward compatibility with existing service method
 * This matches the existing BankListColumn interface
 */
export interface BankListColumn {
  data: number;
  search: {
    value: string;
  };
}

/**
 * DTO for bank list query parameters
 * Validates DataTables-style column filters to prevent SQL injection
 */
export class BankListQueryDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BankListColumnDto)
  query?: BankListColumnDto[];
}
