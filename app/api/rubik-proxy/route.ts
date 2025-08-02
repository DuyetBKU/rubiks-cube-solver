import { NextResponse } from 'next/server'

export async function GET() {
  const timestamp = Date.now()
  const baseUrl = 'https://ydlokm38l5xmbgrn.public.blob.vercel-storage.com/latest-rubik-state.png'

  const urlWithTimestamp = `${baseUrl}?t=${timestamp}`

  // redirect 307 để đảm bảo không cache
  return NextResponse.redirect(urlWithTimestamp, 307)
}
