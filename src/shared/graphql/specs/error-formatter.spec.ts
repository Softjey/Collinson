import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GraphQLError } from 'graphql';
import { formatGraphQLError } from '.././error-formatter.js';

function formatted(extensions: Record<string, unknown>, message = 'boom') {
  return { message, extensions };
}

describe('formatGraphQLError', () => {
  it('marks a validation pipe failure as BAD_USER_INPUT and keeps its messages', () => {
    const original = new BadRequestException({
      message: ['latitude must not be greater than 90'],
      error: 'Bad Request',
      statusCode: 400,
    });
    const error = new GraphQLError('Bad Request Exception', { originalError: original });

    const result = formatGraphQLError(formatted({ code: 'INTERNAL_SERVER_ERROR' }, error.message), error);

    expect(result.extensions?.code).toBe('BAD_USER_INPUT');
    expect(result.message).toBe('latitude must not be greater than 90');
  });

  it('joins several validation messages', () => {
    const original = new BadRequestException({ message: ['a is wrong', 'b is wrong'] });
    const error = new GraphQLError('Bad Request Exception', { originalError: original });

    const result = formatGraphQLError(formatted({ code: 'INTERNAL_SERVER_ERROR' }), error);

    expect(result.message).toBe('a is wrong; b is wrong');
  });

  it('keeps errors that GraphQL itself classifies as user input errors', () => {
    const error = new GraphQLError('Variable "$x" got invalid value');

    const result = formatGraphQLError(
      formatted({ code: 'BAD_USER_INPUT' }, 'Variable "$x" got invalid value'),
      error,
    );

    expect(result.extensions?.code).toBe('BAD_USER_INPUT');
    expect(result.message).toBe('Variable "$x" got invalid value');
  });

  it('keeps GRAPHQL_VALIDATION_FAILED errors', () => {
    const error = new GraphQLError('Cannot query field "x"');

    const result = formatGraphQLError(
      formatted({ code: 'GRAPHQL_VALIDATION_FAILED' }, 'Cannot query field "x"'),
      error,
    );

    expect(result.extensions?.code).toBe('GRAPHQL_VALIDATION_FAILED');
  });

  it('hides the internals of an unexpected error', () => {
    const error = new GraphQLError('connect ECONNREFUSED 10.0.0.5:5432', {
      originalError: new Error('connect ECONNREFUSED 10.0.0.5:5432'),
    });

    const result = formatGraphQLError(
      formatted({ code: 'INTERNAL_SERVER_ERROR', stacktrace: ['at secret.ts'] }, error.message),
      error,
    );

    expect(result.message).toBe('Internal server error');
    expect(result.extensions).toEqual({ code: 'INTERNAL_SERVER_ERROR' });
  });

  it('does not treat other HTTP exceptions as user input errors', () => {
    const error = new GraphQLError('Not Found', { originalError: new NotFoundException() });

    const result = formatGraphQLError(formatted({ code: 'INTERNAL_SERVER_ERROR' }, 'Not Found'), error);

    expect(result.extensions?.code).toBe('INTERNAL_SERVER_ERROR');
    expect(result.message).toBe('Internal server error');
  });

  it('passes through an error with an explicit service code', () => {
    const error = new GraphQLError('Place search is unavailable', {
      extensions: { code: 'SERVICE_UNAVAILABLE' },
    });

    const result = formatGraphQLError(
      formatted({ code: 'SERVICE_UNAVAILABLE' }, 'Place search is unavailable'),
      error,
    );

    expect(result.extensions?.code).toBe('SERVICE_UNAVAILABLE');
    expect(result.message).toBe('Place search is unavailable');
  });
});
