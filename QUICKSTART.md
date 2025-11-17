# Quick Start Guide - Persistent Memory Setup

## ✅ What's Been Done

1. **Created `/app/api/chat/route.ts`** - New chat endpoint with Vercel KV integration
2. **Installed dependencies** - @vercel/kv, uuid, @openai/agents
3. **Created CustomChatPanel component** - Example implementation showing session tracking
4. **Updated .env.example** - Added KV environment variables
5. **Created comprehensive documentation** - See MEMORY_SETUP.md

## 🚀 Next Steps to Make It Work

### 1. Set Up Vercel KV (Required)

```bash
# Go to Vercel Dashboard → Your Project → Storage → Create Database → KV
# Copy the environment variables and add to .env.local:
```

```env
KV_URL=redis://...
KV_REST_API_URL=https://...
KV_REST_API_TOKEN=...
KV_REST_API_READ_ONLY_TOKEN=...
```

### 2. Configure Your Agent

Edit `app/api/chat/route.ts`:

**Update Vector Store ID** (line 8):
```typescript
const fileSearch = fileSearchTool([
  "vs_YOUR_VECTOR_STORE_ID"  // Get from OpenAI Platform → Storage → Vector Stores
])
```

**Update MCP Server URL** (line 18):
```typescript
serverUrl: "https://YOUR_MCP_SERVER_URL/sse"
```

### 3. Choose Your Frontend

#### Option A: Keep Using ChatKit (Current Setup)
- ChatKit manages sessions internally
- The `/api/chat` route is ready but not used by ChatKit
- Memory persistence would need ChatKit workflow configuration

#### Option B: Use Custom Chat Interface
Replace in `app/App.tsx`:

```typescript
// Change this:
import { ChatKitPanel } from "@/components/ChatKitPanel";

// To this:
import { CustomChatPanel } from "@/components/CustomChatPanel";

// And in the return statement:
return (
  <main className="flex min-h-screen flex-col items-center justify-end bg-slate-100 dark:bg-slate-950">
    <div className="mx-auto w-full max-w-5xl">
      <CustomChatPanel />
    </div>
  </main>
);
```

### 4. Test Locally

```bash
npm run dev
```

Visit http://localhost:3000 and test:
1. Send: "My name is Alice"
2. Send: "What's my name?" → Should respond with "Alice"
3. Refresh page
4. Send: "What's my name again?" → Should still remember "Alice"

### 5. Deploy

```bash
git add .
git commit -m "Add persistent memory with Vercel KV"
git push
```

Vercel will auto-deploy. Make sure to add KV environment variables in Vercel dashboard.

## 📋 Environment Variables Checklist

- [ ] `OPENAI_API_KEY` - From OpenAI Platform
- [ ] `NEXT_PUBLIC_CHATKIT_WORKFLOW_ID` - From Agent Builder
- [ ] `KV_URL` - From Vercel KV
- [ ] `KV_REST_API_URL` - From Vercel KV
- [ ] `KV_REST_API_TOKEN` - From Vercel KV
- [ ] `KV_REST_API_READ_ONLY_TOKEN` - From Vercel KV

## 🔧 Common Issues

### Dependencies not found
```bash
npm install @vercel/kv uuid @openai/agents
npm install --save-dev @types/uuid
```

### KV Connection Error
- Verify KV environment variables are set
- Check Vercel dashboard → Storage → KV is created
- Restart dev server after adding env vars

### Agent Not Responding
- Check OPENAI_API_KEY is valid
- Verify WORKFLOW_ID is correct
- Update vector store ID in route.ts
- Check Vercel function logs

## 📚 Documentation Files

- **MEMORY_SETUP.md** - Complete setup guide with troubleshooting
- **components/CustomChatPanel.tsx** - Example implementation
- **app/api/chat/route.ts** - Backend endpoint with KV integration

## 🎯 Key Features

✅ **Persistent Memory** - Conversations survive page reloads and restarts
✅ **Multi-User Support** - Each session has isolated history
✅ **Automatic Cleanup** - Keeps last 10 messages per session
✅ **MCP Integration** - File search + hosted MCP tools
✅ **Session Management** - UUID-based session tracking

## 💡 Tips

- Use browser localStorage to persist session IDs
- Set TTL on KV entries to auto-expire old sessions
- Monitor KV usage in Vercel dashboard
- Test with incognito windows for multi-user scenarios
- Check Vercel logs for debugging: `vercel logs`

## 🔗 Resources

- [Vercel KV Docs](https://vercel.com/docs/storage/vercel-kv)
- [OpenAI Agents SDK](https://github.com/openai/agents)
- [Agent Builder](https://platform.openai.com/agent-builder)

---

**Need Help?** Check MEMORY_SETUP.md for detailed troubleshooting and examples.
