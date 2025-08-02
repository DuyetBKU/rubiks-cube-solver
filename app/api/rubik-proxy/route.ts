import { NextResponse } from 'next/server'
// this is proxy from route api/capture-cube for paste to readme.md
// link is https://domain vercel or some else.../api/rubik-proxy
export async function GET() {
  const timestamp = Date.now()
  const baseUrl = 'https://ydlokm38l5xmbgrn.public.blob.vercel-storage.com/latest-rubik-state.png'

  const urlWithTimestamp = `${baseUrl}?t=${timestamp}`

  // redirect 307 make sure cache is not used
  return NextResponse.redirect(urlWithTimestamp, 307)
}
