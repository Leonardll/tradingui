// utils/auth0.js

import { initAuth0 } from '@auth0/nextjs-auth0';

const secret = process.env.AUTH0_SECRET;
const issuerBaseURL = process.env.AUTH0_ISSUER_BASE_URL;
const clientID = process.env.AUTH0_CLIENT_ID;
const clientSecret = process.env.AUTH0_CLIENT_SECRET;

export default initAuth0({
  secret: secret,
  issuerBaseURL: issuerBaseURL,
  baseURL: 'http://localhost:3000',
  clientID: clientID,
  clientSecret: clientSecret
});