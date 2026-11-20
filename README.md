# 🚀 Group Launchpad

**Group Launchpad** is a student group management platform that automates the setup of educational groups across multiple services.

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
- Daily automated membership checks.

## 🛠 Tech Stack

**Backend**
- Node.js
- Express.js
- PostgreSQL

**Frontend**
- HTML
- CSS
- JavaScript

**Integrations**
- Slack API
- Google Drive API
- Google Classroom API
- Google Forms API
- Google OAuth 2.0

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
├── .gitignore
├── package.json
└── README.md
