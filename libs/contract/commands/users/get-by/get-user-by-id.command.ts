import { z } from 'zod';

import { REST_API, USERS_ROUTES } from '../../../api';
import { getEndpointDetails } from '../../../constants';
import { UserResponseSchema } from '../user.response';

export namespace GetUserByIdCommand {
    export const url = REST_API.USERS.GET_BY.ID;
    export const TSQ_url = url(':id');

    export const endpointDetails = getEndpointDetails(
        USERS_ROUTES.GET_BY.ID(':id'),
        'get',
        'Get user by ID',
        { scope: 'by-id', kind: 'read' },
    );

    export const RequestParamSchema = z.object({
        id: z.string().transform(Number).pipe(z.number().nonnegative()),
    });

    export const ResponseSchema = UserResponseSchema;

    export type RequestParam = z.infer<typeof RequestParamSchema>;
    export type Response = z.infer<typeof ResponseSchema>;
}
