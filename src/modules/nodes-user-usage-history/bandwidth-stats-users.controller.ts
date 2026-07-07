import { Controller, HttpStatus, Param, Query, UseFilters, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Endpoint } from '@common/decorators/base-endpoint';
import { Roles } from '@common/decorators/roles/roles';
import { ApiScopeResource } from '@common/decorators/scopes';
import { HttpExceptionFilter } from '@common/exception/http-exception.filter';
import { JwtDefaultGuard } from '@common/guards/jwt-guards/def-jwt-guard';
import { RolesGuard } from '@common/guards/roles';
import { ScopesGuard } from '@common/guards/scopes';
import { errorHandler } from '@common/helpers/error-handler.helper';
import { BANDWIDTH_STATS_USERS_CONTROLLER, CONTROLLERS_INFO } from '@libs/contracts/api';
import { GetLegacyStatsUserUsageCommand, GetStatsUserUsageCommand } from '@libs/contracts/commands';
import { ROLE } from '@libs/contracts/constants';

import {
    GetStatsUserUsageParamDto,
    GetStatsUserUsageQueryDto,
    GetStatsUserUsageResponseDto,
} from './dtos';
import {
    GetLegacyStatsUserUsageParamDto,
    GetLegacyStatsUserUsageQueryDto,
    GetLegacyStatsUserUsageResponseDto,
} from './dtos/get-legacy-stats-users-usage.dto';
import { GetLegacyStatsUserUsageResponseModel } from './models';
import { NodesUserUsageHistoryService } from './nodes-user-usage-history.service';

@ApiBearerAuth('Authorization')
@ApiScopeResource(CONTROLLERS_INFO.BANDWIDTH_STATS.resource)
@ApiTags(CONTROLLERS_INFO.BANDWIDTH_STATS.tag)
@Roles(ROLE.ADMIN, ROLE.API)
@UseGuards(JwtDefaultGuard, RolesGuard, ScopesGuard)
@UseFilters(HttpExceptionFilter)
@Controller(BANDWIDTH_STATS_USERS_CONTROLLER)
export class BandwidthStatsUsersController {
    constructor(private readonly nodesUserUsageHistoryService: NodesUserUsageHistoryService) {}

    @Endpoint({
        command: GetLegacyStatsUserUsageCommand,
        httpCode: HttpStatus.OK,
        type: GetLegacyStatsUserUsageResponseDto,
    })
    async getUserUsageByRange(
        @Query() query: GetLegacyStatsUserUsageQueryDto,
        @Param() param: GetLegacyStatsUserUsageParamDto,
    ): Promise<GetLegacyStatsUserUsageResponseDto> {
        const result = await this.nodesUserUsageHistoryService.getLegacyStatsUserUsage(
            param.uuid,
            new Date(query.start),
            new Date(query.end),
        );

        const data = errorHandler(result);
        return {
            response: data.map((item) => new GetLegacyStatsUserUsageResponseModel(item)),
        };
    }

    @Endpoint({
        command: GetStatsUserUsageCommand,
        httpCode: HttpStatus.OK,
        type: GetStatsUserUsageResponseDto,
    })
    async getStatsNodesUsage(
        @Query() query: GetStatsUserUsageQueryDto,
        @Param() param: GetStatsUserUsageParamDto,
    ): Promise<GetStatsUserUsageResponseDto> {
        const result = await this.nodesUserUsageHistoryService.getStatsUserUsage(
            param.uuid,
            query.start,
            query.end,
            query.topNodesLimit,
        );

        const data = errorHandler(result);
        return {
            response: data,
        };
    }
}
