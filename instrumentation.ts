import { registerOTel } from '@vercel/otel'

/**
 * Next.js 16 instrumentation hook. Registers OTel before any other code runs.
 *
 * Vercel's runtime forwards traces to its log drains automatically; for
 * external OTel collectors, configure OTEL_EXPORTER_OTLP_ENDPOINT.
 */
export function register() {
  registerOTel({
    serviceName: 'aig',
  })
}
