import { redirect } from "next/navigation";

/** Alias — bookmark either /ops or /kv. */
export default function KvAliasPage() {
  redirect("/ops");
}
