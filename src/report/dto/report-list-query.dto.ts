import { IsArray, IsOptional, ValidateNested, IsString, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for DataTables column filter item for report list
 * Represents a single column filter with search value and column index
 */
export class ReportListColumnDto {
  @IsNumber()
  @Min(0)
  @Max(5) // Max index is 5 (field array has 6 items: indices 0-5)
  data: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ReportListSearchDto)
  search?: ReportListSearchDto;
}

export class ReportListSearchDto {
  @IsOptional()
  @IsString()
  value?: string;
}

/**
 * DTO for report list query parameters
 * Validates DataTables-style column filters to prevent SQL injection
 */
export class ReportListQueryDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportListColumnDto)
  query?: ReportListColumnDto[];
}
