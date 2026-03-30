# Mimecast SIEM to Vision One Log Forwarder

Poll the Mimecast Cloud Gateway SIEM API and forward security events to Trend Micro Vision One in real time.

Built for any organisation that uses both Mimecast email security and Vision One XDR. Runs as a lightweight Node.js process — deploy it on Azure Functions, Docker, or any server with Node 18+.

## How It Works

```
Poller (5 min interval)
  -> OAuth 2.0 token (auto-refresh)
  -> Mimecast SIEM API (paginated fetch)
  -> Transform to NDJSON
  -> Vision One Ingest API (chunked POST)
  -> Save page token to disk
```

**Source**: Mimecast Cloud Gateway Streaming SIEM API (OAuth 2.0, JSON, paginated)
**Destination**: Vision One Data Pipeline API (`/v3.0/xdr/oat/dataPipeline/packageLogs`, Bearer token, NDJSON)

## Quick Start

### Option 1: Docker (Recommended for Most Users)

Pull the pre-built image from GitHub Container Registry:

```bash
# Pull the latest release
docker pull ghcr.io/YOUR_ORG/mimecastlogging:latest

# Or pin to a specific version
docker pull ghcr.io/YOUR_ORG/mimecastlogging:1.0.0
```

Create a `.env` file with your credentials:

```bash
cp .env.example .env
# Edit .env with your Mimecast and Vision One credentials
```

Run it:

```bash
# Using the pre-built image
docker run --env-file .env -v forwarder-state:/app/state ghcr.io/YOUR_ORG/mimecastlogging:latest

# Or with docker compose (if you cloned the repo)
docker compose --env-file .env up -d
```

### Option 2: Clone and Run Directly

```bash
git clone https://github.com/YOUR_ORG/mimecastlogging.git
cd mimecastlogging
npm install
cp .env.example .env
# Edit .env with your credentials
npm run build
npm start
```

For development with hot reload:

```bash
npm run dev
```

### Option 3: Git Submodule

If you want to embed this in a larger infrastructure repo:

```bash
cd your-infra-repo
git submodule add https://github.com/YOUR_ORG/mimecastlogging.git tools/mimecast-forwarder
cd tools/mimecast-forwarder
npm install && npm run build
```

### Option 4: Azure Functions (Serverless)

Deploy to Azure using the included IaC templates. See [Azure Deployment](#azure-deployment) below.

## Configuration

All configuration is via environment variables. Copy `.env.example` to `.env` and fill in the values:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MIMECAST_BASE_URL` | Yes | `https://api.services.mimecast.com` | Mimecast API base URL |
| `MIMECAST_CLIENT_ID` | Yes | | OAuth 2.0 client ID from Mimecast admin console |
| `MIMECAST_CLIENT_SECRET` | Yes | | OAuth 2.0 client secret |
| `MIMECAST_EVENT_TYPES` | Yes | `receipt,ttp-url,ttp-attachment,ttp-impersonation` | Comma-separated event types to fetch |
| `VISIONONE_INGEST_URL` | Yes | | Vision One SIEM ingestion endpoint URL (e.g. `https://xlogr-ase2.xdr.trendmicro.com/ingest/api/v1/third_party_log/raw`) |
| `VISIONONE_INGEST_TOKEN` | Yes | | Vision One API token with log ingestion permissions |
| `VISIONONE_VENDOR` | No | `Mimecast` | Vendor name sent to Vision One |
| `VISIONONE_PRODUCT` | No | `Email Security` | Product name sent to Vision One |
| `POLL_INTERVAL_MS` | No | `300000` | Poll interval in milliseconds (min: 10s, max: 1hr) |
| `LOG_LEVEL` | No | `info` | Log level: `fatal`, `error`, `warn`, `info`, `debug`, `trace` |

### Setting Up Mimecast API 2.0

This forwarder uses the **Mimecast API 2.0** platform with OAuth 2.0 authentication. API 1.0 (legacy HMAC-based auth) is being sunset — new API 1.0 applications can no longer be created.

#### Step 1: Create an API 2.0 Application

1. Log in to the **Mimecast Administration Console**
2. Navigate to **Services** > **API and Platform Integrations**
3. Click **Add API Application** (or **Your Application Integrations** > **Add New**)
4. Fill in the application details:

| Field | Suggested Value | Notes |
|-------|----------------|-------|
| **Integration Name** | `TrendMicro Vision One SIEM Integration` | Descriptive name for your reference |
| **Application Name** | `Vision One SIEM Integration` | **Cannot be changed after creation** — choose carefully |
| **Products** | **Threats, Security Events and Data for CG** | Required — this grants access to the `/siem/v1/events/cg` endpoint |
| **API Service Account** | Create a custom role with read-only SIEM access | Principle of least privilege — only needs to read events |
| **Description** | `Forwards Mimecast SIEM events to Trend Micro Vision One XDR` | For audit trail |

> **Note on Products**: Only select **Audit Events** if you also want to forward admin audit logs. For security event forwarding, **Threats, Security Events and Data for CG** is the required product group.

5. Accept the API Terms and Conditions
6. Click **Create**

#### Step 2: Get Your Client Credentials

After creating the application:

1. Open the application you just created
2. Copy the **Client ID** → set as `MIMECAST_CLIENT_ID`
3. Copy the **Client Secret** → set as `MIMECAST_CLIENT_SECRET`

> **Security**: Store these credentials securely. In production, use Azure Key Vault references or environment-level secrets — never commit them to source control.

#### Step 3: Determine Your Base URL

Set `MIMECAST_BASE_URL` based on your Mimecast tenant region. For API 2.0, the global endpoint auto-routes to the nearest instance:

- **Recommended**: `https://api.services.mimecast.com` (global auto-routing)
- See [Mimecast Regional Base URLs](#mimecast-regional-base-urls) below for region-specific endpoints

#### Step 4: Verify the Integration

Test your credentials with a quick curl:

```bash
# Get an OAuth token
curl -X POST https://api.services.mimecast.com/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET"

# Fetch events (replace YOUR_TOKEN with the access_token from above)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://api.services.mimecast.com/siem/v1/events/cg"
```

A successful response returns `{ "data": [...], "meta": { ... } }`.

#### API 2.0 Rate Limits

| Constraint | Value |
|------------|-------|
| Stream API calls | 300 per hour |
| Events per page | 100 maximum |
| Max throughput (stream) | ~30,000 events/hour |
| Token validity | 30 minutes |

The forwarder has a built-in sliding window rate limiter matching these limits.

### Setting Up Vision One

1. Log in to the **Vision One console**
2. Navigate to **Administration** > **API Keys**
3. Create a new API key with **Run custom scripts** or **Third-party integration** permissions
4. Note the regional API base URL for your tenant (e.g., `https://api.xdr.trendmicro.com` for US)
5. Set `VISIONONE_INGEST_TOKEN` to your API key and `VISIONONE_BASE_URL` to your regional URL

### Vision One Regional Base URLs

| Region | Base URL |
|--------|----------|
| US | `https://api.xdr.trendmicro.com` |
| EU | `https://api.eu.xdr.trendmicro.com` |
| Japan | `https://api.jp.xdr.trendmicro.com` |
| Singapore | `https://api.sg.xdr.trendmicro.com` |
| Australia | `https://api.au.xdr.trendmicro.com` |
| India | `https://api.in.xdr.trendmicro.com` |

### Mimecast Regional Base URLs

| Region | Base URL |
|--------|----------|
| Global | `https://api.services.mimecast.com` |
| EU | `https://eu-api.mimecast.com` |
| DE | `https://de-api.mimecast.com` |
| US | `https://us-api.mimecast.com` |
| AU | `https://au-api.mimecast.com` |
| ZA | `https://za-api.mimecast.com` |
| Offshore | `https://je-api.mimecast.com` |
| USB | `https://usb-api.mimecast.com` |

## Mimecast Event Types

The `MIMECAST_EVENT_TYPES` variable controls which event types are fetched. Available types include:

| Event Type | Description |
|------------|-------------|
| `receipt` | Email receipt and delivery events |
| `process` | Email processing events |
| `delivery` | Outbound delivery events |
| `ttp-url` | Targeted Threat Protection - URL click events |
| `ttp-attachment` | Targeted Threat Protection - attachment sandbox events |
| `ttp-impersonation` | Targeted Threat Protection - impersonation detection |
| `spam` | Spam detection events |
| `av` | Anti-virus detection events |
| `journal` | Journal events |

Set multiple types as a comma-separated list:

```
MIMECAST_EVENT_TYPES=receipt,ttp-url,ttp-attachment,ttp-impersonation
```

## Azure Deployment

The project ships with both **Bicep** and **Terraform** IaC templates. Use whichever your team standardises on.

### Architecture

```
Azure Resource Group
  +-- Azure Functions (Timer Trigger, 5 min)  -- runs the forwarder
  +-- Key Vault                                -- stores Mimecast + V1 secrets
  +-- Storage Account                          -- function runtime + poller state
  +-- Application Insights                     -- monitoring and alerting
```

Estimated cost: **$5-25/month** on a Consumption Plan.

### Deploy with Bicep

```bash
# Create resource group
az group create --name rg-mcvone-dev --location australiaeast

# Deploy infrastructure
az deployment group create \
  --resource-group rg-mcvone-dev \
  --template-file infra/bicep/main.bicep \
  --parameters infra/bicep/parameters/dev.bicepparam \
  --parameters \
    mimecastClientId="YOUR_CLIENT_ID" \
    mimecastClientSecret="YOUR_CLIENT_SECRET" \
    visionOneIngestToken="YOUR_V1_TOKEN"
```

### Deploy with Terraform

```bash
cd infra/terraform

terraform init
terraform plan -var-file=environments/dev.tfvars \
  -var="mimecast_client_id=YOUR_CLIENT_ID" \
  -var="mimecast_client_secret=YOUR_CLIENT_SECRET" \
  -var="visionone_ingest_token=YOUR_V1_TOKEN"

terraform apply -var-file=environments/dev.tfvars \
  -var="mimecast_client_id=YOUR_CLIENT_ID" \
  -var="mimecast_client_secret=YOUR_CLIENT_SECRET" \
  -var="visionone_ingest_token=YOUR_V1_TOKEN"
```

### CI/CD Pipelines

Pre-built pipelines are included for both **GitHub Actions** and **Azure DevOps**.

**GitHub Actions** (`.github/workflows/`):
- `ci.yml` -- lint + test on every PR and push to main
- `deploy.yml` -- manual dispatch to deploy (choose environment + IaC tool)
- `release.yml` -- auto-builds Docker image and GitHub release on version tags

**Azure DevOps** (`.azuredevops/pipelines/`):
- `ci.yml` -- lint + test on every PR and push to main
- `deploy.yml` -- parameterised deploy (choose environment + IaC tool)

#### GitHub Actions Secrets Required

| Secret | Description |
|--------|-------------|
| `AZURE_CLIENT_ID` | Service principal client ID |
| `AZURE_TENANT_ID` | Azure AD tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID |
| `MIMECAST_CLIENT_ID` | Mimecast OAuth client ID |
| `MIMECAST_CLIENT_SECRET` | Mimecast OAuth client secret |
| `VISIONONE_INGEST_TOKEN` | Vision One API token |

## Releases and Docker Images

Every tagged release (`v1.0.0`, `v1.1.0`, etc.) automatically:

1. Runs the full test suite
2. Builds and publishes a Docker image to GitHub Container Registry
3. Creates a GitHub Release with a downloadable zip of the compiled code

To create a release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The Docker image is then available at:

```bash
docker pull ghcr.io/YOUR_ORG/mimecastlogging:1.0.0
docker pull ghcr.io/YOUR_ORG/mimecastlogging:latest
```

## Project Structure

```
src/
  index.ts                       -- entry point, wires dependencies, starts poller
  config/config.ts               -- env var loading and validation (zod)
  auth/
    auth.types.ts                -- OAuth token types
    oauth-client.ts              -- OAuth 2.0 client_credentials with token cache
  mimecast/
    mimecast.types.ts            -- Mimecast event and API response types
    mimecast-client.ts           -- SIEM API client with pagination + rate limiting
  transformer/transformer.ts     -- JSON array to NDJSON conversion + chunking
  visionone/
    visionone.types.ts           -- Vision One ingest types
    visionone-client.ts          -- Ingest API client with retry + chunking
  poller/
    poller.ts                    -- Poll loop orchestration
    state-store.ts               -- Atomic page token persistence
  shared/
    logger.ts                    -- Structured logging (pino)
    errors.ts                    -- Error hierarchy (AppError, AuthError, etc.)
    rate-limiter.ts              -- Sliding window rate limiter (300 req/hr)
tests/
  unit/                          -- Unit tests for each module (mocked deps)
  integration/                   -- End-to-end pipeline test (mocked HTTP)
infra/
  bicep/                         -- Azure Bicep IaC templates
  terraform/                     -- Terraform IaC templates
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Run locally
npm run dev

# Lint
npm run lint
```

### Design Principles

- **Dependency injection** throughout -- every module accepts its dependencies via constructor, making testing straightforward
- **London School TDD** -- all unit tests use mocks for external dependencies
- **Rate limiting** -- sliding window of 300 calls/hour to respect Mimecast API limits
- **Atomic state persistence** -- writes to temp file then renames to prevent corruption on crash
- **Retry with exponential backoff** -- handles transient 5xx errors from Vision One
- **Chunked uploads** -- splits NDJSON payloads at 4MB boundaries for Vision One's size limits

## Troubleshooting

### No events appearing in Vision One

1. Check `LOG_LEVEL=debug` for detailed request/response logging
2. Verify your Vision One token has ingestion permissions
3. Confirm the regional base URL matches your Vision One tenant
4. Check that `MIMECAST_EVENT_TYPES` includes the types you expect

### Rate limit errors (429)

The forwarder has a built-in sliding window rate limiter (300 requests/hour) and stops pagination when headroom drops below 10 requests. If you still see 429 errors, increase `POLL_INTERVAL_MS` to reduce polling frequency.

### OAuth token errors

1. Verify your Mimecast Client ID and Client Secret are correct
2. Ensure the API application is enabled in the Mimecast admin console
3. Check the Mimecast base URL matches your account region

### State file issues

The forwarder persists its pagination token to `state/poller-state.json`. If you need to re-fetch all events from scratch, delete this file:

```bash
rm state/poller-state.json
```

## Cost Notes

- **Mimecast API**: Included with your email security license (confirm with your Mimecast account manager)
- **Vision One Ingest**: Uses Vision One credits for data ingestion (confirm your credit allocation with Trend Micro)
- **Azure infrastructure**: ~$5-25/month on a Consumption Plan (scales to zero when idle)
- **Docker/self-hosted**: No additional cloud costs beyond your existing infrastructure

## Contributing

Contributions are welcome and encouraged! This is an open-source project and we'd love your help making it better.

### How to Contribute

1. **Fork** the repository
2. **Create a feature branch** (`git checkout -b feat/my-improvement`)
3. **Make your changes** -- follow the existing code style and add tests
4. **Run the tests** (`npm test`) and ensure they pass
5. **Submit a Pull Request** with a clear description of what you changed and why

### Ideas for Contributions

- Support for additional SIEM destinations (Splunk, Sentinel, Elastic, etc.)
- Azure Blob Storage backend for state persistence (replacing local file)
- Helm chart for Kubernetes deployment
- Configurable event filtering and transformation rules
- Metrics endpoint (Prometheus) for monitoring
- Additional Mimecast API endpoints (DLP, awareness training, etc.)
- ARM64 Docker image builds
- Integration test suite with real API sandboxes

### Reporting Issues

Found a bug or have a feature request? [Open an issue](../../issues) -- we respond to all of them.

### Code of Conduct

Be kind, be constructive, and be respectful. We're all here to build something useful.

## License

MIT
