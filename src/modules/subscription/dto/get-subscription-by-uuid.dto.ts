import { createZodDto } from 'nestjs-zod';

import { GetSubscriptionByUuidCommand } from '@libs/contracts/commands';

export class GetSubscriptionByUuidParamDto extends createZodDto(
    GetSubscriptionByUuidCommand.RequestParamSchema,
) {}

export class GetSubscriptionByUuidResponseDto extends createZodDto(
    GetSubscriptionByUuidCommand.ResponseSchema,
) {}
