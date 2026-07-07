import { z } from 'zod';

import { BANDWIDTH_STATS_ROUTES, REST_API } from '../../../api';
import { getEndpointDetails } from '../../../constants';

export namespace GetLegacyStatsNodeUserUsageCommand {
    export const url = REST_API.BANDWIDTH_STATS.LEGACY.NODES.GET_USERS;
    export const TSQ_url = url(':uuid');

    export const endpointDetails = getEndpointDetails(
        BANDWIDTH_STATS_ROUTES.LEGACY.NODES.GET_USERS(':uuid'),
        'get',
        'Get Node User Usage by Range and Node UUID (Legacy)',
        { scope: 'node-users-usage-legacy', kind: 'read' },
    );

    export const RequestParamSchema = z.object({
        uuid: z.uuid().describe('UUID of the node'),
    });

    export const RequestQuerySchema = z.object({
        start: z.iso.datetime().describe('Start date'),
        end: z.iso.datetime().describe('End date'),
    });

    export const ResponseSchema = z.object({
        response: z.array(
            z.object({
                userUuid: z.uuid(),
                username: z.string(),
                nodeUuid: z.uuid(),
                total: z.number(),
                date: z.string().transform((str) => new Date(str)),
            }),
        ),
    });

    export type RequestParam = z.infer<typeof RequestParamSchema>;
    export type RequestQuery = z.infer<typeof RequestQuerySchema>;
    export type Response = z.infer<typeof ResponseSchema>;
}
