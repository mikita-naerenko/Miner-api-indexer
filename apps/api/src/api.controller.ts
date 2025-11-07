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
  ApiMessageDto,
  LeaderboardEntryDto,
  TvlDataPointDto,
  UserReferralDto,
  WeeklyCompoundEntryDto,
} from './dto/api.dto';

@ApiTags('DApp API')
@Controller('api')
export class ApiController {
  constructor(
    private readonly apiService: ApiService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Get('leaderboard')
  @ApiOperation({ summary: 'Получить лидерборд пользователей' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Количество записей (1-1000)',
    example: 100,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Смещение для пагинации (0-100000)',
    example: 0,
  })
  @ApiOkResponse({
    type: LeaderboardEntryDto,
    isArray: true,
    description: 'Список пользователей с ранжированием по totalDeposited',
  })
  @ApiBadRequestResponse({ description: 'Некорректные параметры пагинации' })
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
    summary: 'Получить позицию пользователя в лидерборде',
  })
  @ApiParam({
    name: 'address',
    description: 'Ethereum адрес пользователя',
    example: '0x1234abcd5678ef901234abcd5678ef901234abcd',
  })
  @ApiOkResponse({
    type: LeaderboardEntryDto,
    description: 'Статистика пользователя',
  })
  @ApiBadRequestResponse({ description: 'Некорректный формат адреса' })
  @ApiNotFoundResponse({ description: 'Пользователь не найден' })
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
    summary: 'Получить список рефералов пользователя',
  })
  @ApiParam({
    name: 'address',
    description: 'Ethereum адрес реферера',
    example: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
  })
  @ApiOkResponse({
    type: UserReferralDto,
    isArray: true,
    description: 'Рефералы и статистика по вознаграждениям',
  })
  @ApiBadRequestResponse({ description: 'Некорректный формат адреса' })
  async getUserReferrals(@Param('address') address: string) {
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      throw new HttpException('Invalid address format', HttpStatus.BAD_REQUEST);
    }
    return this.apiService.getUserReferrals(address);
  }

  @Get('weekly-compound-ranking')
  @ApiOperation({
    summary: 'Получить еженедельный рейтинг по компаундам',
  })
  @ApiQuery({
    name: 'weekStart',
    required: false,
    type: String,
    schema: {
      type: 'string',
      format: 'date-time',
    },
    description:
      'Дата начала недели (ISO). Если не указана, используется текущая неделя',
    example: '2025-01-13T00:00:00.000Z',
  })
  @ApiOkResponse({
    type: WeeklyCompoundEntryDto,
    isArray: true,
    description: 'Рейтинг пользователей за указанную неделю',
  })
  @ApiBadRequestResponse({ description: 'Некорректный формат даты' })
  async getWeeklyCompoundRanking(@Query('weekStart') weekStart?: string) {
    const date = weekStart ? new Date(weekStart) : undefined;
    if (date && isNaN(date.getTime())) {
      throw new HttpException(
        'Invalid weekStart date format',
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.apiService.getWeeklyCompoundRanking(date);
  }

  @Get('weekly-compound-ranking/:address')
  @ApiOperation({
    summary: 'Получить позицию пользователя в еженедельном рейтинге',
  })
  @ApiParam({
    name: 'address',
    description: 'Ethereum адрес пользователя',
    example: '0xfeedfeedfeedfeedfeedfeedfeedfeedfeedfeed',
  })
  @ApiQuery({
    name: 'weekStart',
    required: false,
    type: String,
    schema: {
      type: 'string',
      format: 'date-time',
    },
    description:
      'Дата начала недели (ISO). Если не указана, используется текущая неделя',
    example: '2025-01-13T00:00:00.000Z',
  })
  @ApiOkResponse({ type: WeeklyCompoundEntryDto })
  @ApiBadRequestResponse({ description: 'Некорректный формат параметров' })
  @ApiNotFoundResponse({ description: 'Позиция пользователя не найдена' })
  async getUserWeeklyRanking(
    @Param('address') address: string,
    @Query('weekStart') weekStart?: string,
  ) {
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      throw new HttpException('Invalid address format', HttpStatus.BAD_REQUEST);
    }
    const date = weekStart ? new Date(weekStart) : undefined;
    if (date && isNaN(date.getTime())) {
      throw new HttpException(
        'Invalid weekStart date format',
        HttpStatus.BAD_REQUEST,
      );
    }
    const data = await this.apiService.getUserWeeklyRanking(address, date);
    if (!data) {
      throw new HttpException('User ranking not found', HttpStatus.NOT_FOUND);
    }
    return data;
  }

  @Get('tvl-chart')
  @ApiOperation({
    summary: 'Получить TVL график',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Максимальное количество точек (1-10000)',
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
    description: 'Начальная дата (ISO формат)',
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
    description: 'Конечная дата (ISO формат)',
    example: '2025-01-31T23:59:59.000Z',
  })
  @ApiOkResponse({
    type: TvlDataPointDto,
    isArray: true,
    description: 'Снимки TVL по заданному диапазону',
  })
  @ApiBadRequestResponse({ description: 'Некорректные параметры запроса' })
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

  @Get('update-weekly-rankings')
  @ApiOperation({
    summary: 'Принудительно пересчитать ранги за текущую неделю',
  })
  @ApiOkResponse({ type: ApiMessageDto })
  async updateWeeklyRankings() {
    await this.apiService.updateWeeklyRankings();
    return { message: 'Weekly rankings updated successfully' };
  }
}
