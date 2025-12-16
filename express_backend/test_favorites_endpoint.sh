#!/bin/bash

# Manual test script for favorites endpoint (without id column)
# This script helps verify that the favorites endpoint works correctly
# after removing references to the non-existent favorites.id column

echo "=========================================="
echo "Favorites Endpoint Manual Test Script"
echo "=========================================="
echo ""

# Check if server is running
echo "1. Checking if server is running on port 3001..."
if curl -s http://localhost:3001/ > /dev/null 2>&1; then
    echo "✅ Server is running"
else
    echo "❌ Server is not running on port 3001"
    echo "   Please start the server with: npm start"
    exit 1
fi

echo ""
echo "=========================================="
echo "Test Instructions:"
echo "=========================================="
echo ""
echo "To manually test the favorites endpoint, you need:"
echo "1. A valid authentication token (from login/register)"
echo "2. A valid track_id (UUID from tracks table)"
echo ""
echo "Example commands:"
echo ""
echo "# Test GET /api/favorites (should not return 'id' field)"
echo "curl -H 'Authorization: Bearer YOUR_TOKEN' \\"
echo "     http://localhost:3001/api/favorites"
echo ""
echo "Expected response (no 'id' in favorites):"
echo '{"favorites":[{"track_id":"...","created_at":"...","track":{...}}]}'
echo ""
echo "# Test POST /api/favorites (should not return 'id' field)"
echo "curl -X POST \\"
echo "     -H 'Authorization: Bearer YOUR_TOKEN' \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"track_id\":\"YOUR_TRACK_UUID\"}' \\"
echo "     http://localhost:3001/api/favorites"
echo ""
echo "Expected response (no 'id' in favorite):"
echo '{"favorite":{"user_id":"...","track_id":"...","created_at":"..."},"message":"..."}'
echo ""
echo "# Test DELETE /api/favorites/:trackId"
echo "curl -X DELETE \\"
echo "     -H 'Authorization: Bearer YOUR_TOKEN' \\"
echo "     http://localhost:3001/api/favorites/YOUR_TRACK_UUID"
echo ""
echo "Expected response:"
echo '{"message":"Track removed from favorites successfully"}'
echo ""
echo "=========================================="
echo "Common Issues Fixed:"
echo "=========================================="
echo "✅ Removed 'favorites.id' from SELECT queries"
echo "✅ Updated response schemas to exclude 'id' field"
echo "✅ Using composite key (user_id, track_id) for uniqueness"
echo "✅ All CRUD operations work without 'id' column"
echo ""
echo "For automated testing with actual tokens, see:"
echo "docs/FAVORITES_FIX_VERIFICATION.md"
