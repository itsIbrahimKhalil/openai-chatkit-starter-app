# Persistent Memory Setup with Vercel KV

This guide explains how to set up persistent chat memory using Vercel KV for your ChatKit application.

## Overview

The `/api/chat/route.ts` endpoint has been created with:
- **Persistent conversation history** using Vercel KV
- **Session-based memory** - each user gets their own conversation history
- **Automatic history management** - keeps last 10 messages to optimize performance
- **MCP tools integration** - file search and hosted MCP server tools

## Setup Instructions

### 1. Create a Vercel KV Database

1. Go to your Vercel dashboard: https://vercel.com/dashboard
2. Select your project
3. Navigate to **Storage** tab
4. Click **Create Database**
5. Select **KV** (Key-Value Store)
6. Give it a name (e.g., "chatkit-memory")
7. Click **Create**

### 2. Get KV Environment Variables

After creating the KV database:

1. Click on your newly created KV database
2. Go to the **Settings** or **Connection** tab
3. Copy the following environment variables:
   - `KV_URL`
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - `KV_REST_API_READ_ONLY_TOKEN`

### 3. Add Environment Variables

Add the KV variables to your `.env.local` file:

```bash
# Existing variables
OPENAI_API_KEY=sk-proj-...
NEXT_PUBLIC_CHATKIT_WORKFLOW_ID=wf_...

# New KV variables
KV_URL=redis://...
KV_REST_API_URL=https://...
KV_REST_API_TOKEN=...
KV_REST_API_READ_ONLY_TOKEN=...
```

**Important**: Also add these to your Vercel project settings:
1. Go to your Vercel project settings
2. Navigate to **Environment Variables**
3. Add all KV variables for Production, Preview, and Development environments

### 4. Understanding the Implementation

#### Backend (`/api/chat/route.ts`)

The chat endpoint:
- Retrieves conversation history from KV using `session_id`
- Adds the new user message to history
- Runs the agent with full conversation context
- Saves updated history back to KV
- Returns agent response

Key features:
```typescript
// Retrieve history
let conversationHistory = await kv.get<AgentInputItem[]>(session_id) || [];

// Add new message
conversationHistory.push({
  role: "user",
  content: [{ type: "input_text", text: input_as_text }]
});

// Keep last 10 messages
if (conversationHistory.length > MAX_HISTORY_LENGTH) {
  conversationHistory = conversationHistory.slice(-MAX_HISTORY_LENGTH);
}

// Save after agent response
await kv.set(session_id, conversationHistory);
```

#### Frontend Integration

If using ChatKit's default UI, sessions are managed automatically by ChatKit.

For custom implementation, add session ID tracking:

```typescript
import { v4 as uuidv4 } from 'uuid';

// Generate or retrieve session ID
let sessionId = localStorage.getItem('chat_session_id');
if (!sessionId) {
  sessionId = uuidv4();
  localStorage.setItem('chat_session_id', sessionId);
}

// Send with each message
await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    input_as_text: userMessage, 
    session_id: sessionId 
  })
});
```

## Tools Configuration

The agent uses two tools:

### 1. File Search Tool
```typescript
const fileSearch = fileSearchTool([
  "vs_6914604e9e048191906ca017d86702b9"  // Replace with your vector store ID
])
```

To get your vector store ID:
1. Go to OpenAI Platform → Storage → Vector Stores
2. Create or select a vector store
3. Upload your FAQ PDFs
4. Copy the vector store ID (starts with `vs_`)

### 2. Hosted MCP Tool
```typescript
const mcp = hostedMcpTool({
  serverLabel: "Top_Notch_MCP",
  allowedTools: [
    "search_faq",
    "search_products", 
    "get_categories",
    "scrape_product_details"
  ],
  requireApproval: "never",
  serverUrl: "https://2fe3f0ecaff4.ngrok-free.app/sse"  // Your MCP server URL
})
```

Update `serverUrl` with your MCP server endpoint.

## Testing

### Test Memory Persistence

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Send a message: "My name is John"
   - Agent should acknowledge

3. In a new message ask: "What's my name?"
   - Agent should remember "John"

4. Refresh the page and ask again: "What's my name?"
   - Agent should still remember (memory persists across page reloads)

### Test Multi-User Support

Open two browser windows:
- Window 1: Incognito mode
- Window 2: Normal mode

Each will have a different `session_id` and separate conversation history.

## Deployment

### 1. Commit Changes

```bash
git add .
git commit -m "Add persistent memory with Vercel KV"
git push
```

### 2. Vercel Auto-Deploy

Vercel will automatically:
- Detect the push
- Build your application
- Deploy with KV integration

### 3. Verify Deployment

1. Check Vercel deployment logs
2. Test the deployed URL
3. Verify memory persistence works in production

## Memory Management

### Clear a User's History

Use Vercel KV dashboard or CLI:

```bash
# Via Vercel CLI
vercel kv del <session_id>
```

### View All Sessions

```bash
# List all keys (session IDs)
vercel kv keys "*"
```

### Adjust History Length

In `app/api/chat/route.ts`:

```typescript
const MAX_HISTORY_LENGTH = 10;  // Change to desired length
```

## Troubleshooting

### Error: "Cannot find module '@vercel/kv'"

Run:
```bash
npm install @vercel/kv
```

### Error: "KV_REST_API_TOKEN is not defined"

Ensure environment variables are set in:
- `.env.local` (for local development)
- Vercel project settings (for production)

### Memory Not Persisting

1. Check KV is connected:
   ```typescript
   console.log('KV URL:', process.env.KV_URL);
   ```

2. Verify session_id is consistent:
   ```typescript
   console.log('Session ID:', session_id);
   ```

3. Check Vercel logs for errors

### Agent Not Responding

1. Verify `OPENAI_API_KEY` is set
2. Check `WORKFLOW_ID` matches your Agent Builder workflow
3. Review Vercel function logs

## Cost Considerations

### Vercel KV Pricing

- **Hobby plan**: 256 MB storage included
- **Pro plan**: 512 MB storage included
- Each session stores ~2-10KB depending on conversation length

### Optimization Tips

1. **Limit history length**: Reduce `MAX_HISTORY_LENGTH`
2. **Set TTL**: Add expiration to old sessions
   ```typescript
   await kv.set(session_id, conversationHistory, { ex: 86400 }); // 24 hours
   ```
3. **Clean up inactive sessions**: Implement periodic cleanup

## Security Notes

1. **Session IDs**: Generated client-side - consider server-side generation for sensitive applications
2. **KV tokens**: Never expose in client-side code
3. **Rate limiting**: Add rate limiting to prevent abuse
4. **User authentication**: Integrate with your auth system for production use

## Next Steps

- [ ] Customize agent instructions in `route.ts`
- [ ] Update vector store ID with your FAQ documents
- [ ] Configure your MCP server URL
- [ ] Add user authentication
- [ ] Implement rate limiting
- [ ] Add analytics tracking
- [ ] Set up monitoring and alerts

## Support

For issues:
- Check Vercel logs: `vercel logs`
- Review KV dashboard for data
- Test locally first with `npm run dev`
