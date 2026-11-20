# 🚀 Group Launchpad

**Group Launchpad** is a student group management platform that automates the creation and management of educational groups across multiple services.

Instead of manually creating channels, courses, folders and forms, coordinators can manage everything from one dashboard.

## ✨ Features

- Create and manage student groups.
- Automatically create Slack channels.
- Send welcome messages, staff introductions and group rules.
- Create Google Drive folders.
- Create Google Classroom courses.
- Generate Google Forms for student information.
- Synchronize Google Forms responses with PostgreSQL.
- Audit Slack group membership.
- Schedule group announcements.
- Run daily automated membership checks.

## 🛠 Tech Stack

**Backend:** Node.js, Express.js, PostgreSQL  
**Frontend:** HTML, CSS, JavaScript  
**Integrations:** Slack API, Google Drive API, Google Classroom API, Google Forms API, Google OAuth 2.0

## 📋 Requirements

Before running the project locally, install:

- Node.js (20 or newer)
- npm
- PostgreSQL
- A Slack workspace and Slack Bot Token
- A Google Cloud project with Drive, Classroom and Forms APIs enabled

## 📥 Installation

Clone the repository:

```bash
git clone git@github.com:Vach-Hakobyan/group-launchpad.git
cd group-launchpad
```

Install dependencies:

```bash
npm install
```

## ⚙️ Configuration

Create a `.env` file in the project root directory.

Add the following variables:

```env
PORT=3000

DB_USER=your_database_user
DB_HOST=localhost
DB_NAME=group_launchpad
DB_PASSWORD=your_database_password
DB_PORT=5432

SLACK_BOT_TOKEN=your_slack_bot_token

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
```

Replace the example values with your own credentials.

**Important:** Never upload `.env`, Google tokens or API secrets to GitHub.

### PostgreSQL

Create a PostgreSQL database named `group_launchpad` and configure the database user.

The application requires these tables:

- `groups`
- `students`
- `lecturers`
- `announcement_logs`

The database schema must be initialized before using the application.

### Slack Setup

1. Create a Slack App in the Slack API dashboard.
2. Install the app into your workspace.
3. Configure the required Bot Token Scopes.
4. Add the bot token to `.env`.

The application uses Slack to create channels, invite existing workspace members and send messages.

### Google Setup

1. Create a project in Google Cloud Console.
2. Enable Google Drive API, Google Classroom API and Google Forms API.
3. Configure OAuth 2.0 credentials.
4. Add the redirect URI:

```text
http://localhost:3000/auth/google/callback
```

5. Add your Google credentials to `.env`.

## ▶️ Running the Application

Start the server:

```bash
npm start
```

Expected output:

```text
Server is running on port 3000
Announcement scheduler started
```

Open the dashboard in your browser:

```text
http://localhost:3000
```

## 🖥️ How to Use the Dashboard

### 1. Connect Google

Open this address in your browser:

```text
http://localhost:3000/auth/google
```

Sign in with your Google account and grant the requested permissions.

After successful authorization, the application stores the Google OAuth tokens locally.

### 2. Create a Group

1. Open the Group Launchpad dashboard.
2. Enter the group name and start date.
3. Submit the form to create the group.
4. The application creates the group and attempts to provision its connected resources.

Depending on the configured integrations, these resources include:

- A Slack channel.
- A Google Drive folder.
- A Google Classroom course.
- A Google Form.

The dashboard displays the available resource links.

### 3. Manage Students and Lecturers

Use the group management features and API to add student and lecturer email addresses.

Students can submit their information through the generated Google Form.

### 4. Synchronize Form Responses

Use the synchronization endpoint to import Google Forms responses into PostgreSQL.

```http
POST /api/groups/:id/sync-form-responses
```

The application avoids importing the same form response more than once.

### 5. Audit Slack Membership

Run a membership audit for a group:

```http
POST /api/groups/:id/audit
```

The application checks which students have joined the group's Slack channel and can send a reminder message for missing members.

### 6. Automated Announcements

The application includes a scheduler configured for the `Asia/Yerevan` timezone.

It checks for groups starting today or in three days and runs daily membership audits.

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/groups` | Get all groups |
| POST | `/api/groups` | Create a group |
| GET | `/api/groups/:id` | Get a group |
| PATCH | `/api/groups/:id` | Update a group |
| PUT | `/api/groups/:id` | Replace a group |
| DELETE | `/api/groups/:id` | Delete a group |
| POST | `/api/groups/:id/members` | Add group members |
| POST | `/api/groups/:id/sync-form-responses` | Synchronize form responses |
| POST | `/api/groups/:id/audit` | Audit Slack membership |
| GET | `/auth/google` | Start Google authorization |
| GET | `/auth/google/callback` | Handle Google authorization callback |

## 📁 Project Structure

```text
group-launchpad/
├── public/
│   └── index.html
├── src/
│   ├── config/
│   ├── controllers/
│   ├── integrations/
│   │   ├── google/
│   │   └── slack/
│   ├── routes/
│   ├── services/
│   └── server.js
├── .env
├── .gitignore
├── package.json
└── README.md
```

## 🔐 Security Notes

- Keep credentials in environment variables.
- Never commit `.env` or `.tokens/` to GitHub.
- Use OAuth 2.0 for Google authorization.
- Use parameterized SQL queries.
- Protect API credentials and database access.

## 🎯 Project Goal

Group Launchpad aims to simplify educational group administration by automating repetitive tasks and connecting multiple services through one platform.
