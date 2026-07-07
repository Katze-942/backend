import { createZodDto } from 'nestjs-zod';

import { GetUserByUuidCommand } from '@libs/contracts/commands';

export class GetUserByUuidParamDto extends createZodDto(GetUserByUuidCommand.RequestParamSchema) {}
