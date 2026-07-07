import { z } from 'zod';

import { BANDWIDTH_STATS_ROUTES, REST_API } from '../../../api';
import { getEndpointDetails } from '../../../constants';

export namespace GetLegacyStatsUserUsageCommand {
    export const url = REST_API.BANDWIDTH_STATS.LEGACY.USERS.GET_BY_UUID;
    export const TSQ_url = url(':uuid');

    export const endpointDetails = getEndpointDetails(
        BANDWIDTH_STATS_ROUTES.LEGACY.USERS.GET_BY_UUID(':uuid'),
        'get',
        'Get User Usage by Range (Legacy)',
        { scope: 'user-usage-legacy', kind: 'read' },
    );

    export const RequestParamSchema = z.object({
        uuid: z.uuid(),
    });

    export const RequestQuerySchema = z.object({
        start: z.iso.datetime().describe('Start date'),
        end: z.iso.datetime().describe('End date'),
    });

    export const ResponseSchema = z.object({
        response: z.array(
            z.object({
                userUuid: z.uuid(),
                nodeUuid: z.uuid(),
                nodeName: z.string(),
                countryCode: z.string(),
                total: z.number(),
                date: z.string().transform((str) => new Date(str)),
            }),
        ),
    });

    export type RequestParam = z.infer<typeof RequestParamSchema>;
    export type RequestQuery = z.infer<typeof RequestQuerySchema>;
    export type Response = z.infer<typeof ResponseSchema>;
}
