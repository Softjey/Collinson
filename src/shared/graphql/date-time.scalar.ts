import { Scalar, type CustomScalar } from '@nestjs/graphql';
import { GraphQLError, Kind, type ValueNode } from 'graphql';

const UTC_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

@Scalar('DateTime')
export class DateTimeScalar implements CustomScalar<string, Date> {
  serialize(value: unknown): string {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      throw new GraphQLError('DateTime cannot represent a value that is not a valid Date');
    }
    return value.toISOString();
  }

  parseValue(value: unknown): Date {
    if (typeof value !== 'string' || !UTC_ISO_PATTERN.test(value)) {
      throw new GraphQLError('DateTime must be an ISO 8601 string in UTC, for example 2026-10-13T08:30:00Z');
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value.slice(0, 10)) {
      throw new GraphQLError('DateTime must be a valid instant');
    }
    return date;
  }

  parseLiteral(ast: ValueNode): Date {
    if (ast.kind !== Kind.STRING) {
      throw new GraphQLError('DateTime must be an ISO 8601 string in UTC');
    }
    return this.parseValue(ast.value);
  }
}
