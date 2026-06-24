import * as AnthropicSDK from "@anthropic-ai/sdk"
import { Latitude, capture } from "@latitude-data/telemetry"

const apiKey = process.env.LATITUDE_API_KEY
const project = process.env.LATITUDE_PROJECT_SLUG

export const latitude =
    apiKey && project
        ? new Latitude({
              apiKey,
              project,
              instrumentations: { anthropic: AnthropicSDK },
          })
        : null

export { capture }
