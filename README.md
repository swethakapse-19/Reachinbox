# ReachInbox – Email Scheduler

ReachInbox is a full-stack email scheduling application that allows users to authenticate with Google, configure email senders, schedule individual or bulk emails, monitor scheduled and sent emails, and process delayed email jobs using BullMQ and Redis.

## Project Overview

Users can:
- Sign in using Google OAuth
- Configure email senders
- Compose individual or bulk emails
- Upload CSV/TXT recipients
- Configure start time and delay
- View Scheduled and Sent emails
- Search emails
- Monitor BullMQ jobs
- Configure worker concurrency and rate limits
- Use Ethereal Email for SMTP testing

## Tech Stack

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS

### Backend
- Node.js
- Express
- TypeScript
- Prisma ORM
- PostgreSQL
- BullMQ
- Redis
- Nodemailer
- Ethereal Email
- Elasticsearch
- Google OAuth 2.0
- JWT authentication

## Project Structure

```text
Reachinbox/
├── backend/src/
│   ├── lib/
│   ├── routes/
│   ├── workers/
│   └── server.ts
├── frontend/src/
├── prisma/schema.prisma
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Prerequisites

- Node.js 18+
- npm
- PostgreSQL
- Redis
- Git
- Google Cloud OAuth credentials
- Ethereal Email account
- Elasticsearch

## Environment Variables

Create a `.env` file and configure the following values:

```env
DATABASE_URL="your-postgresql-connection-string"
REDIS_HOST="localhost"
REDIS_PORT=6379
ETHEREAL_HOST="smtp.ethereal.email"
ETHEREAL_PORT=587
ETHEREAL_USER="your-ethereal-username"
ETHEREAL_PASS="your-ethereal-password"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:5000/api/auth/google/callback"
FRONTEND_URL="http://localhost:5173"
AUTH_JWT_SECRET="your-jwt-secret"
WORKER_CONCURRENCY=5
MIN_SEND_DELAY_MS=1000
EMAILS_PER_HOUR=1
ELASTICSEARCH_URL="your-elasticsearch-url"
SLACK_CLIENT_ID="your-slack-client-id"
SLACK_CLIENT_SECRET="your-slack-client-secret"
SLACK_REDIRECT_URI="your-slack-redirect-uri"
```

Never commit the real `.env` file or secret credentials.

## Ethereal Email Setup

Ethereal Email is used as the SMTP service for testing and demonstration. Create a test account, copy the SMTP credentials, and add them to `.env`. Nodemailer sends scheduled emails through Ethereal SMTP and provides a preview URL for test messages.

## Backend Setup

From the project root:

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

Backend: `http://localhost:5000`

Health check: `http://localhost:5000/health`

## Frontend Setup

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:5173`

## Architecture

```text
React Frontend
      |
      v
 Express API
   /       \
  v         v
PostgreSQL  Redis
              |
              v
         BullMQ Queue
              |
              v
         Email Worker
              |
              v
          Nodemailer
              |
              v
        Ethereal SMTP

       Elasticsearch
             ^
             |
        Email Search
```

## Scheduling Flow

1. User schedules an email.
2. React sends the API request.
3. Express creates the email record in PostgreSQL.
4. A delayed BullMQ job is created.
5. Redis stores the queue/job information.
6. When the scheduled time arrives, BullMQ releases the job.
7. The worker processes the job.
8. Nodemailer sends the email through Ethereal.
9. PostgreSQL is updated with the final status.

## Persistence on Restart

The application does not rely on in-memory timers or cron jobs for scheduling. PostgreSQL stores email/application state while Redis/BullMQ stores delayed queue jobs. After a backend restart, the worker reconnects to Redis and continues processing available jobs.

## Concurrency

Worker concurrency is configurable:

```env
WORKER_CONCURRENCY=5
```

This controls how many BullMQ jobs can be processed concurrently.

## Rate Limiting

The hourly email limit is configurable:

```env
EMAILS_PER_HOUR=1
```

When the configured limit is reached, the job is rescheduled for a later time rather than intentionally dropped.

```text
Email job
   ↓
Rate limit reached
   ↓
Calculate retry window
   ↓
Reschedule job
   ↓
Process later
```

## Minimum Delay

The minimum delay can be configured with:

```env
MIN_SEND_DELAY_MS=1000
```

This helps avoid uncontrolled bursts of SMTP requests.

## Elasticsearch Search

Email records are indexed in Elasticsearch to support searching scheduled and sent emails by fields such as recipient, subject, body, and status.

## Implemented Backend Features

- Individual email scheduling
- Bulk email scheduling
- BullMQ delayed jobs
- Redis-backed queue
- PostgreSQL persistence
- Configurable worker concurrency
- Configurable email rate limit
- Rate-limit rescheduling
- Minimum send delay configuration
- Nodemailer + Ethereal SMTP
- Email status tracking
- Google OAuth 2.0
- JWT authentication
- Elasticsearch search
- BullMQ dashboard
- Multiple sender support
- Slack OAuth integration and rate-limit notifications

## Implemented Frontend Features

### Authentication
- Google login
- Dashboard redirect
- User name, email, and avatar
- Logout

### Dashboard
- Scheduled emails
- Sent emails
- Search
- Statistics
- Loading, empty, and error states
- Queue monitoring

### Compose
- Sender selection
- Recipients
- Subject
- Email body
- Start time
- Delay between emails
- Schedule action

### Bulk Scheduling
- CSV upload
- TXT upload
- Recipient count
- Bulk scheduling

### Sender Management
- Add sender
- View senders
- Enable/disable sender

### Slack
- Slack OAuth connection
- Connection status
- Disconnect support
- Rate-limit notification support

## API Endpoints

### Authentication

```text
GET  /api/auth/google
GET  /api/auth/google/callback
GET  /api/auth/me
POST /api/auth/logout
```

### Emails

```text
POST /api/emails/schedule
POST /api/emails/schedule-bulk
GET  /api/emails
GET  /api/emails/search
```

### Senders

```text
GET   /api/senders
POST  /api/senders
PATCH /api/senders/:id
```

### Slack

```text
GET  /api/slack/oauth/start
GET  /api/slack/oauth/callback
GET  /api/slack/status
POST /api/slack/disconnect
```

### Health

```text
GET /health
GET /db-test
```

### BullMQ Dashboard

`http://localhost:5000/admin/queues`

## Testing

Typical test flow:

1. Start PostgreSQL.
2. Start Redis.
3. Start the backend.
4. Start the frontend.
5. Sign in with Google.
6. Configure a sender.
7. Compose an email.
8. Select a future start time.
9. Configure the delay.
10. Schedule the email.
11. Verify it appears in Scheduled.
12. Wait for processing.
13. Verify it appears in Sent.
14. Verify the Ethereal preview URL.

## Restart Test

1. Schedule an email for a future time.
2. Stop the backend.
3. Start the backend again.
4. Verify the scheduled email still exists.
5. Verify the BullMQ worker continues processing the job when its scheduled time arrives.

## Bulk Load Testing

The system supports large batches of scheduled jobs:

```text
1000 recipients
      ↓
1000 email records
      ↓
1000 BullMQ jobs
      ↓
Redis
      ↓
Worker
      ↓
Concurrency + delay + rate-limit controls
```

## Demo Video

Keep the demo within the required 5-minute limit. Suggested flow:

```text
0:00 - 0:30  Google Login
0:30 - 1:30  Compose and schedule email
1:30 - 2:15  Scheduled emails
2:15 - 3:00  Sent emails / Ethereal preview
3:00 - 4:00  Restart and persistence test
4:00 - 4:40  Bulk scheduling / queue / rate limit
4:40 - 5:00  Architecture overview
```

## Assumptions

- Ethereal Email is used for development and demonstration instead of production email delivery.
- PostgreSQL is the persistent source of truth for application and email records.
- Redis is used by BullMQ for queue management and delayed jobs.
- Worker concurrency is configurable through environment variables.
- Email rate limits are configurable through environment variables.
- Elasticsearch is used for email search.
- Google OAuth credentials are provided through environment variables.
- The application is intended as an assignment/demo system rather than production email infrastructure.

## Trade-offs

- Ethereal Email is suitable for testing but is not intended for production email delivery.
- The system prioritizes persistent queue-based scheduling rather than implementing production-scale email infrastructure.
- PostgreSQL stores application state while Redis/BullMQ manages delayed job execution.
- Elasticsearch provides dedicated search capabilities but introduces an additional service dependency.
- Configurable concurrency and rate limiting provide control over email processing.
- Environment-based configuration keeps operational limits outside application code.

## Security

Never commit:

- Google Client Secret
- Database passwords
- Ethereal password
- JWT secret
- Redis credentials
- Elasticsearch credentials
- Slack credentials

Use `.env` for local secrets and `.env.example` for documenting required variables.

## Running the Complete Application

### Terminal 1 – Redis

Start Redis.

### Terminal 2 – Backend

```bash
npm run dev
```

### Terminal 3 – Frontend

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173`.

## Submission Checklist

- [ ] GitHub repository is private
- [ ] Mitrajit added as collaborator
- [ ] Yadav036 added as collaborator
- [ ] README.md included
- [ ] `.env` excluded from Git
- [ ] `.env.example` included
- [ ] Demo video is 5 minutes or less
- [ ] Application can be started from the README
- [ ] Assumptions documented
- [ ] Trade-offs documented
- [ ] Google OAuth demonstrated
- [ ] Email scheduling demonstrated
- [ ] Scheduled/Sent views demonstrated
- [ ] Queue/BullMQ functionality demonstrated
- [ ] Restart persistence demonstrated
