import { fileSearchTool, hostedMcpTool, Agent, AgentInputItem, Runner, withTrace } from "@openai/agents";
import { WORKFLOW_ID } from "@/lib/config";

export const runtime = "edge";

// Tool definitions (unchanged)
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
  serverUrl: "https://2fe3f0ecaff4.ngrok-free.app/sse"
})
const myAgent = new Agent({
  name: "My agent",
  instructions: `You are a helpful assistant. You will take in the question and find the answer using the mcp server. If the query is general or FAQ, then use the file search option to check in PDF. If the customer asks for suggestions, use search_products tool to get suggestions. If the customer asks for specific product details, use scrape_product_details tool to get details regarding customization and addon costs.
Use get_category tool first to understand what kind of products exist and use that for support.`,
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
  const body = await request.json();
  const { input_as_text } = body as WorkflowInput;

  return await withTrace("topnotch", async () => {
    // Simple single-turn conversation (history managed on frontend)
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

    const runner = new Runner({
      traceMetadata: {
        __trace_source__: "agent-builder",
        workflow_id: WORKFLOW_ID
      }
    });
    const myAgentResultTemp = await runner.run(
      myAgent,
      [...conversationHistory]
    );

    if (!myAgentResultTemp.finalOutput) {
        throw new Error("Agent result is undefined");
    }
    const myAgentResult = {
      output_text: myAgentResultTemp.finalOutput ?? ""
    };

    return new Response(JSON.stringify(myAgentResult), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  });
}
