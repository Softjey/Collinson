import { SpanStatusCode, trace } from '@opentelemetry/api';
import { tracing } from '@opentelemetry/sdk-node';
import { GraphQLError } from 'graphql';
import { GraphQLTracingPlugin } from '../graphql-tracing.plugin.js';

const spanExporter = new tracing.InMemorySpanExporter();

beforeAll(() => {
  trace.setGlobalTracerProvider(
    new tracing.BasicTracerProvider({ spanProcessors: [new tracing.SimpleSpanProcessor(spanExporter)] }),
  );
});

beforeEach(() => spanExporter.reset());

async function run(
  listenerCalls: (listener: Awaited<ReturnType<GraphQLTracingPlugin['requestDidStart']>>) => Promise<void>,
) {
  const listener = await new GraphQLTracingPlugin().requestDidStart();
  await listenerCalls(listener);
  return spanExporter.getFinishedSpans();
}

describe('GraphQLTracingPlugin', () => {
  it('records one span per request named after the operation, with its type and name', async () => {
    const spans = await run(async (listener) => {
      await listener.didResolveOperation?.({
        operationName: 'RankDays',
        operation: { operation: 'query' },
      } as never);
      await listener.willSendResponse?.({} as never);
    });

    expect(spans).toHaveLength(1);
    expect(spans[0].name).toBe('graphql query RankDays');
    expect(spans[0].attributes).toMatchObject({
      'graphql.operation.type': 'query',
      'graphql.operation.name': 'RankDays',
    });
    expect(spans[0].status.code).toBe(SpanStatusCode.UNSET);
  });

  it('names a span of an anonymous operation by its type only', async () => {
    const spans = await run(async (listener) => {
      await listener.didResolveOperation?.({
        operationName: null,
        operation: { operation: 'mutation' },
      } as never);
      await listener.willSendResponse?.({} as never);
    });

    expect(spans[0].name).toBe('graphql mutation');
    expect(spans[0].attributes).not.toHaveProperty('graphql.operation.name');
  });

  it('marks the span as failed and records the errors', async () => {
    const spans = await run(async (listener) => {
      await listener.didEncounterErrors?.({ errors: [new GraphQLError('boom')] } as never);
      await listener.willSendResponse?.({} as never);
    });

    expect(spans[0].status.code).toBe(SpanStatusCode.ERROR);
    expect(spans[0].events.filter((event) => event.name === 'exception')).toHaveLength(1);
  });

  it('keeps the default name when the request fails before an operation is resolved', async () => {
    const spans = await run(async (listener) => {
      await listener.willSendResponse?.({} as never);
    });

    expect(spans[0].name).toBe('graphql request');
  });

  it('ends no span before the response is sent', async () => {
    await run(async (listener) => {
      await listener.didResolveOperation?.({
        operationName: 'A',
        operation: { operation: 'query' },
      } as never);
    });

    expect(spanExporter.getFinishedSpans()).toHaveLength(0);
  });
});
