import { Plugin } from '@nestjs/apollo';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import type { ApolloServerPlugin, BaseContext, GraphQLRequestListener } from '@apollo/server';

const TRACER_NAME = 'weather-activity-ranker.graphql';

@Plugin()
export class GraphQLTracingPlugin implements ApolloServerPlugin {
  async requestDidStart(): Promise<GraphQLRequestListener<BaseContext>> {
    const span = trace.getTracer(TRACER_NAME).startSpan('graphql request');

    return {
      async didResolveOperation({ operationName, operation }) {
        const operationType = operation?.operation ?? 'unknown';
        span.updateName(`graphql ${operationType}${operationName ? ` ${operationName}` : ''}`);
        span.setAttribute('graphql.operation.type', operationType);
        if (operationName) {
          span.setAttribute('graphql.operation.name', operationName);
        }
      },
      async didEncounterErrors({ errors }) {
        errors.forEach((error) => span.recordException(error));
        span.setStatus({ code: SpanStatusCode.ERROR });
      },
      async willSendResponse() {
        span.end();
      },
    };
  }
}
