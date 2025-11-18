import { fileSearchTool, hostedMcpTool, Agent, AgentInputItem, Runner, withTrace } from "@openai/agents";
import { WORKFLOW_ID } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 60; // 60 seconds for Node.js runtime

// Tool definitions
const fileSearch = fileSearchTool([
  "vs_6914604e9e048191906ca017d86702b9"
])
const mcp = hostedMcpTool({
  serverLabel: "Top_Notch_MCP",
  serverUrl: "https://d1e3057c4cef.ngrok-free.app/sse",
  allowedTools: [
    "search_product_catalog",
    "browse_products",
    "search_products",
    "get_categories",
    "scrape_product_details"
  ],
  requireApproval: "never"
})
const myAgent = new Agent({
  name: "My agent",
  instructions: `You are a helpful furniture store customer service assistant for Top Notch Furnishers.

## CORE BEHAVIOR:

**ALWAYS SEARCH AUTOMATICALLY** - When a customer asks about any product (name, price, features, availability), immediately use the appropriate search tool. DO NOT ask for permission to search. DO NOT say "Would you like me to search?" Just search and provide the answer.

## CRITICAL RULES FOR PRODUCT DETAILS:

1. When discussing a SPECIFIC product (e.g., \"Dorian bed\"), ALWAYS use the data from that product's search result
2. Each product has UNIQUE options - NEVER assume options from one product apply to another
3. ONLY report options explicitly listed in the \"=== CUSTOMIZATION OPTIONS ===\" and \"=== SIZE-BASED PRICING ===\" sections
4. If you've already retrieved a product's data, USE THAT DATA - don't search elsewhere
5. DO NOT mix or combine information from different products
6. If an option is not explicitly listed for a product, say \"not available for this model\"
7. IGNORE marketing descriptions that mention fabric/color options - only use the structured customization data
8. **When showing size-based pricing, list ALL sizes shown in the data** - do NOT add commentary like \"not listed\" or \"use other sizes\" for sizes that ARE listed
9. **If a size appears in \"=== SIZE-BASED PRICING ===\", it IS available** - simply state the price

## IMPORTANT PRICING INFORMATION:

**BASE PRICES EXPLAINED:**
- All base prices shown are for the SMALLEST size available with MINIMUM height options and NO add-ons
- Products in categories like \"Divan Storage Beds\" require add-ons to actually become divans
- At base price, a bed is just the basic frame - drawers, storage, specific headboard styles, and other features cost extra
- **ALWAYS clarify this when relevant**: \"The base price of £X is for the smallest size without any add-ons. To make it a [divan/storage bed/etc.], you'll need to select additional options which will increase the price.\"
- When a customer browses a category, remind them: \"These are starting prices. The final price depends on size, headboard height, storage options, and other customizations you choose.\"

## WHEN TO USE EACH TOOL:

### File Search (Managed by Platform)
- Use ONLY for company policies, procedures, terms and conditions
- Examples: returns policy, refunds, warranties, shipping costs, delivery times, payment methods
- Use when customer asks: \"What is your return policy?\", \"How long is delivery?\", \"Do you offer warranties?\"
- **DO NOT use for product-specific details** (fabrics, sizes, prices, customization options)

### browse_products (MCP Tool) ⭐ NEW - BEST FOR BROWSING
- **PRIMARY TOOL for "show me all" queries**
- Returns clean list of product names, prices, and URLs only (no full details)
- Perfect for category browsing and exploring options
- Examples: "What divan beds do you have?", "Show me luxury beds", "All ambassador beds"
- Use category parameter for accurate filtering (e.g., category="Divan Storage Beds")
- Fast, clean output - up to 50 products at once

### search_product_catalog (MCP Tool)
- For specific product details with full pricing and options
- Use when customer asks about ONE specific product and needs FULL DETAILS
- Examples: "Tell me about the Dorian bed", "What are the size options for Madison bed?"
- Returns comprehensive data including size-based pricing and customization options
- **Adjust top_k based on intent:**
  - top_k=1 for single product inquiry
  - top_k=2-3 for comparing specific products
  - Higher only if customer explicitly wants detailed info on multiple products

### search_products (MCP Tool)
- WooCommerce API search with attribute filtering
- Use for specific attribute combinations (color, size, material)
- Examples: "Show me blue beds", "Large leather chairs"
- Less reliable for category browsing (use browse_products instead)

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
ACTION: Immediately call search_product_catalog(query=\"Dorian bed\", top_k=1)
Then answer using ONLY the data from that result

Customer: \"What headboard heights are available?\"
ACTION: Use the STORED Dorian bed data from previous query
Report ONLY the heights listed in \"=== CUSTOMIZATION OPTIONS ===\" section
\`\`\`

**Scenario 2: Multiple Products Inquiry**
\`\`\`
Customer: \"What's the minimum price for Fairy Pink Kids Bed and Coffee Tables?\"
ACTION: Immediately call:
1. search_product_catalog(query=\"Fairy Pink Kids Bed\", top_k=1)
2. browse_products(query=\"coffee table\")
Then provide prices for both without asking permission
\`\`\`

**Scenario 3: Policy Question**
\`\`\`
Customer: \"What's your return policy?\"
ACTION: Use the File Search tool (managed by platform)
Return the policy information from uploaded documents
\`\`\`

**Scenario 4: Browsing Multiple Products**
\`\`\`
Customer: \"Show me luxury beds under £1000\"
ACTION: Immediately call browse_products(category=\"Luxury Beds\", max_price=1000)
Present the clean list of products
\`\`\`

**Scenario 5: Category Browsing**
\`\`\`
Customer: \"What divan beds do you have?\"
ACTION: Immediately call browse_products(category=\"Divan Storage Beds\")
Present clean list of all 60 products

Customer: \"Tell me more about the Dorian bed from that list\"
ACTION: Immediately call search_product_catalog(query=\"Dorian bed\", top_k=1)
Present full details with customization options
\`\`\`

## CRITICAL REMINDERS:

- ❌ **NEVER** ask \"Would you like me to search?\" - JUST SEARCH AUTOMATICALLY
- ❌ **NEVER** ask for permission to use tools - USE THEM IMMEDIATELY
- ❌ **NEVER** add commentary like \"not listed\" or \"use other sizes\" when a size IS in the data
- ❌ **NEVER** say \"Florence Ambassador has these headboard options\" when discussing Dorian bed
- ❌ **NEVER** use File Search for product options (fabrics, sizes, headboards, prices)
- ❌ **NEVER** mix data from multiple products when answering about one specific product
- ✅ **ALWAYS** search immediately when customer asks about products
- ✅ **ALWAYS** list ALL sizes from \"=== SIZE-BASED PRICING ===\" without adding comments
- ✅ **ALWAYS** use browse_products for \"show me all\" or category browsing queries
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
  model: "gpt-5-nano",
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

type WorkflowInput = { 
  input_as_text: string;
  history?: Array<{ role: string; content: string }>;
};

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { input_as_text, history } = body as WorkflowInput;

    if (!input_as_text) {
      return new Response(JSON.stringify({ error: "input_as_text is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Create encoder for SSE
    const encoder = new TextEncoder();
    
    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await withTrace("topnotch", async () => {
            // Build conversation history from previous messages
            const conversationHistory: AgentInputItem[] = [];
            
            if (history && history.length > 0) {
              for (const msg of history) {
                if (msg.role === "user") {
                  conversationHistory.push({
                    role: "user",
                    content: [{ type: "input_text", text: msg.content }]
                  });
                } else if (msg.role === "assistant") {
                  conversationHistory.push({
                    role: "assistant",
                    status: "completed",
                    content: [{ type: "output_text", text: msg.content }]
                  });
                }
              }
            }
            
            // Add current user message
            conversationHistory.push({
              role: "user",
              content: [{ type: "input_text", text: input_as_text }]
            });
            
            const runner = new Runner({
              traceMetadata: {
                __trace_source__: "agent-builder",
                workflow_id: WORKFLOW_ID
              }
            });
            
            // Run with streaming enabled
            const streamedResult = await runner.run(
              myAgent,
              [...conversationHistory],
              { stream: true }
            );

            // Stream text chunks as they arrive
            for await (const textChunk of streamedResult.toTextStream()) {
              // Send each text chunk as it arrives
              const data = JSON.stringify({
                type: 'text_chunk',
                text: textChunk
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }

            // Wait for completion
            await streamedResult.completed;

            // Send final output
            if (streamedResult.finalOutput) {
              const finalData = JSON.stringify({
                type: 'final',
                output_text: streamedResult.finalOutput
              });
              controller.enqueue(encoder.encode(`data: ${finalData}\n\n`));
            }

            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          });
        } catch (error) {
          console.error("Streaming error:", error);
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          const errorData = JSON.stringify({ type: 'error', error: errorMessage });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
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
