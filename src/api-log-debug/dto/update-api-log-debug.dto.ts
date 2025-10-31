import { PartialType } from '@nestjs/mapped-types';
import { CreateApiLogDebugDto } from './create-api-log-debug.dto';

export class UpdateApiLogDebugDto extends PartialType(CreateApiLogDebugDto) {}
