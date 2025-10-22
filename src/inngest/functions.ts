import { Sandbox } from "@e2b/code-interpreter";
import { openai, createAgent } from "@inngest/agent-kit";
import { inngest } from "./client";
import { getSandbox } from "./utils";

export const helloWorld = inngest.createFunction(
  { id: "hello-world" },
  { event: "test/hello.world" },
  async ({ event , step }) => {

    const sandboxId = await step.run("get-sandbox-id" , async ()=>{
      const sandbox = Sandbox.create("vibe-nextjs-kaif-123-2");
      return (await sandbox).sandboxId;
    });

    const codeAgent = createAgent({
  name: "code-agent",
  system: "You are an expert next.js developer. You write readable, maintainable code. you write simple Next.js & React snippets.",
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


    const { output } = await codeAgent.run(
      `write the following snippet: ${event.data.value}`
    );
    
     const sandboxUrl = await step.run("get-sandbox-url" , async()=>{
         const sandbox = getSandbox(sandboxId);
         const host = (await sandbox).getHost(3000)
         return `https://${host}`; 
     });

    return { output , sandboxUrl };
  }
);
