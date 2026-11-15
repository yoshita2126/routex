# RouteX — MERN Stack Route Planner

RouteX is a full-stack **MERN** (MongoDB, Express, React, Node.js) web application for smart route planning. Enter two locations to geocode them with Nominatim, request driving, cycling, walking, or transit routes from OSRM, view them on interactive Leaflet OpenStreetMap tiles, and authenticate to save journeys into your local MongoDB database.

---

## MERN Architecture Overview

- **M (MongoDB):** Connected to `mongodb://localhost:27017/routex` storing user accounts (with salted `bcrypt` password hashes) and user-saved travel itineraries.
- **E (Express.js):** REST API with JWT-based authentication middleware, input validation, and user/route controllers.
- **R (React.js):** Modern React (Vite) frontend with Register and Login pages, password strength visualization, Leaflet interactive map, and Saved Journeys dashboard.
- **N (Node.js):** Runtime powering the backend server and scripts.

---

## Quick Start

### 1. Ensure MongoDB is Running
Make sure your local MongoDB instance is running on port `27017`:
```bash
mongodb://localhost:27017/
```

### 2. Start the Application
From the project root:

- **Start production server** (Express API + React UI on port 5000):
  ```bash
  npm start
  ```
  Open: <http://localhost:5000>

- **Start Vite frontend dev server** (port 5173 with API proxy):
  ```bash
  npm run client
  ```
  Open: <http://localhost:5173>

---

## Authentication & Database

### Pre-seeded Demo Account
You can register a new account on the Register page, or use the seeded demo account:
- **Email:** `traveler@routex.io`
- **Password:** `RouteX2026!`

The Login page includes a **"Fill Demo Info"** button for quick 1-click testing.

### API Endpoints

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register new user account | No |
| `POST` | `/api/auth/login` | Authenticate user & issue JWT | No |
| `GET` | `/api/auth/me` | Fetch logged-in user details | Yes (Bearer JWT) |
| `POST` | `/api/routes` | Save route to MongoDB profile | Yes (Bearer JWT) |
| `GET` | `/api/routes` | Retrieve user's saved routes | Yes (Bearer JWT) |
| `DELETE` | `/api/routes/:id` | Delete saved route from database | Yes (Bearer JWT) |
| `GET` | `/api/health` | Service and MongoDB status check | No |

---

## Features

1. **User Registration (`/register`):**
   - Full name, email, password, confirm password.
   - Real-time password strength meter (Weak / Fair / Good / Strong).
   - Duplicate email validation and secure password hashing with `bcryptjs`.
2. **User Login (`/login`):**
   - Email & password authentication with show/hide password toggle.
   - JWT token storage in `localStorage`.
   - "Remember me" option and instant demo account autofill.
3. **Interactive Map Planner:**
   - Geocode addresses with Nominatim.
   - Interactive "Pin on Map" tool for starting point and destination.
   - GPS "Use My Location" browser geolocation.
   - Multi-modal routing: Car, Bike, Walking, and Bus.
4. **MongoDB Route Persistence:**
   - Logged-in users can click **"Save Route to Account"** on any planned trip.
   - Stored routes appear under **"Saved Routes"** with distances, durations, and quick "View on Map" re-loading.
