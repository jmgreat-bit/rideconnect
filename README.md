# RideConnect

A real-time ride-sharing app connecting drivers and passengers on a live map.

## Tech Stack

- **Frontend**: React + TypeScript + TailwindCSS v4
- **Backend**: Supabase (Realtime + Database)
- **Map**: Leaflet + OpenStreetMap
- **State**: Zustand
- **Build**: Vite

## Features

- 🗺️ Live map with driver/passenger markers
- 💬 Real-time chat messaging
- 🧭 In-app route navigation (OSRM)
- ⚡ Live user location tracking
- 🔒 Premium mode (extended visibility radius)

## Setup

1. Clone the repo
2. Copy `.env.example` to `.env.local` and fill in your Supabase credentials
3. Run `npm install`
4. Run `npm run dev`
5. Open `http://localhost:3000`

## Environment Variables

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```
