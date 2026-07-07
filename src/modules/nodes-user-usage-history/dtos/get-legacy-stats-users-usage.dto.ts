import { GetLegacyStatsUserUsageCommand } from '@contract/commands';
import { createZodDto } from 'nestjs-zod';

export class GetLegacyStatsUserUsageQueryDto extends createZodDto(
    GetLegacyStatsUserUsageCommand.RequestQuerySchema,
) {}

export class GetLegacyStatsUserUsageParamDto extends createZodDto(
    GetLegacyStatsUserUsageCommand.RequestParamSchema,
) {}

export class GetLegacyStatsUserUsageResponseDto extends createZodDto(
    GetLegacyStatsUserUsageCommand.ResponseSchema,
) {}
