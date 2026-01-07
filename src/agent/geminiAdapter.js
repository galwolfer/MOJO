import fetch from "node-fetch";
import { config } from "../config/env.js";

/**
 * GeminiAdapter - lightweight Gemini API helper
 *
 * Notes (restored):
 * - Purpose: small, defensive wrapper around the Gemini REST API used
 *   for direct calls, debugging, and in environments where we opt out
 *   of LangChain for rapid prototyping.
 * - Relationship to LangChain: the project prefers `ChatGoogleGenerativeAI`.
 *   Keep this adapter for low-level access, feature testing, or when
 *   function-calling needs more explicit control.
 * - Function-calls: this adapter encodes assistant function-calls and
 *   function responses into Gemini's content parts. When adding tools,
 *   pass a `tools` array of function declarations to `generateContent`.
 * - Error handling: callers should surface Gemini errors to observability;
 *   this wrapper throws on HTTP errors and attempts to surface useful logs.
 * - JSON heuristics: messages that carry `function` responses may be
 *   stringified JSON; `convertMessagesToGeminiFormat` attempts a best-effort
 *   JSON.parse and falls back to raw strings. This preserves older data.
 * - Rate limits & usage: keep `maxOutputTokens` conservative in production
 *   and surface `usageMetadata` returned by Gemini for billing/monitoring.
 * - Migration note: this file was previously replaced with a minimal
 *   implementation that removed extended comments. Those notes were
 *   intentionally restored to aid future maintainers.
 */
export class GeminiAdapter {
  // Store API key and model. Keep this constructor minimal so the
  // adapter is easy to instantiate in tests and lightweight runners.
  // - `apiKey`: Google API key with access to the Generative Language API.
  // - `model`: override default model name for testing or staging.
  constructor(apiKey, model = config.geminiModel || "gemini-2.5-flash") {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = "https://generativelanguage.googleapis.com/v1beta/models";
  }

  async generateContent(messages, tools = null) {
    // Build the endpoint URL and convert our messages into Gemini's
    // `contents` shape. We keep auth as a simple API key for now; if
    // you need OAuth or a different flow, replace this construction.
    const url = `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`;
    const contents = this.convertMessagesToGeminiFormat(messages);

    // The request body follows Gemini's `generateContent` schema. Tune
    // `generationConfig` for production constraints (latency, cost,
    // truncation behavior).
    const requestBody = {
      contents,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 768,
      },
    };

    // Attach tool (function) declarations when present so the model can
    // return function-calling payloads. `tools` should be an array of
    // declarations compatible with the project's function-calling helpers.
    if (tools && tools.length > 0) {
      requestBody.tools = [{ functionDeclarations: tools }];
    }

    // Perform a single HTTP request. We intentionally do not perform
    // automatic retries here; callers can wrap this method if they need
    // exponential backoff or idempotent retry behavior.
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      // Surface the HTTP body in the thrown error to aid debugging.
      const txt = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${txt}`);
    }

    const json = await response.json();

    // Warn when models terminate due to `MAX_TOKENS` so callers can
    // adjust token budgets or handle partial responses.
    try {
      const candidate = json?.candidates?.[0];
      if (candidate && candidate.finishReason === "MAX_TOKENS") {
        console.warn("GeminiAdapter.generateContent: model finished with MAX_TOKENS");
      }
    } catch (e) {
      // Defensive: parsing issues in auxiliary checks should not hide
      // the successful JSON response.
    }

    // Return the raw Gemini JSON. Use `extractResponse` to convert to a
    // normalized `{ type, text|functionCall }` shape used across the app.
    return json;
  }

  convertMessagesToGeminiFormat(messages) {
    // Map our internal message shape to Gemini's `contents.parts` shape.
    // The mapping is intentionally conservative to avoid losing data
    // when messages come from mixed sources (stringified functions,
    // older clients, etc.).
    return messages.map((msg) => {
      if (msg.role === "system") {
        // Some Gemini endpoints do not expose a distinct `system` role,
        // so we prefix system content into a user text part to preserve
        // instruction visibility.
        return { role: "user", parts: [{ text: `[System]: ${msg.content}` }] };
      }

      if (msg.role === "assistant" && msg.functionCall) {
        // The assistant intends to call a function; encode the call so
        // the model's tools/function-calling pipeline can be activated.
        return { role: "model", parts: [{ functionCall: msg.functionCall }] };
      }

      if (msg.role === "function") {
        // Function responses may be structured (objects) or JSON
        // serialized into strings. Attempt to parse string responses so
        // downstream consumers can operate on objects when possible.
        let responseContent = msg.content;
        if (typeof responseContent === "string") {
          try {
            responseContent = JSON.parse(responseContent);
          } catch (e) {
            // Parsing failed; keep original string to avoid dropping data.
          }
        }

        return {
          role: "function",
          parts: [{ functionResponse: { name: msg.name, response: responseContent } }],
        };
      }

      // Default: map assistant->model and user->user with a text part.
      return { role: msg.role === "assistant" ? "model" : "user", parts: [{ text: msg.content }] };
    });
  }

  extractResponse(geminiResponse) {
    // Prefer the first candidate when present; handle both `candidates`
    // array and single `candidate` shapes defensively.
    const candidate = geminiResponse?.candidates?.[0] || geminiResponse?.candidate || null;
    if (!candidate) {
      console.error("GeminiAdapter.extractResponse: no candidate found", JSON.stringify(geminiResponse, null, 2));
      throw new Error("No candidate in Gemini response");
    }

    // Expose a special `max_tokens` shape when the model truncated the
    // response due to token limits so callers can handle retries.
    if (candidate.finishReason === "MAX_TOKENS") {
      return { type: "max_tokens", candidate, usageMetadata: geminiResponse.usageMetadata };
    }

    // Candidates may include `content.parts`, a `content.text`, or a
    // top-level `text` field. Prefer parts when available.
    let part = null;
    if (candidate.content?.parts && candidate.content.parts.length > 0) {
      part = candidate.content.parts[0];
    } else if (candidate.content && typeof candidate.content === "object" && candidate.content.text) {
      part = { text: candidate.content.text };
    } else if (candidate.text) {
      part = { text: candidate.text };
    }

    if (!part) {
      console.error("GeminiAdapter.extractResponse: no part found", JSON.stringify(candidate, null, 2));
      throw new Error("No parts in Gemini response");
    }

    // Normalize the return shape for the rest of the application.
    if (part.functionCall) return { type: "function_call", functionCall: part.functionCall };
    if (part.text) return { type: "text", text: part.text };

    console.error("GeminiAdapter.extractResponse: unknown part shape", JSON.stringify(part, null, 2));
    throw new Error("Unknown response type from Gemini");
  }
}
