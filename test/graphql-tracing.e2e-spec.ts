import { trace } from '@opentelemetry/api';
import { tracing } from '@opentelemetry/sdk-node';
import { graphqlRequest, useTestApp } from './support/app.js';
import { useTestDatabase } from './support/database.js';
import { loadFixture } from './support/fixtures.js';
import { SEARCH_LOCATIONS } from './support/queries.js';

const spanExporter = new tracing.InMemorySpanExporter();

describe('GraphQL tracing', () => {
  const testApp = useTestApp();
  useTestDatabase();

  beforeAll(() => {
    trace.setGlobalTracerProvider(
      new tracing.BasicTracerProvider({ spanProcessors: [new tracing.SimpleSpanProcessor(spanExporter)] }),
    );
  });

  beforeEach(() => spanExporter.reset());

  it('records a span for a GraphQL request', async () => {
    testApp.openMeteo.respond('geocoding', loadFixture('search/geocoding-zakopane.json'));

    await graphqlRequest(testApp, SEARCH_LOCATIONS, { name: 'Zakopane', count: 2 });

    const spanNames = spanExporter.getFinishedSpans().map((span) => span.name);
    expect(spanNames).toContain('graphql query');
  });

  it('records a failed span for a GraphQL request with a validation error', async () => {
    await graphqlRequest(testApp, SEARCH_LOCATIONS, { name: '' });

    const span = spanExporter.getFinishedSpans().find((candidate) => candidate.name.startsWith('graphql'));
    expect(span?.status.code).toBe(2);
  });
});
