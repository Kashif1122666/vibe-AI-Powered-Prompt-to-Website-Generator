import { openai, createAgent } from "@inngest/agent-kit";
import { inngest } from "./client";

export const helloWorld = inngest.createFunction(
  { id: "hello-world" },
  { event: "test/hello.world" },
  async ({ event }) => {
    console.log("API key loaded:", !!process.env.OPENAI_API_KEY);

    const summarizer = createAgent({
  name: "summarizer",
  system: "You are an expert summarizer. You summarize in 2 words.",
  model: openai({
    model: "gpt-4o",
    baseUrl: "https://openrouter.ai/api/v1",
    // 👇 Cast to any to bypass TypeScript validation
    extraOptions: {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Inngest Summarizer",
      },
    },
  } as any), // ✅ cast fixes TypeScript error
});


    const { output } = await summarizer.run(
      `summarize the following text: ${event.data.value}`
    );

    console.log(output);
    return { output };
  }
);
