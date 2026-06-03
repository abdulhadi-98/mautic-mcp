# Mautic MCP Server

A lightweight [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that connects **Claude AI** to your **Mautic** marketing automation platform. Once connected, you can manage contacts, send emails, run campaigns, and pull analytics — all through natural language in Claude.

Built and open-sourced by **[Discret AI](https://ai.discretdigital.com)**.

---

## What This Enables

```
Claude ↔ MCP Server (Node.js) ↔ Mautic REST API
```

You talk to Claude. Claude calls your Mautic instance. Examples of what you can say:

> *"Get all contacts tagged solar-dealer"*
> *"Send email ID 12 to all contacts in segment 5"*
> *"Create a contact for Ahmed at ahmed@example.com and add him to the solar campaign"*
> *"What's the open rate on email 7?"*
> *"Add tag follow-up to contact 234"*

---

## Tools Available to Claude

| Tool | Description |
|---|---|
| `get_contacts` | Search/list contacts with optional filters |
| `get_contact` | Fetch a single contact by ID |
| `create_contact` | Create a new contact with fields and tags |
| `update_contact` | Update an existing contact's fields |
| `delete_contact` | Delete a contact |
| `send_email` | Send a transactional email to one contact |
| `bulk_send_email` | Send an email to a list of contact IDs |
| `get_email_stats` | Get open/click stats for an email |
| `list_emails` | List all emails in Mautic |
| `list_segments` | List all contact segments |
| `add_contact_to_segment` | Add a contact to a segment |
| `remove_contact_from_segment` | Remove a contact from a segment |
| `list_campaigns` | List all campaigns |
| `add_contact_to_campaign` | Add a contact to a campaign |
| `list_tags` | List all tags defined in Mautic |
| `add_tag_to_contact` | Add one or more tags to a contact |
| `get_contact_activity` | Get full event/activity history for a contact |
| `list_forms` | List all Mautic forms |
| `get_form_submissions` | Get submissions for a specific form |

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- A running [Mautic](https://www.mautic.org/) instance (self-hosted or cloud)
- Mautic API enabled with Basic Auth credentials
- [Claude Desktop](https://claude.ai/download) (for the MCP integration)

---

## Setup

### 1. Enable the Mautic API

In your Mautic admin panel:

1. Go to **Settings → Configuration → API Settings**
2. Set **API enabled** to `Yes`
3. Set **Enable HTTP basic auth** to `Yes`
4. Save

### 2. Clone and Install

```bash
git clone https://github.com/abdulhadi-98/mautic-mcp.git
cd mautic-mcp
npm install
```

### 3. Configure Credentials

Copy the example env file and fill in your details:

```bash
cp .env.example .env
```

Edit `.env`:

```env
MAUTIC_URL=https://your-mautic-domain.com
MAUTIC_USER=admin
MAUTIC_PASS=yourpassword
```

> **Note:** The URL should be your Mautic root URL — no trailing slash. The server automatically appends `/api`.

### 4. Connect to Claude Desktop

Open (or create) your Claude Desktop config file:

- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

Add the `mautic` server entry:

```json
{
  "mcpServers": {
    "mautic": {
      "command": "node",
      "args": ["/absolute/path/to/mautic-mcp/index.js"]
    }
  }
}
```

**Windows example:**
```json
{
  "mcpServers": {
    "mautic": {
      "command": "node",
      "args": ["C:\\Users\\YourName\\mautic-mcp\\index.js"]
    }
  }
}
```

Restart Claude Desktop. You'll see the Mautic tools appear in the toolbar (hammer icon).

---

## Usage Examples

Once connected, try these prompts in Claude:

**Contact management**
```
Get the first 20 contacts in Mautic
Search for contacts with the email domain @example.com
Create a contact: name Ahmed Khan, email ahmed@example.com, company Solar Co
Add tag "hot-lead" to contact 145
```

**Email sending**
```
Send email ID 8 to contact 312
Send email ID 8 to all of these contacts: 100, 101, 102, 103, 104
What are the open and click stats for email 12?
```

**Segments and campaigns**
```
List all segments
Add contact 200 to segment 3
List all campaigns and tell me which ones are active
```

**Bulk operations**
```
Get all contacts tagged "solar-dealer" and send them email ID 5
Add the 10 contacts I'll paste below to segment 7
```

---

## Project Structure

```
mautic-mcp/
├── index.js          # MCP server — all tools and Mautic API calls
├── package.json      # Dependencies
├── .env.example      # Credentials template
└── README.md
```

---

## Authentication

This server uses **HTTP Basic Auth** — the simplest method supported by Mautic. For production use cases, Mautic also supports OAuth2. To switch to OAuth2, replace the `auth` config in `index.js` with token-based headers using Mautic's OAuth2 flow.

---

## Contributing

Contributions are welcome. To add a new tool:

1. Add its schema to the `ListToolsRequestSchema` handler in `index.js`
2. Add its execution logic to the `CallToolRequestSchema` switch block
3. Open a PR with a description of what the tool does and which Mautic API endpoint it wraps

Please keep tools focused — one tool per Mautic API action.

---

## License

MIT License — free to use, modify, and distribute.

---

## Credits

Built and open-sourced by **[Discret AI](https://ai.discretdigital.com)**

> Discret AI builds AI-powered automation systems for businesses — from intelligent outreach pipelines to custom Claude integrations. This MCP server is part of our commitment to making AI + marketing automation accessible to everyone.

---

## Related Resources

- [Mautic REST API Docs](https://developer.mautic.org/#rest-api)
- [Model Context Protocol Docs](https://modelcontextprotocol.io)
- [Claude Desktop](https://claude.ai/download)
- [Discret AI](https://ai.discretdigital.com)
