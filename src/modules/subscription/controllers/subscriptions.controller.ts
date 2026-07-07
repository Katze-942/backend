import type { Request } from 'express';

import {
    Body,
    Controller,
    HttpStatus,
    Param,
    Query,
    Req,
    UseFilters,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Endpoint } from '@common/decorators/base-endpoint';
import { IpAddress } from '@common/decorators/get-ip';
import { Roles } from '@common/decorators/roles/roles';
import { ApiScopeResource } from '@common/decorators/scopes';
import { HttpExceptionFilter } from '@common/exception/http-exception.filter';
import { JwtDefaultGuard } from '@common/guards/jwt-guards/def-jwt-guard';
import { RolesGuard } from '@common/guards/roles';
import { ScopesGuard } from '@common/guards/scopes';
import { errorHandler } from '@common/helpers/error-handler.helper';
import { extractHwidHeaders } from '@common/utils/extract-hwid-headers';
import { truncateHeader } from '@common/utils/truncate-header.util';
import { CONTROLLERS_INFO, SUBSCRIPTIONS_CONTROLLER } from '@libs/contracts/api';
import {
    GetConnectionKeysByUuidCommand,
    GetRawSubscriptionByShortUuidCommand,
    GetSubscriptionByShortUuidProtectedCommand,
    GetSubscriptionByUsernameCommand,
    GetSubscriptionByUuidCommand,
    GetSubscriptionsCommand,
} from '@libs/contracts/commands';
import { GetSubpageConfigByShortUuidCommand } from '@libs/contracts/commands/subscriptions/subpage/get-subpage-config-by-shortuuid.command';
import { ROLE } from '@libs/contracts/constants';

import {
    GetConnectionKeysByUuidResponseDto,
    GetRawSubscriptionByShortUuidParamDto,
    GetRawSubscriptionByShortUuidQueryDto,
    GetRawSubscriptionByShortUuidResponseDto,
    GetSubscriptionByShortUuidProtectedParamDto,
    GetSubscriptionByShortUuidProtectedResponseDto,
    GetSubscriptionByUsernameParamDto,
    GetSubscriptionByUsernameResponseDto,
    GetSubscriptionByUuidParamDto,
    GetSubscriptionByUuidResponseDto,
    GetConnectionKeysByUuidParamDto,
    GetSubscriptionsResponseDto,
    GetSubscriptionsQueryDto,
} from '../dto';
import {
    GetSubpageConfigByShortUuidBodyDto,
    GetSubpageConfigByShortUuidParamDto,
    GetSubpageConfigByShortUuidResponseDto,
} from '../dto/get-subpage-config.dto';
import { AllSubscriptionsResponseModel, SubscriptionRawResponse } from '../models';
import { SubscriptionService } from '../subscription.service';

@ApiBearerAuth('Authorization')
@ApiScopeResource(CONTROLLERS_INFO.SUBSCRIPTIONS.resource)
@ApiTags(CONTROLLERS_INFO.SUBSCRIPTIONS.tag)
@Roles(ROLE.ADMIN, ROLE.API)
@UseGuards(JwtDefaultGuard, RolesGuard, ScopesGuard)
@UseFilters(HttpExceptionFilter)
@Controller(SUBSCRIPTIONS_CONTROLLER)
export class SubscriptionsController {
    constructor(private readonly subscriptionService: SubscriptionService) {}

    @Endpoint({
        command: GetSubscriptionsCommand,
        httpCode: HttpStatus.OK,
        type: GetSubscriptionsResponseDto,
    })
    async getAllSubscriptions(
        @Query() query: GetSubscriptionsQueryDto,
    ): Promise<GetSubscriptionsResponseDto> {
        const { start, size } = query;
        const result = await this.subscriptionService.getAllSubscriptions({
            start,
            size,
        });

        const data = errorHandler(result);
        return {
            response: new AllSubscriptionsResponseModel({
                total: data.total,
                subscriptions: data.subscriptions.map((item) => new SubscriptionRawResponse(item)),
            }),
        };
    }

    @Endpoint({
        command: GetSubscriptionByUsernameCommand,
        httpCode: HttpStatus.OK,
        type: GetSubscriptionByUsernameResponseDto,
    })
    async getSubscriptionByUsername(
        @Param() param: GetSubscriptionByUsernameParamDto,
    ): Promise<GetSubscriptionByUsernameResponseDto> {
        const { username } = param;
        const result = await this.subscriptionService.getSubscriptionInfo({
            searchBy: {
                uniqueField: username,
                uniqueFieldKey: 'username',
            },
            authenticated: true,
        });

        const data = errorHandler(result);

        return {
            response: new SubscriptionRawResponse(data),
        };
    }

    @Endpoint({
        command: GetSubscriptionByShortUuidProtectedCommand,
        httpCode: HttpStatus.OK,
        type: GetSubscriptionByShortUuidProtectedResponseDto,
    })
    async getSubscriptionByShortUuidProtected(
        @Param() param: GetSubscriptionByShortUuidProtectedParamDto,
    ): Promise<GetSubscriptionByShortUuidProtectedResponseDto> {
        const { shortUuid } = param;
        const result = await this.subscriptionService.getSubscriptionInfo({
            searchBy: {
                uniqueField: shortUuid,
                uniqueFieldKey: 'shortUuid',
            },
            authenticated: true,
        });

        const data = errorHandler(result);

        return {
            response: new SubscriptionRawResponse(data),
        };
    }

    @Endpoint({
        command: GetSubscriptionByUuidCommand,
        httpCode: HttpStatus.OK,
        type: GetSubscriptionByUuidResponseDto,
    })
    async getSubscriptionByUuid(
        @Param() param: GetSubscriptionByUuidParamDto,
    ): Promise<GetSubscriptionByUuidResponseDto> {
        const { uuid } = param;
        const result = await this.subscriptionService.getSubscriptionInfo({
            searchBy: {
                uniqueField: uuid,
                uniqueFieldKey: 'uuid',
            },
            authenticated: true,
        });

        const data = errorHandler(result);

        return {
            response: new SubscriptionRawResponse(data),
        };
    }

    @Endpoint({
        command: GetRawSubscriptionByShortUuidCommand,
        httpCode: HttpStatus.OK,
        type: GetRawSubscriptionByShortUuidResponseDto,
    })
    async getRawSubscriptionByShortUuid(
        @IpAddress() ip: string,
        @Param() { shortUuid }: GetRawSubscriptionByShortUuidParamDto,
        @Query() { withDisabledHosts }: GetRawSubscriptionByShortUuidQueryDto,
        @Req() request: Request,
    ): Promise<GetRawSubscriptionByShortUuidResponseDto> {
        const result = await this.subscriptionService.getRawSubscriptionByShortUuid(
            shortUuid,
            truncateHeader(request.headers['user-agent']),
            withDisabledHosts,
            extractHwidHeaders(request),
            ip,
        );

        const data = errorHandler(result);

        return {
            response: data,
        };
    }

    @Endpoint({
        command: GetSubpageConfigByShortUuidCommand,
        httpCode: HttpStatus.OK,
        type: GetSubpageConfigByShortUuidResponseDto,
    })
    async getSubpageConfigByShortUuid(
        @Param() param: GetSubpageConfigByShortUuidParamDto,
        @Body() body: GetSubpageConfigByShortUuidBodyDto,
    ): Promise<GetSubpageConfigByShortUuidResponseDto> {
        const { shortUuid } = param;
        const result = await this.subscriptionService.getSubpageConfigByShortUuid(
            shortUuid,
            body.requestHeaders,
        );
        const data = errorHandler(result);
        return {
            response: data,
        };
    }

    @Endpoint({
        command: GetConnectionKeysByUuidCommand,
        httpCode: HttpStatus.OK,
        type: GetConnectionKeysByUuidResponseDto,
    })
    async getConnectionKeysByUuid(
        @Param() param: GetConnectionKeysByUuidParamDto,
    ): Promise<GetConnectionKeysByUuidResponseDto> {
        const { uuid } = param;
        const result = await this.subscriptionService.getConnectionKeysByUuid(uuid);
        const data = errorHandler(result);
        return {
            response: data,
        };
    }
}
