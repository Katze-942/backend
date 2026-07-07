import { createZodDto } from 'nestjs-zod';

import { GetConnectionKeysByUuidCommand } from '@libs/contracts/commands';

export class GetConnectionKeysByUuidParamDto extends createZodDto(
    GetConnectionKeysByUuidCommand.RequestParamSchema,
) {}

export class GetConnectionKeysByUuidResponseDto extends createZodDto(
    GetConnectionKeysByUuidCommand.ResponseSchema,
) {}
