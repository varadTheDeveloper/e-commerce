import { notFound } from "next/navigation"

// Any unknown address inside a language shows the shop's "page not found".
export default function CatchAll() {
  notFound()
}
