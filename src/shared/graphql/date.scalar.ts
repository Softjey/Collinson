import { Scalar, type CustomScalar } from '@nestjs/graphql';
import { GraphQLError, Kind, type ValueNode } from 'graphql';
import { isValidLocalDate } from './local-date.js';

@Scalar('Date')
export class DateScalar implements CustomScalar<string, string> {
  description = 'A calendar date without a time, YYYY-MM-DD.';

  serialize(value: unknown): string {
    return this.validate(value);
  }

  parseValue(value: unknown): string {
    return this.validate(value);
  }

  parseLiteral(ast: ValueNode): string {
    if (ast.kind !== Kind.STRING) {
      throw new GraphQLError('Date must be a string in the format YYYY-MM-DD');
    }
    return this.validate(ast.value);
  }

  private validate(value: unknown): string {
    if (typeof value !== 'string' || !isValidLocalDate(value)) {
      throw new GraphQLError('Date must be a valid calendar date in the format YYYY-MM-DD');
    }
    return value;
  }
}
