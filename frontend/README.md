# ReachInbox – Email Scheduler

ReachInbox is a full-stack email scheduling application that allows users to authenticate with Google, configure email senders, schedule individual or bulk emails, monitor scheduled and sent emails, and process delayed email jobs using BullMQ and Redis.

The system is designed to handle large numbers of scheduled emails while maintaining persistence across backend restarts.

---

## 1. Project Overview

ReachInbox provides a dashboard for managing scheduled email campaigns.

Users can:

* Sign in using Google OAuth
* Configure email senders
* Compose emails
* Schedule individual emails
* Schedule bulk emails
* Upload recipients through CSV/TXT files
* Configure start time
* Configure delay between emails
* View scheduled emails
* View sent emails
* Search emails
* Monitor BullMQ jobs
* Configure worker concurrency
* Configure email rate limits
* Use Ethereal Email for SMTP testing

---

## 2. Tech Stack

### Frontend

* React
* TypeScript
* Vite
* Tailwind CSS
* Modern CSS
* Fetch API

### Backend

* Node.js
* Express
* TypeScript
* Prisma ORM
* PostgreSQL
* BullMQ
* Redis
* Nodemailer
* Ethereal Email
* Elasticsearch
* Google OAuth 2.0
* JWT authentication

### Queue

* BullMQ
* Redis

### Database

* PostgreSQL

### Email

* Nodemailer
* Ethereal SMTP

---

## 3. Project Structure

```text
Reachinbox/
│
├── backend/
│   └── src/
│       ├── lib/
│       │   ├── emailQueue.ts
│       │   ├── elasticsearch.ts
│       │   ├── prisma.ts
│       │   ├── redis.ts
│       │   └── slackNotifier.ts
│       │
│       ├── routes/
│       │   ├── authRoutes.ts
│       │   ├── emailRoutes.ts
│       │   ├── senderRoutes.ts
│       │   ├── slackRoutes.ts
│       │   └── userRoutes.ts
│       │
│       ├── workers/
│       │   └── emailWorker.ts
│       │
│       └── server.ts
│
├── frontend/
│   └── src/
│       ├── components/
│       ├── services/
│       ├── App.tsx
│       ├── main.tsx
│       └── index.css
│
├── prisma/
│   └── schema.prisma
│
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

# 4. Prerequisites

Install the following before running the project:

* Node.js 18+
* npm
* PostgreSQL
* Redis
* Git

The following external services are also required:

* Google Cloud Console for Google OAuth
* Ethereal Email for SMTP testing
* Elasticsearch for email search

---

# 5. Environment Variables

Create a `.env` file in the project root.

Example:

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
```

> Never commit the actual `.env` file or secret credentials to GitHub.

---

# 6. Ethereal Email Setup

Ethereal Email is used as the SMTP service for testing and demonstration.

### Steps

1. Open the Ethereal Email website.
2. Create a test account.
3. Copy the SMTP username.
4. Copy the SMTP password.
5. Configure the values in `.env`.

Example:

```env
ETHEREAL_HOST="smtp.ethereal.email"
ETHEREAL_PORT=587
ETHEREAL_USER="russel.lueilwitz3@ethereal.email"
ETHEREAL_PASS="vX8HnQtKFJxM5ydMBp"
```

The backend uses Nodemailer to connect to the Ethereal SMTP server.

Ethereal provides a preview URL for test emails, which can be opened to inspect the delivered message.

---

# 7. Backend Setup

Navigate to the project directory:

```bash
cd Reachinbox
```

Install dependencies:

```bash
npm install
```

Generate the Prisma client:

```bash
npx prisma generate
```

Run database migrations:

```bash
npx prisma migrate dev
```

Start Redis.

Make sure Redis is running on:

```text
localhost:6379
```

Start the backend:

```bash
npm run dev
```

The backend runs on:

```text
http://localhost:5000
```

Health check:

```text
http://localhost:5000/health
```

Expected response:

```json
{
  "success": true,
  "message": "ReachInbox backend is running"
}
```

---

# 8. BullMQ Worker

The email worker is started automatically with the backend.

The worker listens to the BullMQ email queue:

```text
emailQueue
```

The worker concurrency is configurable through:

```env
WORKER_CONCURRENCY=5
```

For example:

```env
WORKER_CONCURRENCY=10
```

allows up to 10 jobs to be processed concurrently.

The worker retrieves the email record from PostgreSQL, sends the email through Ethereal SMTP, and updates the email status.

---

# 9. Frontend Setup

Open another terminal.

Navigate to the frontend:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the frontend:

```bash
npm run dev
```

The frontend runs on:

```text
http://localhost:5173
```

---

# 10. Architecture Overview

The application follows this architecture:

```text
                    React Frontend
                          │
                          ▼
                    Express API
                          │
             ┌────────────┴────────────┐
             │                         │
             ▼                         ▼
        PostgreSQL                   Redis
             │                         │
             │                    BullMQ Queue
             │                         │
             │                         ▼
             │                    Email Worker
             │                         │
             │                         ▼
             │                  Nodemailer
             │                         │
             │                         ▼
             │                  Ethereal SMTP
             │
             ▼
        Email Records

                 Elasticsearch
                       ▲
                       │
                Email Search
```

---

# 11. How Scheduling Works

When the user schedules an email, the following process occurs:

```text
User schedules email
        ↓
React sends API request
        ↓
Express receives request
        ↓
Email record stored in PostgreSQL
        ↓
BullMQ delayed job created
        ↓
Redis stores queue/job information
        ↓
Scheduled time arrives
        ↓
BullMQ makes job available
        ↓
Email worker processes job
        ↓
Nodemailer sends email
        ↓
Ethereal SMTP
        ↓
PostgreSQL status updated to SENT
```

For bulk scheduling, recipients are processed and individual email jobs are created with the required spacing between messages.

---

# 12. Persistence on Restart

The application does not rely on an in-memory timer or JavaScript `setTimeout()` for scheduled emails.

Scheduled email information is persisted in:

* PostgreSQL
* Redis/BullMQ

The email record is stored in PostgreSQL and the delayed BullMQ job is stored in Redis.

Therefore, restarting the backend does not remove the scheduled email data or the delayed queue job.

After the backend starts again, the BullMQ worker reconnects to Redis and continues processing available jobs.

---

# 13. Concurrency

BullMQ workers support configurable concurrency.

The concurrency is controlled using:

```env
WORKER_CONCURRENCY=5
```

The worker configuration uses this value to determine how many email jobs can be processed concurrently.

Example:

```text
WORKER_CONCURRENCY=5

             BullMQ
                │
      ┌─────────┼─────────┐
      ▼         ▼         ▼
    Job 1     Job 2     Job 3
      ▼         ▼         ▼
   Worker     Worker     Worker
```

This allows the system to process multiple emails without creating an uncontrolled number of concurrent SMTP operations.

---

# 14. Rate Limiting

Email sending is controlled using:

```env
EMAILS_PER_HOUR=1
```

The value can be changed depending on the required sending rate.

When the configured hourly limit is reached:

```text
Email job
    ↓
Rate limit reached
    ↓
Job is rescheduled
    ↓
Job remains in queue
    ↓
Processing continues later
```

The job is not simply discarded.

The system calculates the remaining time in the current rate-limit window and reschedules the email for a later time.

---

# 15. Minimum Delay Between Emails

The minimum delay can be configured using:

```env
MIN_SEND_DELAY_MS=1000
```

For example:

```env
MIN_SEND_DELAY_MS=1000
```

means there should be approximately one second between individual sends where the configured scheduling/rate-limit logic applies.

This helps avoid sending a large number of SMTP requests simultaneously.

---

# 16. Elasticsearch Search

Email records can be searched using Elasticsearch.

Email information is indexed so that the application can search scheduled and sent emails based on searchable fields such as:

* Recipient
* Subject
* Body
* Status

The Elasticsearch index is initialized when the backend starts.

---

# 17. Implemented Features

## Backend

### Scheduler

* Individual email scheduling
* Bulk email scheduling
* Delayed BullMQ jobs
* Configurable email delay

### Persistence

* PostgreSQL email records
* Redis/BullMQ delayed jobs
* Persistent scheduling across backend restarts
* Email status tracking

### Rate Limiting

* Configurable emails-per-hour limit
* Jobs are rescheduled when the limit is reached
* Emails are not intentionally dropped because of the rate limit

### Concurrency

* Configurable BullMQ worker concurrency
* Multiple jobs can be processed concurrently

### Email Sending

* Nodemailer
* Ethereal SMTP
* Sent/failed status tracking
* Ethereal preview URL support

### Authentication

* Google OAuth 2.0
* JWT-based session
* HTTP-only authentication cookie
* Logout functionality

### Search

* Elasticsearch email indexing
* Email search functionality

### Queue Monitoring

* BullMQ dashboard
* Queue/job monitoring

---

# 18. Frontend Features

### Login

* Google OAuth login
* Authenticated dashboard
* User name
* User email
* User avatar
* Logout

### Dashboard

* Email statistics
* Scheduled email list
* Sent email list
* Search
* Refresh
* Loading states
* Empty states
* Error states

### Compose

Users can:

* Select sender
* Enter recipients
* Enter subject
* Enter message
* Select start time
* Configure delay
* Schedule email

### Bulk Scheduling

Users can:

* Upload CSV files
* Upload TXT files
* Parse recipients
* Display recipient count
* Schedule bulk emails

### Sender Management

Users can:

* Add email senders
* View configured senders
* Enable/disable senders

### Queue Monitoring

The application provides access to the BullMQ dashboard for monitoring queued jobs.

---

# 19. Important API Endpoints

## Authentication

```text
GET  /api/auth/google
GET  /api/auth/google/callback
GET  /api/auth/me
POST /api/auth/logout
```

## Emails

```text
POST /api/emails/schedule
POST /api/emails/schedule-bulk
GET  /api/emails
GET  /api/emails/search
```

## Senders

```text
GET   /api/senders
POST  /api/senders
PATCH /api/senders/:id
```

## Health

```text
GET /health
GET /db-test
```

## Queue Dashboard

```text
/admin/queues
```

---

# 20. Testing the Application

A typical test flow is:

```text
1. Start PostgreSQL
2. Start Redis
3. Start backend
4. Start frontend
5. Login with Google
6. Configure sender
7. Compose email
8. Select future start time
9. Configure delay
10. Schedule email
11. Verify Scheduled tab
12. Wait for job execution
13. Verify Sent tab
```

---

# 21. Restart Scenario

To verify persistence:

### Step 1

Schedule an email for a future time.

### Step 2

Stop the backend:

```bash
Ctrl + C
```

### Step 3

Start the backend again:

```bash
npm run dev
```

### Step 4

Verify the scheduled email still exists.

The scheduled job remains persisted through PostgreSQL and Redis/BullMQ and can continue processing after the backend restarts.

---

# 22. Bulk Load Testing

The application supports bulk scheduling and can create a large number of delayed jobs.

For example:

```text
1000 recipients
       ↓
1000 email records
       ↓
1000 BullMQ jobs
       ↓
Redis
       ↓
Worker processes jobs according to
concurrency + delay + rate-limit configuration
```

This allows the system to handle large batches without requiring one in-memory timer per email.

---

# 23. Demo Video

The submission demo video is designed to be less than 5 minutes.

The demonstration covers:

1. Google login
2. Dashboard
3. Creating a scheduled email
4. Scheduled email table
5. Sent email table
6. Bulk scheduling
7. Queue monitoring
8. Backend restart scenario
9. Persistence of scheduled jobs
10. Rate-limit/delay behavior where applicable

---

# 24. Assumptions

* Ethereal Email is used for development and demonstration instead of production email delivery.
* PostgreSQL is treated as the persistent source of truth for email records.
* Redis is used for BullMQ queue and delayed-job persistence.
* Worker concurrency is configurable through environment variables.
* Email sending limits are configurable through environment variables.
* Google OAuth credentials are provided through environment variables.
* Elasticsearch is used for email search functionality.
* The application is intended as an assignment/demo system rather than a production email infrastructure.

---

# 25. Trade-offs

* Ethereal Email is suitable for testing but is not intended for production email delivery.
* The system prioritizes persistent scheduling and queue-based processing rather than implementing a distributed production email platform.
* Configurable concurrency provides controlled parallel processing, while rate limiting and delays prevent uncontrolled sending.
* PostgreSQL stores the application state while Redis/BullMQ manages delayed job execution.
* Elasticsearch provides faster search capabilities but introduces an additional service dependency.
* The current authentication implementation is optimized for the assignment environment and local development.

---

# 26. Security

The following information must never be committed to GitHub:

* Google Client Secret
* Google Client ID where repository policy requires it
* PostgreSQL password
* Ethereal password
* JWT secret
* Redis credentials
* Elasticsearch credentials
* Slack credentials

Use `.env` for local secrets and `.env.example` for documenting required environment variables.

---

# 27. Running the Complete Application

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

Then open:

```text
http://localhost:5173
```

---

# 28. Conclusion

ReachInbox combines React, Express, PostgreSQL, Redis, BullMQ, Nodemailer, Ethereal Email, and Elasticsearch to provide a persistent email scheduling system.

The architecture separates API handling, database persistence, queue management, background processing, and email delivery so that scheduled emails can continue to be managed reliably even when the backend is restarted.

````

### Before pushing to GitHub

Make sure these are present:

```text
README.md       ✅
.env.example    ✅
.gitignore      ✅
backend/        ✅
frontend/       ✅
prisma/         ✅
````


