// src/utils/getURL.js

export const getURL = () => {
  let url =
    process.env.REACT_APP_SITE_URL ?? // Set this in production env
    process.env.VERCEL_URL ?? // Automatically set by Vercel  
    'http://localhost:3000/' // Default for local development
  
  // Make sure to include `https://` when not localhost
  url = url.startsWith('http') ? url : `https://${url}`
  
  // Make sure to include a trailing `/`
  url = url.endsWith('/') ? url : `${url}/`
  
  return url
}

export default getURL