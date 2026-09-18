import { OpenAIResponsesProvider } from "../supabase/functions/_shared/intelligence/live-semantic-reasoner.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("OpenAI provider retries a transient non-JSON 522 response and returns structured data", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls += 1;
    if (calls === 1) return new Response("upstream connection timed out", { status: 522 });
    return new Response(JSON.stringify({
      id: "resp_test",
      model: "test-model",
      output_text: JSON.stringify({ ok: true })
    }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };

  const provider = new OpenAIResponsesProvider({
    apiKey: "test-key",
    fetcher,
    maxAttempts: 2,
    retryDelayMs: 0
  });

  const response = await provider.generateStructured<{ ok: boolean }>({
    model: "test-model",
    system: "system",
    user: "user",
    schemaName: "test",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: { ok: { type: "boolean" } },
      required: ["ok"]
    }
  });

  assert(calls === 2, "provider should retry exactly once after transient 522");
  assert(response.data.ok === true, "second attempt should return structured payload");
});

Deno.test("OpenAI provider does not retry permanent 400 responses", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ error: { message: "bad request" } }), {
      status: 400,
      headers: { "content-type": "application/json" }
    });
  };

  const provider = new OpenAIResponsesProvider({
    apiKey: "test-key",
    fetcher,
    maxAttempts: 3,
    retryDelayMs: 0
  });

  let message = "";
  try {
    await provider.generateStructured({
      model: "test-model",
      system: "system",
      user: "user",
      schemaName: "test",
      schema: { type: "object" }
    });
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }

  assert(calls === 1, "permanent client error must not retry");
  assert(message.startsWith("MODEL_PROVIDER_HTTP_400:"), "400 error should remain visible");
});
