# Supabase Configuration for Express Backend

## Overview
This document describes the Supabase integration for the music streaming platform backend. The backend uses Supabase for authentication and as a PostgreSQL database for storing user data, playlists, tracks, and favorites.

## Environment Variables Required
The following environment variables must be set in the `.env` file:

- `SUPABASE_URL`: The Supabase project URL
- `SUPABASE_KEY`: The Supabase anon/public key (for client operations)

These variables are already mapped in the `.env` file and should be provided by the user.

## Database Schema

### Tables

#### 1. profiles
Stores user profile information.

```sql
CREATE TABLE profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 2. playlists
Stores user-created playlists.

```sql
CREATE TABLE playlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(name) <= 100),
    description TEXT,
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3. tracks
Stores track metadata from Audius.

```sql
CREATE TABLE tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    artist_name TEXT,
    duration_seconds INTEGER,
    audius_track_id TEXT UNIQUE NOT NULL,
    audius_stream_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 4. playlist_items
Junction table linking playlists to tracks.

```sql
CREATE TABLE playlist_items (
    id SERIAL PRIMARY KEY,
    playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(playlist_id, track_id)
);
```

#### 5. favorites
Stores user favorite tracks.

```sql
CREATE TABLE favorites (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, track_id)
);
```

## Row Level Security (RLS) Policies

### profiles table
- Users can view their own profile
- Users can insert their own profile
- Users can update their own profile

### playlists table
- Users can view their own playlists
- Users can view public playlists
- Users can insert playlists where they are the owner
- Users can update their own playlists
- Users can delete their own playlists

### tracks table
- All authenticated users can read tracks
- Tracks are inserted by the application (no direct user insert)

### playlist_items table
- Users can view items in playlists they own
- Users can view items in public playlists
- Users can insert items into playlists they own
- Users can delete items from playlists they own

### favorites table
- Users can view their own favorites
- Users can insert their own favorites
- Users can delete their own favorites

## Migrations

### Setting up the database

Run the following migrations in order:

1. **Create base schema** - Run `docs/supabase_schema.sql`
2. **Add artist_name field** - Run `docs/add_artist_name_migration.sql`
3. **Create favorites table** - Run `docs/create_favorites_table.sql`

### How to run migrations

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste each migration file content
4. Execute the SQL statements

## Authentication Flow

The backend uses Supabase Auth with the following flow:

1. **Registration** (`POST /api/auth/register`):
   - Creates user via Supabase Auth
   - Creates corresponding profile record
   - Returns access and refresh tokens

2. **Login** (`POST /api/auth/login`):
   - Authenticates via Supabase Auth
   - Returns access and refresh tokens

3. **Protected Routes**:
   - Use `authenticateToken` middleware
   - Middleware extracts JWT from Authorization header
   - Verifies token with Supabase
   - Creates user-scoped Supabase client for RLS enforcement
   - Attaches `req.user` and `req.supabase` to request object

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Profile
- `GET /api/profile` - Get current user's profile
- `PUT /api/profile` - Update profile
- `PATCH /api/profile` - Partial update profile

### Playlists
- `POST /api/playlists` - Create playlist
- `GET /api/playlists` - Get user's playlists
- `GET /api/playlists/:playlistId` - Get playlist with tracks
- `PATCH /api/playlists/:playlistId` - Update playlist
- `POST /api/playlists/:playlistId/items` - Add track to playlist

### Favorites
- `POST /api/favorites` - Add track to favorites (body: `{ track_id }`)
- `GET /api/favorites` - Get user's favorite tracks
- `DELETE /api/favorites/:trackId` - Remove track from favorites

## Implementation Notes

### User-Scoped Supabase Client
The `authenticateToken` middleware creates a user-scoped Supabase client with the user's access token. This is critical for RLS policies to work correctly, as they rely on `auth.uid()` to identify the current user.

### Duplicate Prevention
Both `playlist_items` and `favorites` tables have unique constraints on their combination keys to prevent duplicates:
- `playlist_items`: `UNIQUE(playlist_id, track_id)`
- `favorites`: `UNIQUE(user_id, track_id)`

### Track Upsert Pattern
When adding tracks to playlists or favorites, the backend first checks if the track exists by `audius_track_id`. If not, it inserts the track. This prevents duplicate track records.

## Configuration Agent Notes

The Supabase Configuration Agent should:
1. Ensure all tables are created with proper schema
2. Ensure all RLS policies are in place
3. Verify indexes are created for performance
4. Ensure environment variables are properly configured
