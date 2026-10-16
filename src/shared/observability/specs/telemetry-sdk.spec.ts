import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { trace } from '@opentelemetry/api';
import { TelemetrySdk } from '../telemetry-sdk.js';

describe('TelemetrySdk', () => {
  let collector: Server;
  let collectorUrl: string;

  beforeAll(async () => {
    collector = createServer((_request, response) => response.writeHead(200).end('{}'));
    await new Promise<void>((resolve) => collector.listen(0, '127.0.0.1', resolve));
    collectorUrl = `http://127.0.0.1:${(collector.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise((resolve) => collector.close(resolve)));

  it('starts nothing when OpenTelemetry is disabled', () => {
    const sdk = TelemetrySdk.start({ enabled: false, endpoint: collectorUrl });

    expect(sdk).toBeNull();
    expect(trace.getTracer('test').startSpan('unrecorded').isRecording()).toBe(false);
  });

  it('starts the SDK when enabled, so spans are recorded', async () => {
    const sdk = TelemetrySdk.start({ enabled: true, endpoint: collectorUrl });

    try {
      expect(sdk).not.toBeNull();
      const span = trace.getTracer('test').startSpan('recorded');
      expect(span.isRecording()).toBe(true);
      span.end();
    } finally {
      await sdk?.shutdown();
    }
  });
});
