import { IsEnum, IsOptional, IsDateString } from 'class-validator';
import { BankStatus } from '../entities/refund-bank.entity';

/**
 * DTO for updating RefundBank.
 *
 * Business rules:
 * - Only `bankStatus` and `deletedAt` are allowed to be changed manually.
 * - All other fields are managed exclusively by Iluma/Xendit synchronization.
 */
export class UpdateRefundBankDto {
  @IsOptional()
  @IsEnum(BankStatus)
  bankStatus?: BankStatus;

  /**
   * Soft delete / undelete timestamp.
   * - Set to an ISO date string to soft-delete.
   * - Set to null (handled in service layer) or omit to keep as-is / undelete.
   */
  @IsOptional()
  @IsDateString()
  deletedAt?: string;
}
