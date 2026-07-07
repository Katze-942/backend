import { z } from 'zod';

import { REST_API, USERS_ROUTES } from '../../api';
import { getEndpointDetails } from '../../constants';

export namespace GetUserAccessibleNodesCommand {
    export const url = REST_API.USERS.ACCESSIBLE_NODES;
    export const TSQ_url = url(':uuid');

    export const endpointDetails = getEndpointDetails(
        USERS_ROUTES.ACCESSIBLE_NODES(':uuid'),
        'get',
        'Get user accessible nodes',
        { scope: 'accessible-nodes', kind: 'read' },
    );

    export const RequestParamSchema = z.object({
        uuid: z.uuid(),
    });

    export const ResponseSchema = z.object({
        response: z.object({
            userUuid: z.uuid(),
            activeNodes: z.array(
                z.object({
                    uuid: z.uuid(),
                    nodeName: z.string(),
                    countryCode: z.string(),
                    configProfileUuid: z.uuid(),
                    configProfileName: z.string(),
                    activeSquads: z.array(
                        z.object({
                            squadName: z.string(),
                            activeInbounds: z.array(z.string()),
                        }),
                    ),
                }),
            ),
        }),
    });

    export type RequestParam = z.infer<typeof RequestParamSchema>;
    export type Response = z.infer<typeof ResponseSchema>;
}
