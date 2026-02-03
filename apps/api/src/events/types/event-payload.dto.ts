import { ApiProperty } from '@nestjs/swagger';

export class EventPayload {
  @ApiProperty({
    example: 'user:update',
    description:
      'Event type (e.g. user:update, tvl:update)',
  })
  type!: string;

  @ApiProperty({
    description: 'Arbitrary event payload',
    type: 'object',
    additionalProperties: true,
    example: {
      address: '0x1234abcd5678ef901234abcd5678ef901234abcd',
      weekStart: '2025-01-13T00:00:00.000Z',
    },
  })
  data!: Record<string, unknown>;
}

export const isEventPayload = (value: unknown): value is EventPayload => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.type === 'string' &&
    typeof candidate.data === 'object' &&
    candidate.data !== null
  );
};
