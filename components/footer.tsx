"use client"

import Link from "next/link"
import { FaGithub } from "react-icons/fa" // Cài: npm install react-icons

export function Footer() {
  return (
    <footer className="bg-black/20 backdrop-blur-sm border-t border-border py-6 text-center text-gray-400">
      <div className="container mx-auto px-4 flex flex-col items-center gap-2">
        <p className="text-sm">Made with ❤️ by DuyetBKU</p>
        <Link
          href="https://github.com/DuyetBKU/rubiks-cube-solver"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-primary hover:underline hover:text-blue-400 transition"
        >
          <FaGithub className="text-xl" />
          <span>GitHub Repository</span>
        </Link>
      </div>
    </footer>
  )
}
