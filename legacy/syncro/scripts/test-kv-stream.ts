import { appendToStream, getStream, clearStream, clearHourCache } from "@/lib/syncro/syncro-kv";

async function test() {
  const sid = "test-session";
  const hid = "zi";

  await clearStream(sid, hid);

  await appendToStream(sid, hid, "Hello ");
  await appendToStream(sid, hid, "World");
  await appendToStream(sid, hid, "!");

  const result = await getStream(sid, hid);
  console.log("Stream result:", result);

  await clearHourCache(sid, hid);

  const after = await getStream(sid, hid);
  console.log("After clear:", after);
}

test().catch((e) => {
  console.error(e);
  process.exit(1);
});
