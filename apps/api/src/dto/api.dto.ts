import { ApiProperty } from '@nestjs/swagger';

export class LeaderboardEntryDto {
  @ApiProperty({ example: 1 })
  rank!: number;

  @ApiProperty({ example: '0x1234abcd5678ef901234abcd5678ef901234abcd' })
  address!: string;

  @ApiProperty({
    example: '150.42',
    description: 'Total deposited amount (stringified Decimal)',
  })
  totalDeposited!: string;

  @ApiProperty({
    example: '50.00',
    description: 'Total withdrawn amount (stringified Decimal)',
  })
  totalWithdrawn!: string;

  @ApiProperty({
    example: '75.12',
    description: 'Total compounded amount (stringified Decimal)',
  })
  totalCompounded!: string;

  @ApiProperty({ example: 12 })
  totalCompoundCount!: number;

  @ApiProperty({
    example: '24.5',
    description: 'Referral earnings in contract units (stringified Decimal)',
  })
  referralEarningsUnits!: string;

  @ApiProperty({
    example: '2025-01-15T10:30:00.000Z',
    nullable: true,
    description: 'ISO timestamp of last activity',
    format: 'date-time',
  })
  lastActiveAt!: string | null;
}

export class UserReferralDto {
  @ApiProperty({ example: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' })
  referee!: string;

  @ApiProperty({
    example: '12.75',
    description: 'Total reward units as string',
  })
  totalUnitsRewarded!: string;

  @ApiProperty({
    example: '2025-01-15T10:30:00.000Z',
    nullable: true,
    format: 'date-time',
  })
  lastRewardAt!: string | null;

  @ApiProperty({ example: 5 })
  totalRewards!: number;
}

export class WeeklyCompoundEntryDto {
  @ApiProperty({ example: 3 })
  rank!: number;

  @ApiProperty({ example: '0xfeedfeedfeedfeedfeedfeedfeedfeedfeedfeed' })
  address!: string;

  @ApiProperty({ example: 42 })
  compoundCount!: number;

  @ApiProperty({
    example: '123.456',
    description: 'Total compounded amount as string',
  })
  totalCompounded!: string;
}

export class TvlDataPointDto {
  @ApiProperty({
    example: '2025-01-15T10:30:00.000Z',
    description: 'ISO timestamp of snapshot',
    format: 'date-time',
  })
  timestamp!: string;

  @ApiProperty({
    example: '1000.5',
    description: 'Total value locked in ETH (string)',
  })
  tvl!: string;
}

export class ApiMessageDto {
  @ApiProperty({ example: 'Weekly rankings updated successfully' })
  message!: string;
}
