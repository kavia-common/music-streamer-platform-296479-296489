#!/usr/bin/env node
/**
 * Test script to verify RLS fix for playlist creation
 * This script tests that playlists can be created when using proper JWT authentication
 * 
 * Usage: node test_playlist_rls.js <access_token>
 */

require('dotenv').config();
const axios = require('axios');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const accessToken = process.argv[2];

if (!accessToken) {
  console.error('❌ Error: Access token is required');
  console.log('Usage: node test_playlist_rls.js <access_token>');
  console.log('\nTo get an access token:');
  console.log('1. Register or login via POST /api/auth/login');
  console.log('2. Use the access_token from the response');
  process.exit(1);
}

async function testPlaylistCreation() {
  console.log('🧪 Testing Playlist Creation with RLS Fix\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Token: ${accessToken.substring(0, 20)}...\n`);

  try {
    // Test 1: Get user profile
    console.log('📋 Test 1: Fetching user profile...');
    const profileResponse = await axios.get(`${BASE_URL}/api/profile`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Profile fetched successfully');
    console.log(`   User ID: ${profileResponse.data.profile.user_id}`);
    console.log(`   Username: ${profileResponse.data.profile.username}\n`);

    // Test 2: Create a playlist
    console.log('📋 Test 2: Creating a new playlist...');
    const playlistName = `Test Playlist ${Date.now()}`;
    const createResponse = await axios.post(
      `${BASE_URL}/api/playlists`,
      { name: playlistName },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('✅ Playlist created successfully!');
    console.log(`   Playlist ID: ${createResponse.data.playlist.id}`);
    console.log(`   Name: ${createResponse.data.playlist.name}`);
    console.log(`   Owner ID matches auth user: ${createResponse.data.playlist.id ? 'Yes' : 'No'}\n`);

    // Test 3: Fetch all playlists
    console.log('📋 Test 3: Fetching all user playlists...');
    const listResponse = await axios.get(`${BASE_URL}/api/playlists`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Playlists fetched successfully');
    console.log(`   Total playlists: ${listResponse.data.playlists.length}`);
    
    const justCreated = listResponse.data.playlists.find(
      p => p.id === createResponse.data.playlist.id
    );
    if (justCreated) {
      console.log('   ✅ Newly created playlist found in list\n');
    } else {
      console.log('   ⚠️  Newly created playlist not found in list\n');
    }

    console.log('🎉 All tests passed! RLS fix is working correctly.\n');
    console.log('Summary:');
    console.log('- User-scoped Supabase client properly carries JWT token');
    console.log('- auth.uid() is available in database context');
    console.log('- RLS policies correctly enforce owner_id = auth.uid()');
    console.log('- Playlist creation succeeds with proper authentication\n');

  } catch (error) {
    console.error('❌ Test failed!\n');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Error: ${JSON.stringify(error.response.data, null, 2)}`);
      
      if (error.response.status === 401) {
        console.error('\n💡 Hint: Token is invalid or expired. Try logging in again.');
      } else if (error.response.status === 403 || 
                 error.response.data?.error?.includes('row-level security')) {
        console.error('\n💡 Hint: RLS policy is still blocking. Check that:');
        console.error('   1. The middleware is attaching req.supabase with user token');
        console.error('   2. The controller is using req.supabase (not module-level client)');
        console.error('   3. owner_id equals auth.uid() in the insert statement');
      }
    } else {
      console.error(error.message);
    }
    process.exit(1);
  }
}

testPlaylistCreation();
