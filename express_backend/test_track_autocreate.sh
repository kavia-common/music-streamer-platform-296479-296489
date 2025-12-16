#!/bin/bash
TIMESTAMP=$(date +%s)
TEST_EMAIL="favtest${TIMESTAMP}@example.com"
TEST_PASSWORD="TestPass123!"

# Register user
echo "1. Registering test user..."
REGISTER_RESPONSE=$(curl -s -X POST "http://localhost:3001/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\",\"username\":\"favtest${TIMESTAMP}\"}")

ACCESS_TOKEN=$(echo "${REGISTER_RESPONSE}" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -n "${ACCESS_TOKEN}" ]; then
  echo "✓ User registered, token: ${ACCESS_TOKEN:0:30}..."
  
  NEW_TRACK_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
  echo ""
  echo "2. Testing track auto-creation with ID: ${NEW_TRACK_ID}"
  
  echo ""
  echo "3. Adding to favorites (should auto-create track)..."
  ADD_RESPONSE=$(curl -s -X POST "http://localhost:3001/api/favorites" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"track_id\":\"${NEW_TRACK_ID}\",\"title\":\"Test Track ${TIMESTAMP}\",\"artist_name\":\"Test Artist\",\"duration_seconds\":180,\"audius_track_id\":\"audius_${TIMESTAMP}\",\"audius_stream_url\":\"https://audius.co/stream/${TIMESTAMP}\"}")
  
  echo "${ADD_RESPONSE}"
  
  if echo "${ADD_RESPONSE}" | grep -q "Track added to favorites successfully"; then
    echo ""
    echo "✓ Track auto-created and added to favorites"
    
    echo ""
    echo "4. Verifying GET favorites includes track metadata..."
    GET_RESPONSE=$(curl -s -X GET "http://localhost:3001/api/favorites" \
      -H "Authorization: Bearer ${ACCESS_TOKEN}")
    
    if echo "${GET_RESPONSE}" | grep -q "\"title\":\"Test Track ${TIMESTAMP}\""; then
      echo "✓ Track metadata included in response"
    fi
    
    echo ""
    echo "5. Testing idempotency (add same track again)..."
    ADD_AGAIN=$(curl -s -X POST "http://localhost:3001/api/favorites" \
      -H "Authorization: Bearer ${ACCESS_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "{\"track_id\":\"${NEW_TRACK_ID}\",\"title\":\"Test Track ${TIMESTAMP}\",\"artist_name\":\"Test Artist\"}")
    
    if echo "${ADD_AGAIN}" | grep -q "already in favorites"; then
      echo "✓ Idempotent behavior confirmed"
    fi
  else
    echo "✗ Failed to add to favorites"
    echo "${ADD_RESPONSE}"
  fi
else
  echo "✗ Failed to get access token"
fi
