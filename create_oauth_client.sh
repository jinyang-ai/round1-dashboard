#!/bin/bash

# This script creates a new Web Application OAuth 2.0 Client ID
# You'll need to run this manually after getting an access token

echo "To create a Web Application OAuth client, follow these steps:"
echo ""
echo "1. Go to: https://console.cloud.google.com/apis/credentials/oauthclient?project=meet-tracker-478719"
echo ""
echo "2. Click 'CREATE CREDENTIALS' → 'OAuth 2.0 Client ID'"
echo ""
echo "3. Select Application type: 'Web application'"
echo ""
echo "4. Name: Round1 Dashboard"
echo ""
echo "5. Add Authorized redirect URIs:"
echo "   http://localhost:3000/api/auth/callback/google"
echo "   https://round1-dashboard.vercel.app/api/auth/callback/google"
echo ""
echo "6. Click 'CREATE'"
echo ""
echo "7. Copy the Client ID and Client Secret"
echo ""
echo "8. Update Vercel environment variables:"
echo "   - GOOGLE_CLIENT_ID (replace with new one)"
echo "   - GOOGLE_CLIENT_SECRET (replace with new one)"
echo ""
echo "Direct link to create: https://console.cloud.google.com/apis/credentials/oauthclient?project=meet-tracker-478719"
