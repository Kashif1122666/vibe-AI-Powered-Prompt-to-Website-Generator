import { Sandbox } from "@e2b/code-interpreter";
import { openai, createAgent, createTool, createNetwork, type Tool, type Message, createState } from "@inngest/agent-kit";
import { FRAGMENT_TITLE_PROMPT, PROMPT , RESPONSE_PROMPT} from "@/prompt";
import { prisma } from "@/lib/db";
import { inngest } from "./client";
import { getSandbox, lastAssitantTextMessageContent, parseAgentOuput } from "./utils";
import { z } from "zod";
import { SANDBOX_TIMEOUT } from "./types";


interface AgentState {
  summary: string;
  files: { [path: string]: string};
}





export const codeAgentFunction = inngest.createFunction(
  { id: "code-agent" },
  { event: "code-agent/run" },
  async ({ event, step }) => {

    const sandboxId = await step.run("get-sandbox-id", async () => {
      const sandbox = Sandbox.create("vibe-nextjs-kaif-123-2");
      (await sandbox).setTimeout(SANDBOX_TIMEOUT);
      return (await sandbox).sandboxId;
    });

    const PreviousMessages = await step.run("get-previous-messages",async ()=>{
       const  formattedMessages : Message[] = [];
       const  messages = await  prisma.message.findMany({
        where:{
          projectId : event.data.projectId,
        },
        orderBy : {
          createdAt:"desc"
        },
        take : 5,
       });
       
       for(const message of messages){
          formattedMessages.push({
             type : "text",
             role :  message.role === "ASSISTANT" ? "assistant" : "user",
             content :  message.content,
          });
       }

       return  formattedMessages.reverse();
    });

    const state  = createState<AgentState>(
      {
        summary:"",
        files : {},
    },
    {
      messages : PreviousMessages,
    },
  );

    const codeAgent = createAgent<AgentState>({
      name: "code-agent",
      description: "An expert coding agent",
      system: PROMPT,

      model: openai({
        model: "gpt-4.1",
        defaultParameters: {
          temperature: 0.1,
        },
      }),

      tools: [
        createTool({
          name: "terminal",
          description: "Use the terminal to run commands",
          parameters: z.object({ command: z.string() }),
          handler: async ({ command }, { step }) => {
            return await step?.run("terminal", async () => {
              const buffer = { stdout: "", stderr: "" };
              try {
                const sandbox = await getSandbox(sandboxId);
                const result = await sandbox.commands.run(command, {
                  onStdout: (data) => {
                    buffer.stdout += data;
                  },
                  onStderr: (data) => {
                    buffer.stderr += data;
                  },
                });
                return result.stdout;
              } catch (e) {
                console.error(
                  `Command failed: ${e} \n stdout: ${buffer.stdout} \n stderr: ${buffer.stderr}`
                );
                return `Command failed: ${e} \n stdout: ${buffer.stdout} \n stderr: ${buffer.stderr}`;
              }
            });
          },
        }),
        createTool({
  name: "createOrUpdateFiles",
  description: "Create or update files in the sandbox with debug logs",
  parameters: z.object({
    files: z.array(
      z.object({ path: z.string(), content: z.string() })
    ),
  }),
  handler: async ({ files }, { step, network }:  Tool.Options<AgentState>) => {
    const newFiles = await step!.run("createOrUpdateFiles", async () => {
      const updatedFiles = network.state.data.files || {};
      const sandbox = await getSandbox(sandboxId);

      try {

        for (const file of files) {
          try {
            await sandbox.files.write(file.path, file.content);
            updatedFiles[file.path] = file.content;
          } catch (fileError) {
            console.error(`❌ Failed writing file: ${file.path}`, fileError);
          }

          // Optional: slight delay to prevent rapid-fire issues
          // await new Promise((r) => setTimeout(r, 100));
        }

        return updatedFiles;
      } catch (e: unknown) {
  const errMsg = e instanceof Error ? e.message : String(e);
  return { error: errMsg };
}
    });

    if (typeof newFiles === "object") {
      network.state.data.files = newFiles;
    }
  },
}),
        createTool({
          name: "readFiles",
          description: "Read files from the sandbox",
          parameters: z.object({ files: z.array(z.string()) }),
          handler: async ({ files }, { step }) => {
            return await step?.run("readFiles", async () => {
              try {
                const sandbox = await getSandbox(sandboxId);
                const contents = [];
                for (const file of files) {
                  const content = await sandbox.files.read(file);
                  contents.push({ path: file, content });
                }
                return JSON.stringify(contents);
              } catch (e) {
                return "Error: " + e;
              }
            });
          },
        }),
      ],

      lifecycle: {
        onResponse: async ({ result, network }) => {
          const lastAssitantMessageText = lastAssitantTextMessageContent(result);
          if (lastAssitantMessageText && network) {
            if (lastAssitantMessageText.includes("<task_summary>")) {
              network.state.data.summary = lastAssitantMessageText;
            }
          }
          return result;
        },
      },
    });



    const network = createNetwork<AgentState>({
      name: "coding-agent-network",
      agents: [codeAgent],
      maxIter: 15,
      defaultState: state ,
      router: async ({ network }) => {
        const summary = network.state.data.summary;
        if (summary) {
          return;
        }
        return codeAgent;
      },
    });

    const result = await network.run(event.data.value , {state});
    const fragmentTitleGenerator = createAgent({
          name: "fragment-title-generator",
      description: "A fragment title generator",
      system: FRAGMENT_TITLE_PROMPT,

      model: openai({
        model: "gpt-4o",
      }),
    });
    const responseGenerator = createAgent({
          name: "response-generator",
      description: "A response generator",
      system: RESPONSE_PROMPT,

      model: openai({
        model: "gpt-4o",
      }),
    });

    const {output : fragmentTitleOutput} = await fragmentTitleGenerator.run(result.state.data.summary);
    const {output : responseOutput} = await responseGenerator.run(result.state.data.summary);

    
    


    const isError = 
      !result.state.data.summary ||
      Object.keys(result.state.data.files || {}).length === 0;
    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      const sandbox = getSandbox(sandboxId);
      const host = (await sandbox).getHost(3000);
      return `https://${host}`;
    });

    await step.run("save-result", async () => {
           if (isError) {
            return await prisma.message.create({
                    data: {
                      projectId:event.data.projectId,
                      content: "Something went wrong . Please try again.",
                      role: "ASSISTANT",
                      type: "ERROR",
                    },
            });
           }
           return  await prisma.message.create({
      data: {
        projectId : event.data.projectId,
        content:parseAgentOuput(responseOutput),
        role: "ASSISTANT",
        type: "RESULT",
        fragment: {
          create:{
            sandboxUrl: sandboxUrl,
            title: parseAgentOuput(fragmentTitleOutput),
            files: result.state.data.files,
          },
        }
      },
           })
    });

    return {
      url: sandboxUrl,
      title: "Fragment",
      files: result.state.data.files,
      summary: result.state.data.summary,
    };
  }
);
