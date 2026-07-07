import { GetLegacyStatsNodeUserUsageCommand } from '@contract/commands';
import { createZodDto } from 'nestjs-zod';

export class GetLegacyStatsNodesUsersUsageQueryDto extends createZodDto(
    GetLegacyStatsNodeUserUsageCommand.RequestQuerySchema,
) {}

export class GetLegacyStatsNodesUsersUsageParamDto extends createZodDto(
    GetLegacyStatsNodeUserUsageCommand.RequestParamSchema,
) {}

export class GetLegacyStatsNodesUsersUsageResponseDto extends createZodDto(
    GetLegacyStatsNodeUserUsageCommand.ResponseSchema,
) {}
