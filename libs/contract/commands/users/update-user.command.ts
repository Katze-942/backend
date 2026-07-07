import { z } from 'zod';

import { REST_API, USERS_ROUTES } from '../../api';
import { getEndpointDetails, RESET_PERIODS, USERS_STATUS } from '../../constants';
import { UserResponseSchema } from './user.response';
export namespace UpdateUserCommand {
    export const url = REST_API.USERS.UPDATE;
    export const TSQ_url = url;

    export const endpointDetails = getEndpointDetails(
        USERS_ROUTES.UPDATE,
        'patch',
        'Update a user by UUID or username',
        { scope: 'update', kind: 'write' },
    );

    export const RequestBodySchema = z
        .object({
            username: z.optional(z.string().describe('Username of the user')),
            uuid: z.optional(
                z
                    .uuid()
                    .describe(
                        'UUID of the user. UUID has higher priority than username, so if both are provided, username will be ignored.',
                    ),
            ),
            status: z.enum([USERS_STATUS.ACTIVE, USERS_STATUS.DISABLED]).optional(),
            trafficLimitBytes: z
                .number()
                .min(0)
                .describe('Traffic limit in bytes. 0 - unlimited')
                .optional(),
            trafficLimitStrategy: z
                .enum(RESET_PERIODS)
                .describe('Traffic limit reset strategy')
                .optional(),
            expireAt: z.iso
                .datetime({ local: true, offset: true })
                .transform((str) => new Date(str))
                .refine((date) => date > new Date(), {
                    error: 'Expiration date cannot be in the past',
                })
                .describe('Expiration date: 2025-01-17T15:38:45.065Z')
                .optional(),
            description: z.optional(z.string().nullable()),
            tag: z.optional(
                z
                    .string()
                    .regex(
                        /^[A-Z0-9_]+$/,
                        'Tag can only contain uppercase letters, numbers, underscores',
                    )
                    .max(16, 'Tag must be less than 16 characters')
                    .nullable(),
            ),
            telegramId: z.number().nullish(),
            email: z.email().nullish(),
            hwidDeviceLimit: z.int().min(0).nullish(),
            activeInternalSquads: z.array(z.uuid()).optional(),
            externalSquadUuid: z
                .optional(z.nullable(z.uuid()))
                .describe('Optional. External squad UUID.'),
        })
        .refine((data) => data.uuid || data.username, {
            error: 'Either uuid or username must be provided',
        });

    export const ResponseSchema = UserResponseSchema;

    export type RequestBody = z.infer<typeof RequestBodySchema>;
    export type Response = z.infer<typeof ResponseSchema>;
}
