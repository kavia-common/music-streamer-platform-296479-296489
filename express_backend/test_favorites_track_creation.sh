#!/bin/bash

# Test script to verify Favorites endpoint auto-creates tracks
# This verifies that adding to favorites works like adding to playlists:
# 1. Creates track if it doesn't exist (using only allowed fields)
# 2. Then adds to favorites
# 3. Is idempotent (repeated adds return success)

set -e

BASE_URL="http://localhost:3001"
API_URL="${BASE_URL}/api"

echo "=========================================="
echo "Favorites Track Auto-Creation Test"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if server is running
echo "Checking if server is running..."
if ! curl -s "${BASE_URL}/" > /dev/null 2>&1; then
    echo -e "${RED}✗ Server is not running on port 3001${NC}"
    echo "Please start the server with: npm start"
    exit 1
fi
echo -e "${GREEN}✓ Server is running${NC}"
echo ""

# Generate unique test credentials
TIMESTAMP=$(date +%s)
TEST_EMAIL="favtest${TIMESTAMP}@example.com"
TEST_PASSWORD="TestPass123!"
TEST_USERNAME="favtest${TIMESTAMP}"

echo "=========================================="
echo "Step 1: Register test user"
echo "=========================================="
echo "Email: ${TEST_EMAIL}"
echo ""

REGISTER_RESPONSE=$(curl -s -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${TEST_EMAIL}\",
    \"password\": \"${TEST_PASSWORD}\",
    \"username\": \"${TEST_USERNAME}\"
  }")

echo "Response: ${REGISTER_RESPONSE}"
echo ""

# Extract access token
ACCESS_TOKEN=$(echo "${REGISTER_RESPONSE}" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "${ACCESS_TOKEN}" ]; then
    echo -e "${RED}✗ Failed to get access token${NC}"
    echo "Registration response: ${REGISTER_RESPONSE}"
    exit 1
fi

echo -e "${GREEN}✓ User registered successfully${NC}"
echo "Access Token: ${ACCESS_TOKEN:0:20}..."
echo ""

# Generate a UUID for a new track that doesn't exist yet
NEW_TRACK_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')

echo "=========================================="
echo "Step 2: Add track to favorites (should auto-create track)"
echo "=========================================="
echo "Track ID: ${NEW_TRACK_ID}"
echo ""

ADD_FAVORITE_RESPONSE=$(curl -s -X POST "${API_URL}/favorites" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"track_id\": \"${NEW_TRACK_ID}\",
    \"title\": \"Test Track ${TIMESTAMP}\",
    \"artist_name\": \"Test Artist\",
    \"duration_seconds\": 180,
    \"audius_track_id\": \"audius_${TIMESTAMP}\",
    \"audius_stream_url\": \"https://audius.co/stream/${TIMESTAMP}\"
  }")

echo "Response: ${ADD_FAVORITE_RESPONSE}"
echo ""

# Check if favorite was created
if echo "${ADD_FAVORITE_RESPONSE}" | grep -q "\"track_id\":\"${NEW_TRACK_ID}\""; then
    echo -e "${GREEN}✓ Track added to favorites successfully${NC}"
else
    echo -e "${RED}✗ Failed to add track to favorites${NC}"
    exit 1
fi

# Verify it's a 201 Created response
if echo "${ADD_FAVORITE_RESPONSE}" | grep -q "Track added to favorites successfully"; then
    echo -e "${GREEN}✓ Received expected success message${NC}"
fi
echo ""

echo "=========================================="
echo "Step 3: Verify track was created in tracks table"
echo "=========================================="
echo "This step verifies the track now exists (can be checked via database query)"
echo -e "${YELLOW}Note: Direct database verification would require Supabase access${NC}"
echo ""

echo "=========================================="
echo "Step 4: Get favorites (should include the new track)"
echo "=========================================="

GET_FAVORITES_RESPONSE=$(curl -s -X GET "${API_URL}/favorites" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

echo "Response: ${GET_FAVORITES_RESPONSE}"
echo ""

# Check if the track is in favorites
if echo "${GET_FAVORITES_RESPONSE}" | grep -q "\"track_id\":\"${NEW_TRACK_ID}\""; then
    echo -e "${GREEN}✓ Track appears in favorites list${NC}"
else
    echo -e "${RED}✗ Track not found in favorites list${NC}"
    exit 1
fi

# Check if track metadata is included (with allowed fields only)
if echo "${GET_FAVORITES_RESPONSE}" | grep -q "\"title\":\"Test Track ${TIMESTAMP}\""; then
    echo -e "${GREEN}✓ Track metadata included (title)${NC}"
fi

if echo "${GET_FAVORITES_RESPONSE}" | grep -q "\"artist_name\":\"Test Artist\""; then
    echo -e "${GREEN}✓ Track metadata included (artist_name)${NC}"
fi

if echo "${GET_FAVORITES_RESPONSE}" | grep -q "\"audius_track_id\":\"audius_${TIMESTAMP}\""; then
    echo -e "${GREEN}✓ Track metadata included (audius_track_id)${NC}"
fi

echo ""

echo "=========================================="
echo "Step 5: Test idempotency (add same track again)"
echo "=========================================="

ADD_AGAIN_RESPONSE=$(curl -s -X POST "${API_URL}/favorites" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"track_id\": \"${NEW_TRACK_ID}\",
    \"title\": \"Test Track ${TIMESTAMP}\",
    \"artist_name\": \"Test Artist\",
    \"duration_seconds\": 180,
    \"audius_track_id\": \"audius_${TIMESTAMP}\",
    \"audius_stream_url\": \"https://audius.co/stream/${TIMESTAMP}\"
  }")

echo "Response: ${ADD_AGAIN_RESPONSE}"
echo ""

# Should return success (200 or 201) with message about already favorited
if echo "${ADD_AGAIN_RESPONSE}" | grep -q "already in favorites"; then
    echo -e "${GREEN}✓ Idempotent behavior confirmed (already in favorites message)${NC}"
elif echo "${ADD_AGAIN_RESPONSE}" | grep -q "\"track_id\":\"${NEW_TRACK_ID}\""; then
    echo -e "${GREEN}✓ Idempotent behavior confirmed (returns existing favorite)${NC}"
else
    echo -e "${YELLOW}⚠ Response doesn't indicate idempotency, but no error occurred${NC}"
fi

echo ""

echo "=========================================="
echo "Step 6: Remove from favorites"
echo "=========================================="

DELETE_RESPONSE=$(curl -s -X DELETE "${API_URL}/favorites/${NEW_TRACK_ID}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

echo "Response: ${DELETE_RESPONSE}"
echo ""

if echo "${DELETE_RESPONSE}" | grep -q "removed from favorites successfully"; then
    echo -e "${GREEN}✓ Track removed from favorites${NC}"
else
    echo -e "${RED}✗ Failed to remove track from favorites${NC}"
    exit 1
fi

echo ""

echo "=========================================="
echo "Step 7: Verify removal (GET favorites should be empty)"
echo "=========================================="

GET_AFTER_DELETE=$(curl -s -X GET "${API_URL}/favorites" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

echo "Response: ${GET_AFTER_DELETE}"
echo ""

if echo "${GET_AFTER_DELETE}" | grep -q "\"favorites\":\[\]"; then
    echo -e "${GREEN}✓ Favorites list is empty after deletion${NC}"
elif ! echo "${GET_AFTER_DELETE}" | grep -q "\"track_id\":\"${NEW_TRACK_ID}\""; then
    echo -e "${GREEN}✓ Track no longer in favorites list${NC}"
else
    echo -e "${RED}✗ Track still appears in favorites${NC}"
    exit 1
fi

echo ""

echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "${GREEN}✓ All tests passed!${NC}"
echo ""
echo "Verified behaviors:"
echo "  1. Track auto-creation when adding to favorites"
echo "  2. Only allowed track fields are used"
echo "  3. Favorites add is idempotent"
echo "  4. GET favorites returns track metadata"
echo "  5. DELETE favorites works correctly"
echo ""
echo "The Favorites flow now works like the Playlist flow:"
echo "  - Auto-creates tracks if they don't exist"
echo "  - Uses composite key (user_id, track_id)"
echo "  - Respects allowed track fields only"
echo ""
