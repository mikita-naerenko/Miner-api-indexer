import {
  Controller,
  Get,
  Query,
  Param,
  ParseIntPipe,
  DefaultValuePipe,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiService } from './api.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import {
  LeaderboardEntryDto,
  TvlDataPointDto,
  UserReferralDto,
  TotalValueLockedDto,
} from './dto/api.dto';

@ApiTags('DApp API')
@Controller('api')
export class ApiController {
  constructor(
    private readonly apiService: ApiService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Get('leaderboard')
  @ApiOperation({ summary: 'Get leaderboard' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of entries (1-1000)',
    example: 100,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Pagination offset (0-100000)',
    example: 0,
  })
  @ApiOkResponse({
    type: LeaderboardEntryDto,
    isArray: true,
    description: 'List of users ordered by totalDeposited',
  })
  @ApiBadRequestResponse({ description: 'Invalid pagination parameters' })
  async getLeaderboard(
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    if (limit < 1 || limit > 1000) {
      throw new HttpException(
        'Limit must be between 1 and 1000',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (offset < 0 || offset > 100000) {
      throw new HttpException(
        'Offset must be between 0 and 100000',
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.apiService.getLeaderboard(limit, offset);
  }

  @Get('leaderboard/:address')
  @ApiOperation({
    summary: 'Get user position in leaderboard',
  })
  @ApiParam({
    name: 'address',
    description: 'Ethereum address of the user',
    example: '0x1234abcd5678ef901234abcd5678ef901234abcd',
  })
  @ApiOkResponse({
    type: LeaderboardEntryDto,
    description: 'User statistics',
  })
  @ApiBadRequestResponse({ description: 'Invalid address format' })
  @ApiNotFoundResponse({ description: 'User not found' })
  async getUserLeaderboardData(@Param('address') address: string) {
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      throw new HttpException('Invalid address format', HttpStatus.BAD_REQUEST);
    }
    const data = await this.apiService.getUserLeaderboardData(address);
    if (!data) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    return data;
  }

  @Get('referrals/:address')
  @ApiOperation({
    summary: 'Get user referrals',
  })
  @ApiParam({
    name: 'address',
    description: 'Ethereum address of the referrer',
    example: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
  })
  @ApiOkResponse({
    type: UserReferralDto,
    isArray: true,
    description: 'Referrals and reward statistics',
  })
  @ApiBadRequestResponse({ description: 'Invalid address format' })
  async getUserReferrals(@Param('address') address: string) {
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      throw new HttpException('Invalid address format', HttpStatus.BAD_REQUEST);
    }
    return this.apiService.getUserReferrals(address);
  }

  @Get('tvl-chart')
  @ApiOperation({
    summary: 'Get TVL chart',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of points (1-10000)',
    example: 1000,
  })
  @ApiQuery({
    name: 'from',
    required: false,
    type: String,
    schema: {
      type: 'string',
      format: 'date-time',
    },
    description: 'Start date (ISO format)',
    example: '2025-01-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    type: String,
    schema: {
      type: 'string',
      format: 'date-time',
    },
    description: 'End date (ISO format)',
    example: '2025-01-31T23:59:59.000Z',
  })
  @ApiOkResponse({
    type: TvlDataPointDto,
    isArray: true,
    description: 'TVL snapshots for the selected range',
  })
  @ApiBadRequestResponse({ description: 'Invalid query parameters' })
  async getTvlChart(
    @Query('limit', new DefaultValuePipe(1000), ParseIntPipe) limit: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (limit < 1 || limit > 10000) {
      throw new HttpException(
        'Limit must be between 1 and 10000',
        HttpStatus.BAD_REQUEST,
      );
    }

    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;

    if (fromDate && isNaN(fromDate.getTime())) {
      throw new HttpException(
        'Invalid from date format',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (toDate && isNaN(toDate.getTime())) {
      throw new HttpException('Invalid to date format', HttpStatus.BAD_REQUEST);
    }

    return this.apiService.getTvlChart(fromDate, toDate, limit);
  }

  @Get('total-value-locked')
  @ApiOperation({
    summary: 'Get Total Value Locked',
    description: 'Returns cumulative total of all deposits that entered the contract',
  })
  @ApiOkResponse({
    type: TotalValueLockedDto,
    description: 'Total Value Locked (cumulative deposits)',
  })
  async getTotalValueLocked() {
    return this.apiService.getTotalValueLocked();
  }
}
