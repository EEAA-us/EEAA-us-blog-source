import { redirect } from "next/navigation";

// Retain the old URL while visitor authentication remains unavailable.
export default function AuthCallbackPage() {
  redirect("/messages");
}
