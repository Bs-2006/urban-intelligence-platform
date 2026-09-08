# Urban Intelligence Platform — Frontend

Government Operations Center for AI-powered bus-camera detection + citizen reporting.

## Setup
```
npm install
```
Create `.env` from `.env.example`:
```
VITE_API_BASE_URL=http://localhost:8000
```
Run:
```
npm run dev    # http://localhost:5173
npm run build
npm run preview
```

## Backend Endpoints Used
- POST /auth/login (x-www-form-urlencoded)
- GET /users/me, PATCH /users/me
- GET/POST/PATCH /incidents, POST /incidents/{id}/image
- GET/POST/PATCH /work
- GET /buses, /routes, /bus-stands

## Missing / To Implement on Backend
| Needed | Status | Note |
|---|---|---|
| POST /public/incidents | Missing | Citizen unauthenticated report. Frontend calls this via `createPublicIncident()`. Shows clear error if 404. |
| GET /users (list workers) | Missing/uncertain | Needed for worker dropdown in Assign modal. Currently manual ID entry with warning. |
| district / ward on IncidentOut | Missing | Frontend has architecture ready but backend lacks field. District filter shows warning. |

Do not fake success for these — UI shows development error.

## Roles
- admin / transport_officer ? /dashboard
- worker ? /worker
- citizen ? blocked from gov dashboard

## Tech
React 18 + Vite + TS + React Router + Axios + Tailwind + Leaflet + Lucide
