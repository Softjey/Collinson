import { BadRequestException } from '@nestjs/common';
import type { GraphQLFormattedError } from 'graphql';

const PASS_THROUGH_CODES = new Set([
  'BAD_USER_INPUT',
  'GRAPHQL_VALIDATION_FAILED',
  'GRAPHQL_PARSE_FAILED',
  'SERVICE_UNAVAILABLE',
]);

export function formatGraphQLError(formatted: GraphQLFormattedError, error: unknown): GraphQLFormattedError {
  const original = (error as { originalError?: unknown })?.originalError;

  if (original instanceof BadRequestException) {
    return {
      message: validationMessage(original),
      extensions: { code: 'BAD_USER_INPUT' },
      ...(formatted.path ? { path: formatted.path } : {}),
      ...(formatted.locations ? { locations: formatted.locations } : {}),
    };
  }

  const code = formatted.extensions?.code;
  if (typeof code === 'string' && PASS_THROUGH_CODES.has(code)) {
    return { ...formatted, extensions: { code } };
  }

  return {
    message: 'Internal server error',
    extensions: { code: 'INTERNAL_SERVER_ERROR' },
    ...(formatted.path ? { path: formatted.path } : {}),
    ...(formatted.locations ? { locations: formatted.locations } : {}),
  };
}

function validationMessage(exception: BadRequestException): string {
  const response = exception.getResponse();
  if (typeof response === 'object' && response !== null && 'message' in response) {
    const { message } = response as { message: string | string[] };
    return Array.isArray(message) ? message.join('; ') : message;
  }
  return exception.message;
}
