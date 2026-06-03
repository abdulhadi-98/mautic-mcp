import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import express from "express";
import dotenv from "dotenv";
dotenv.config();

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

// Optional: simple shared secret to prevent unauthorized access
const API_KEY = process.env.MCP_API_KEY;

app.use((req, res, next) => {
  if (API_KEY && req.headers["x-api-key"] !== API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.error(`Mautic MCP server listening on port ${PORT}`);
});
