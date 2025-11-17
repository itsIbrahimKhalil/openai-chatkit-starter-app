import { fileSearchTool, hostedMcpTool, Agent, AgentInputItem, Runner, withTrace } from "@openai/agents";
import { WORKFLOW_ID } from "@/lib/config";

export const runtime = "edge";

// Tool definitions
const fileSearch = fileSearchTool([
  "vs_6914604e9e048191906ca017d86702b9"
])
const mcp = hostedMcpTool({
  serverLabel: "Top_Notch_MCP",
  serverUrl: "https://d34fc96a4d8d.ngrok-free.app/sse",
  allowedTools: [
    "search_product_catalog",
    "search_products",
    "get_categories",
    "scrape_product_details"
  ],
  requireApproval: "never"
})
const myAgent = new Agent({
  name: "My agent",
  instructions: `You are a helpful furniture store customer service assistant for Top Notch Furnishers.

## CRITICAL RULES FOR PRODUCT DETAILS:

1. When discussing a SPECIFIC product (e.g., \"Dorian bed\"), ALWAYS use the data from that product's search result
2. Each product has UNIQUE options - NEVER assume options from one product apply to another
3. ONLY report options explicitly listed in the \"=== CUSTOMIZATION OPTIONS ===\" and \"=== SIZE-BASED PRICING ===\" sections
4. If you've already retrieved a product's data, USE THAT DATA - don't search elsewhere
5. DO NOT mix or combine information from different products
6. If an option is not explicitly listed for a product, say \"not available for this model\"
7. IGNORE marketing descriptions that mention fabric/color options - only use the structured customization data

## WHEN TO USE EACH TOOL:

### File Search (Managed by Platform)
- Use ONLY for company policies, procedures, terms and conditions
- Examples: returns policy, refunds, warranties, shipping costs, delivery times, payment methods
- Use when customer asks: \"What is your return policy?\", \"How long is delivery?\", \"Do you offer warranties?\"
- **DO NOT use for product-specific details** (fabrics, sizes, prices, customization options)

### search_product_catalog (MCP Tool)
- For specific product details with full pricing and options
- Use when customer asks about ONE specific product and needs FULL DETAILS
- Examples: \"Tell me about the Dorian bed\", \"What are the size options for Madison bed?\"
- Returns comprehensive data including size-based pricing and customization options
- **Adjust top_k based on intent:**
  - top_k=1 for single product inquiry
  - top_k=2-3 for comparing specific products
  - Higher only if customer explicitly wants detailed info on many products

### search_products (MCP Tool)
- For quick browsing of multiple products (returns basic info: name, price, SKU, stock)
- Use when customer is exploring options without needing detailed customization
- Examples: \"Show me beds under £500\", \"What sofas do you have?\"
- Faster and more efficient for general browsing

### scrape_product_details (MCP Tool)
- For the most comprehensive customization details when product URL is known
- Use when customer needs ALL available options with exact pricing
- Returns data in TOON format optimized for detailed questions
- Example: \"Show me all fabric colors and mattress options for the Madison bed\"

### get_categories (MCP Tool)
- Use to discover available product categories
- Helpful when customer asks \"What types of products do you sell?\"

## WORKFLOW EXAMPLE:

**Scenario 1: Specific Product Inquiry**
\`\`\`
Customer: \"Tell me about the Dorian bed\"
1. Call search_product_catalog(query=\"Dorian bed\", top_k=1)
2. Store the result in conversation context
3. Answer using ONLY the data from that result

Customer: \"What headboard heights are available?\"
1. Use the STORED Dorian bed data from previous query
2. Report ONLY the heights listed in \"=== CUSTOMIZATION OPTIONS ===\" section
3. DO NOT search files or assume generic options
\`\`\`

**Scenario 2: Policy Question**
\`\`\`
Customer: \"What's your return policy?\"
1. Use the File Search tool (managed by platform)
2. Return the policy information from uploaded documents
3. DO NOT use MCP tools for this
\`\`\`

**Scenario 3: Browsing Multiple Products**
\`\`\`
Customer: \"Show me luxury beds under £1000\"
1. Call search_products(query=\"luxury bed\", max_price=1000)
2. Present the list with basic info
3. If customer asks for details on a specific bed, THEN use search_product_catalog
\`\`\`

## CRITICAL REMINDERS:

- ❌ **NEVER** say \"Florence Ambassador has these headboard options\" when discussing Dorian bed
- ❌ **NEVER** use File Search for product options (fabrics, sizes, headboards, prices)
- ❌ **NEVER** mix data from multiple products when answering about one specific product
- ✅ **ALWAYS** use the \"=== CUSTOMIZATION OPTIONS ===\" section as the source of truth
- ✅ **ALWAYS** specify which product you're talking about when listing options
- ✅ **ALWAYS** use File Search for company policies (returns, shipping, warranties)

## Response Style:

- Be conversational, helpful, and accurate
- Always base answers on the actual data retrieved
- If information is not available, say so clearly
- Offer to get more details or suggest alternatives when appropriate
- Present pricing clearly and transparently

---
`,
  model: "gpt-5-mini",
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

type WorkflowInput = { input_as_text: string };

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

    const result = await withTrace("topnotch", async () => {
      const conversationHistory: AgentInputItem[] = [
        { role: "user", content: [{ type: "input_text", text: input_as_text }] }
      ];
      
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
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    });
    
    return result;
  } catch (error) {
    console.error("API Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return new Response(JSON.stringify({ 
      error: "Internal server error",
      details: errorMessage
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
