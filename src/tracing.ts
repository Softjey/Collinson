import { register } from 'node:module';
import { parseEnv } from './shared/config/env.schema.js';

const { otel } = parseEnv(process.env);

if (otel.enabled) {
  // Lets the instrumentations patch ES modules, which this application is made of. It only affects modules loaded
  // after this call, so the SDK is imported afterwards.
  register('import-in-the-middle/hook.mjs', import.meta.url);
}

const { TelemetrySdk } = await import('./shared/observability/telemetry-sdk.js');
TelemetrySdk.start(otel);
