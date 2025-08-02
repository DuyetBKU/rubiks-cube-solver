import { NextResponse } from "next/server"
import { put } from "@vercel/blob"

export async function POST(req: Request) {
  try {
    const { imageData } = await req.json()
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "")
    const buffer = Buffer.from(base64Data, "base64")

    const filename = "latest-rubik-state.png"

    const blob = await put(filename, buffer, {
      access: "public",
      contentType: "image/png",
      allowOverwrite: true,
      token: process.env.VERCEL_BLOB_READ_WRITE_TOKEN,
    })

    return NextResponse.json({ url: blob.url })
  } catch (error: any) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 })
  }
}
