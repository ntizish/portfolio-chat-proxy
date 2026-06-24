import Anthropic from "@anthropic-ai/sdk"
import { Latitude, capture } from "@latitude-data/telemetry"

const apiKey = process.env.LATITUDE_API_KEY
const project = process.env.LATITUDE_PROJECT_SLUG

export const latitude =
    apiKey && project
        ? new Latitude({
              apiKey,
              project,
              // Pass the Anthropic class — the SDK's CJS entry is a callable module object that breaks instrumentation.
              instrumentations: { anthropic: Anthropic },
          })
        : null

export { capture }
