import { fileSearchTool, hostedMcpTool, Agent, AgentInputItem, Runner, withTrace } from "@openai/agents";
import { WORKFLOW_ID } from "@/lib/config";

export const runtime = "edge";

// Tool definitions
const fileSearch = fileSearchTool([
  "vs_6914604e9e048191906ca017d86702b9"
])

const mcp = hostedMcpTool({
  serverLabel: "Top_Notch_MCP",
  allowedTools: [
    "search_faq",
    "search_products",
    "get_categories",
    "scrape_product_details"
  ],
  requireApproval: "never",
  serverUrl: "https://d34fc96a4d8d.ngrok-free.app/sse"
})

const myAgent = new Agent({
  name: "My agent",
  instructions: `You are a helpful assistant for Top Notch Furnishers. Answer questions about furniture products and help customers with their inquiries. If you don't have specific information, provide helpful general guidance about furniture selection and customization.`,
  model: "gpt-5",
  tools: [
    fileSearch,
    mcp
  ],
  modelSettings: {
    reasoning: {
      effort: "low",
      summary: "auto"
    },
    store: true
  }
});

type WorkflowInput = { input_as_text: string, session_id: string };

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { input_as_text } = body as WorkflowInput;

    if (!input_as_text) {
      return new Response(JSON.stringify({ error: "input_as_text is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    console.log("Starting agent run with input:", input_as_text);

    try {
      const result = await withTrace("topnotch", async () => {
        const conversationHistory: AgentInputItem[] = [];

        conversationHistory.push({
          role: "user",
          content: [
            {
              type: "input_text",
              text: input_as_text
            }
          ]
        });

        console.log("Creating runner...");
        const runner = new Runner({
          traceMetadata: {
            __trace_source__: "agent-builder",
            workflow_id: WORKFLOW_ID
          }
        });
        
        console.log("Running agent...");
        const myAgentResultTemp = await runner.run(
          myAgent,
          [...conversationHistory]
        );

        console.log("Agent run complete");
        if (!myAgentResultTemp.finalOutput) {
            throw new Error("Agent result is undefined");
        }
        const myAgentResult = {
          output_text: myAgentResultTemp.finalOutput ?? ""
        };

        return new Response(JSON.stringify(myAgentResult), {
          status: 200,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
          }
        });
      });
      
      return result;
    } catch (innerError) {
      console.error("Inner error (agent/trace):", innerError);
      throw innerError;
    }
  } catch (error) {
    console.error("API Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : "";
    console.error("Error stack:", errorStack);
    
    return new Response(JSON.stringify({ 
      error: "Internal server error",
      details: errorMessage,
      stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
    }), {
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}

export async function OPTIONS(request: Request): Promise<Response> {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
