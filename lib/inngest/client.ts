import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "pojulife",
  eventKey: process.env.INNGEST_EVENT_KEY,
});
