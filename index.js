import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import express from "express";
import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();

// ---------------------------------------------------------------------------
// OAuth2 state — in-memory (single shared API key model, no DB needed)
// ---------------------------------------------------------------------------
const MCP_API_KEY = process.env.MCP_API_KEY;
const SERVER_URL = process.env.SERVER_URL; // e.g. https://mcp.yourdomain.com

// Short-lived auth codes: code -> { redirectUri, expiresAt, codeChallenge, codeChallengeMethod }
const authCodes = new Map();
// Issued bearer tokens: token -> true
const validTokens = new Set();

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

const mautic = axios.create({
  baseURL: `${process.env.MAUTIC_URL}/api`,
  auth: {
    username: process.env.MAUTIC_USER,
    password: process.env.MAUTIC_PASS,
  },
  headers: { "Content-Type": "application/json" },
});

const server = new Server(
  { name: "mautic-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_contacts",
      description: "Get contacts from Mautic with optional search/filter",
      inputSchema: {
        type: "object",
        properties: {
          search: { type: "string", description: "Search term (name, email, etc.)" },
          limit: { type: "number", description: "Max results (default 10)" },
          start: { type: "number", description: "Offset for pagination" },
          tags: { type: "string", description: "Filter by tag name" },
        },
      },
    },
    {
      name: "get_contact",
      description: "Get a single contact by ID",
      inputSchema: {
        type: "object",
        required: ["contactId"],
        properties: {
          contactId: { type: "number", description: "Contact ID" },
        },
      },
    },
    {
      name: "create_contact",
      description: "Create a new contact in Mautic",
      inputSchema: {
        type: "object",
        required: ["email"],
        properties: {
          email: { type: "string" },
          firstname: { type: "string" },
          lastname: { type: "string" },
          company: { type: "string" },
          phone: { type: "string" },
          city: { type: "string" },
          country: { type: "string" },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "List of tag names to apply",
          },
        },
      },
    },
    {
      name: "update_contact",
      description: "Update an existing contact's fields",
      inputSchema: {
        type: "object",
        required: ["contactId"],
        properties: {
          contactId: { type: "number" },
          firstname: { type: "string" },
          lastname: { type: "string" },
          email: { type: "string" },
          company: { type: "string" },
          phone: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
        },
      },
    },
    {
      name: "delete_contact",
      description: "Delete a contact from Mautic",
      inputSchema: {
        type: "object",
        required: ["contactId"],
        properties: {
          contactId: { type: "number" },
        },
      },
    },
    {
      name: "send_email",
      description: "Send a Mautic transactional email to a specific contact",
      inputSchema: {
        type: "object",
        required: ["emailId", "contactId"],
        properties: {
          emailId: { type: "number", description: "Mautic email ID" },
          contactId: { type: "number", description: "Contact ID to send to" },
          tokens: {
            type: "object",
            description: "Optional dynamic token overrides e.g. {'{contactfield=firstname}': 'Ahmed'}",
          },
        },
      },
    },
    {
      name: "bulk_send_email",
      description: "Send a Mautic email to multiple contacts (loops send_email per contact)",
      inputSchema: {
        type: "object",
        required: ["emailId", "contactIds"],
        properties: {
          emailId: { type: "number" },
          contactIds: {
            type: "array",
            items: { type: "number" },
            description: "List of contact IDs to send to",
          },
        },
      },
    },
    {
      name: "get_email_stats",
      description: "Get open/click stats for a Mautic email",
      inputSchema: {
        type: "object",
        required: ["emailId"],
        properties: {
          emailId: { type: "number" },
        },
      },
    },
    {
      name: "list_emails",
      description: "List all emails in Mautic",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number" },
          search: { type: "string" },
        },
      },
    },
    {
      name: "list_segments",
      description: "List all contact segments in Mautic",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "add_contact_to_segment",
      description: "Add a contact to a Mautic segment",
      inputSchema: {
        type: "object",
        required: ["segmentId", "contactId"],
        properties: {
          segmentId: { type: "number" },
          contactId: { type: "number" },
        },
      },
    },
    {
      name: "remove_contact_from_segment",
      description: "Remove a contact from a Mautic segment",
      inputSchema: {
        type: "object",
        required: ["segmentId", "contactId"],
        properties: {
          segmentId: { type: "number" },
          contactId: { type: "number" },
        },
      },
    },
    {
      name: "list_campaigns",
      description: "List all campaigns in Mautic",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "number" } },
      },
    },
    {
      name: "add_contact_to_campaign",
      description: "Add a contact to a campaign",
      inputSchema: {
        type: "object",
        required: ["campaignId", "contactId"],
        properties: {
          campaignId: { type: "number" },
          contactId: { type: "number" },
        },
      },
    },
    {
      name: "list_tags",
      description: "List all tags defined in Mautic",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "add_tag_to_contact",
      description: "Add one or more tags to a contact",
      inputSchema: {
        type: "object",
        required: ["contactId", "tags"],
        properties: {
          contactId: { type: "number" },
          tags: { type: "array", items: { type: "string" } },
        },
      },
    },
    {
      name: "get_contact_activity",
      description: "Get activity/event history for a contact",
      inputSchema: {
        type: "object",
        required: ["contactId"],
        properties: {
          contactId: { type: "number" },
          limit: { type: "number" },
        },
      },
    },
    {
      name: "list_forms",
      description: "List all forms in Mautic",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_form_submissions",
      description: "Get submissions for a specific form",
      inputSchema: {
        type: "object",
        required: ["formId"],
        properties: {
          formId: { type: "number" },
          limit: { type: "number" },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "get_contacts": {
        const res = await mautic.get("/contacts", {
          params: {
            search: args.search,
            limit: args.limit || 10,
            start: args.start || 0,
            tags: args.tags,
          },
        });
        const contacts = res.data.contacts || {};
        return {
          content: [{ type: "text", text: JSON.stringify(contacts, null, 2) }],
        };
      }

      case "get_contact": {
        const res = await mautic.get(`/contacts/${args.contactId}`);
        return {
          content: [{ type: "text", text: JSON.stringify(res.data.contact, null, 2) }],
        };
      }

      case "create_contact": {
        const { tags, ...fields } = args;
        const payload = { ...fields };
        if (tags && tags.length > 0) payload.tags = tags;
        const res = await mautic.post("/contacts/new", payload);
        return {
          content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
        };
      }

      case "update_contact": {
        const { contactId, tags, ...fields } = args;
        const payload = { ...fields };
        if (tags && tags.length > 0) payload.tags = tags;
        const res = await mautic.patch(`/contacts/${contactId}/edit`, payload);
        return {
          content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
        };
      }

      case "delete_contact": {
        const res = await mautic.delete(`/contacts/${args.contactId}/delete`);
        return {
          content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
        };
      }

      case "send_email": {
        const payload = {};
        if (args.tokens) payload.tokens = args.tokens;
        const res = await mautic.post(
          `/emails/${args.emailId}/contact/${args.contactId}/send`,
          payload
        );
        return {
          content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
        };
      }

      case "bulk_send_email": {
        const results = [];
        for (const contactId of args.contactIds) {
          try {
            const res = await mautic.post(
              `/emails/${args.emailId}/contact/${contactId}/send`
            );
            results.push({ contactId, status: "sent", data: res.data });
          } catch (err) {
            results.push({ contactId, status: "failed", error: err.message });
          }
        }
        const summary = {
          total: args.contactIds.length,
          sent: results.filter((r) => r.status === "sent").length,
          failed: results.filter((r) => r.status === "failed").length,
          results,
        };
        return {
          content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
        };
      }

      case "get_email_stats": {
        const res = await mautic.get(`/emails/${args.emailId}`);
        const email = res.data.email;
        const stats = {
          id: email.id,
          name: email.name,
          subject: email.subject,
          sentCount: email.sentCount,
          readCount: email.readCount,
          readRate: email.readCount && email.sentCount
            ? `${((email.readCount / email.sentCount) * 100).toFixed(1)}%`
            : "0%",
          stats: email.stats,
        };
        return {
          content: [{ type: "text", text: JSON.stringify(stats, null, 2) }],
        };
      }

      case "list_emails": {
        const res = await mautic.get("/emails", {
          params: { limit: args.limit || 20, search: args.search },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(res.data.emails, null, 2) }],
        };
      }

      case "list_segments": {
        const res = await mautic.get("/segments");
        return {
          content: [{ type: "text", text: JSON.stringify(res.data.lists, null, 2) }],
        };
      }

      case "add_contact_to_segment": {
        const res = await mautic.post(
          `/segments/${args.segmentId}/contact/${args.contactId}/add`
        );
        return {
          content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
        };
      }

      case "remove_contact_from_segment": {
        const res = await mautic.post(
          `/segments/${args.segmentId}/contact/${args.contactId}/remove`
        );
        return {
          content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
        };
      }

      case "list_campaigns": {
        const res = await mautic.get("/campaigns", {
          params: { limit: args.limit || 20 },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(res.data.campaigns, null, 2) }],
        };
      }

      case "add_contact_to_campaign": {
        const res = await mautic.post(
          `/campaigns/${args.campaignId}/contact/${args.contactId}/add`
        );
        return {
          content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
        };
      }

      case "list_tags": {
        const res = await mautic.get("/tags");
        return {
          content: [{ type: "text", text: JSON.stringify(res.data.tags, null, 2) }],
        };
      }

      case "add_tag_to_contact": {
        const contact = await mautic.get(`/contacts/${args.contactId}`);
        const existingTags = contact.data.contact.tags
          ? Object.values(contact.data.contact.tags).map((t) => t.tag)
          : [];
        const mergedTags = [...new Set([...existingTags, ...args.tags])];
        const res = await mautic.patch(`/contacts/${args.contactId}/edit`, {
          tags: mergedTags,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
        };
      }

      case "get_contact_activity": {
        const res = await mautic.get(`/contacts/${args.contactId}/activity`, {
          params: { limit: args.limit || 25 },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
        };
      }

      case "list_forms": {
        const res = await mautic.get("/forms");
        return {
          content: [{ type: "text", text: JSON.stringify(res.data.forms, null, 2) }],
        };
      }

      case "get_form_submissions": {
        const res = await mautic.get(`/forms/${args.formId}/submissions`, {
          params: { limit: args.limit || 20 },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (err) {
    const message = err.response
      ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`
      : err.message;
    return {
      content: [{ type: "text", text: `Error calling ${name}: ${message}` }],
      isError: true,
    };
  }
});

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------------------------------------------------------------------------
// OAuth2 discovery — claude.ai fetches this to know where to send users
// ---------------------------------------------------------------------------
app.get("/.well-known/oauth-authorization-server", (_req, res) => {
  res.json({
    issuer: SERVER_URL,
    authorization_endpoint: `${SERVER_URL}/oauth/authorize`,
    token_endpoint: `${SERVER_URL}/oauth/token`,
    registration_endpoint: `${SERVER_URL}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
  });
});

// Also expose at the standard OIDC path some clients check
app.get("/.well-known/openid-configuration", (_req, res) => {
  res.json({
    issuer: SERVER_URL,
    authorization_endpoint: `${SERVER_URL}/oauth/authorize`,
    token_endpoint: `${SERVER_URL}/oauth/token`,
    registration_endpoint: `${SERVER_URL}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
  });
});

// ---------------------------------------------------------------------------
// Dynamic Client Registration (RFC 7591) — claude.ai POSTs here first
// We accept any client and echo back a client_id so the flow can continue
// ---------------------------------------------------------------------------
app.post("/oauth/register", (req, res) => {
  const { client_name, redirect_uris, grant_types, response_types } = req.body;
  const clientId = crypto.randomBytes(16).toString("hex");
  res.status(201).json({
    client_id: clientId,
    client_name: client_name || "mcp-client",
    redirect_uris: redirect_uris || [],
    grant_types: grant_types || ["authorization_code"],
    response_types: response_types || ["code"],
    token_endpoint_auth_method: "none",
  });
});

// ---------------------------------------------------------------------------
// Authorization endpoint — user enters the shared API key here
// claude.ai redirects here; we show a simple HTML form
// ---------------------------------------------------------------------------
app.get("/oauth/authorize", (req, res) => {
  const { redirect_uri, state, client_id, code_challenge, code_challenge_method } = req.query;
  if (!redirect_uri) return res.status(400).send("Missing redirect_uri");

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mautic MCP — Sign In</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f5f5f5;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      padding: 40px;
      width: 100%;
      max-width: 400px;
    }
    h1 { font-size: 1.4rem; margin-bottom: 6px; color: #111; }
    p  { font-size: 0.9rem; color: #666; margin-bottom: 28px; }
    label { display: block; font-size: 0.85rem; font-weight: 600; color: #333; margin-bottom: 6px; }
    input[type=password] {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 0.95rem;
      outline: none;
      transition: border 0.2s;
    }
    input[type=password]:focus { border-color: #555; }
    button {
      margin-top: 18px;
      width: 100%;
      padding: 11px;
      background: #111;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 0.95rem;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover { background: #333; }
    .error { color: #c0392b; font-size: 0.85rem; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Mautic MCP</h1>
    <p>Enter your API key to connect Claude to Mautic.</p>
    <form method="POST" action="/oauth/authorize">
      <input type="hidden" name="redirect_uri" value="${redirect_uri}" />
      <input type="hidden" name="state" value="${state || ""}" />
      <input type="hidden" name="client_id" value="${client_id || ""}" />
      <input type="hidden" name="code_challenge" value="${code_challenge || ""}" />
      <input type="hidden" name="code_challenge_method" value="${code_challenge_method || ""}" />
      <label for="apikey">API Key</label>
      <input type="password" id="apikey" name="apikey" placeholder="Enter your API key" required autofocus />
      <button type="submit">Connect</button>
    </form>
  </div>
</body>
</html>`);
});

app.post("/oauth/authorize", (req, res) => {
  const { redirect_uri, state, apikey, code_challenge, code_challenge_method } = req.body;
  if (!redirect_uri) return res.status(400).send("Missing redirect_uri");

  if (!MCP_API_KEY || apikey !== MCP_API_KEY) {
    return res.status(401).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Mautic MCP — Sign In</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f5f5f5;
      display: flex; align-items: center; justify-content: center; min-height: 100vh;
    }
    .card {
      background: #fff; border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      padding: 40px; width: 100%; max-width: 400px;
    }
    h1 { font-size: 1.4rem; margin-bottom: 6px; color: #111; }
    p  { font-size: 0.9rem; color: #666; margin-bottom: 28px; }
    label { display: block; font-size: 0.85rem; font-weight: 600; color: #333; margin-bottom: 6px; }
    input[type=password] {
      width: 100%; padding: 10px 14px; border: 1px solid #ddd;
      border-radius: 8px; font-size: 0.95rem; outline: none;
    }
    input[type=password]:focus { border-color: #555; }
    button {
      margin-top: 18px; width: 100%; padding: 11px;
      background: #111; color: #fff; border: none;
      border-radius: 8px; font-size: 0.95rem; cursor: pointer;
    }
    button:hover { background: #333; }
    .error { color: #c0392b; font-size: 0.85rem; margin-top: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Mautic MCP</h1>
    <p>Enter your API key to connect Claude to Mautic.</p>
    <form method="POST" action="/oauth/authorize">
      <input type="hidden" name="redirect_uri" value="${redirect_uri}" />
      <input type="hidden" name="state" value="${state || ""}" />
      <label for="apikey">API Key</label>
      <input type="password" id="apikey" name="apikey" placeholder="Enter your API key" required autofocus />
      <button type="submit">Connect</button>
    </form>
    <p class="error">Invalid API key. Please try again.</p>
  </div>
</body>
</html>`);
  }

  // Valid key — issue a short-lived auth code and redirect back
  const code = generateToken();
  authCodes.set(code, {
    redirectUri: redirect_uri,
    expiresAt: Date.now() + 5 * 60 * 1000,
    codeChallenge: code_challenge || null,
    codeChallengeMethod: code_challenge_method || null,
  });

  const redirectUrl = new URL(redirect_uri);
  redirectUrl.searchParams.set("code", code);
  if (state) redirectUrl.searchParams.set("state", state);
  res.redirect(redirectUrl.toString());
});

// ---------------------------------------------------------------------------
// Token endpoint — exchanges auth code for bearer token
// ---------------------------------------------------------------------------
app.post("/oauth/token", (req, res) => {
  const { code, grant_type, code_verifier } = req.body;

  if (grant_type !== "authorization_code") {
    return res.status(400).json({ error: "unsupported_grant_type" });
  }

  const entry = authCodes.get(code);
  if (!entry || Date.now() > entry.expiresAt) {
    authCodes.delete(code);
    return res.status(400).json({ error: "invalid_grant" });
  }

  // Verify PKCE if the authorization request included a code_challenge
  if (entry.codeChallenge) {
    if (!code_verifier) {
      return res.status(400).json({ error: "invalid_grant", error_description: "code_verifier required" });
    }
    const method = entry.codeChallengeMethod || "S256";
    if (method === "S256") {
      const digest = crypto.createHash("sha256").update(code_verifier).digest();
      const challenge = digest.toString("base64url");
      if (challenge !== entry.codeChallenge) {
        return res.status(400).json({ error: "invalid_grant", error_description: "PKCE verification failed" });
      }
    } else if (method === "plain") {
      if (code_verifier !== entry.codeChallenge) {
        return res.status(400).json({ error: "invalid_grant", error_description: "PKCE verification failed" });
      }
    }
  }

  authCodes.delete(code);
  const token = generateToken();
  validTokens.add(token);

  res.json({
    access_token: token,
    token_type: "Bearer",
    expires_in: 3600 * 24 * 30,
  });
});

// ---------------------------------------------------------------------------
// MCP endpoint — requires valid bearer token
// ---------------------------------------------------------------------------
function requireBearer(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token || !validTokens.has(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

app.post("/mcp", requireBearer, async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.error(`Mautic MCP server listening on port ${PORT}`);
});
