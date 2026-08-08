# SenseWay

SenseWay is a web application that recommends less sensory-intensive walking routes based on user sensory preferences, Google Maps, and Melbourne Open Data.

---

## Tech Stack

### Frontend

- React
- Vite

### Backend

- Node.js
- Express.js

### Database

- PostgreSQL

### External APIs

- Google Maps API
- Melbourne Open Data API

### Deployment

- Google Cloud

---

## Project Structure

```
SenseWay/
├── frontend/
├── backend/
├── database/
├── .gitignore
└── README.md
```

---

## Prerequisites

Install the following before running the project:

- Git
- Node.js (LTS version)
- Visual Studio Code
- PostgreSQL
- npm (comes with Node.js)

---

## Clone the Repository

---

## Frontend Setup

Navigate to the frontend folder:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

---

## Backend Setup

Open a new terminal.

Navigate to the backend folder:

```bash
cd backend
```

Install dependencies:

```bash
npm install
```

Start the backend server:

```bash
npm run dev
```

## Database Setup

Install PostgreSQL.

Create a database named:

```
senseway
```

Run the SQL scripts in order:

1. `database/schema.sql`
2. `database/seed.sql`

Update the database credentials in:

```
backend/.env
```

Example:

```env
PORT=0000

DB_HOST=localhost
DB_PORT=0000
DB_NAME=senseway
DB_USER=postgres
DB_PASSWORD= password-  Provided in Team (do not commit this credentials)

GOOGLE_MAPS_API_KEY= google_maps_api_key
```

---

## Running the Project

Start the backend:

```bash
cd backend
npm run dev
```

Start the frontend in a separate terminal:

```bash
cd frontend
npm run dev
```

Open the application:

---

## Team Workflow

After pulling the latest changes:

```bash
git pull
```

If new dependencies have been added:

```bash
cd frontend
npm install

cd ../backend
npm install
```

---

## Branch Strategy

- `main` – Stable production-ready code
- `develop` – Integration branch
