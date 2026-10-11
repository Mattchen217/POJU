/**
 * CompanionJob persistence — Supabase when configured, else in-process map (dev/tests).
 */

import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/auth/supabase";

import { CompanionJobSchema, type CompanionJob } from "./types";

const memory = new Map<string, CompanionJob>();

type JobRow = {
  id: string;
  payload: CompanionJob;
};

function rowToJob(row: { id: string; payload: unknown }): CompanionJob {
  return CompanionJobSchema.parse(row.payload);
}

export async function saveCompanionJob(job: CompanionJob): Promise<void> {
  const parsed = CompanionJobSchema.parse({
    ...job,
    updated_at: new Date().toISOString(),
  });
  memory.set(parsed.id, parsed);

  if (!isSupabaseAdminConfigured()) return;

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("companion_jobs").upsert({
    id: parsed.id,
    session_id: parsed.session_id,
    profile_id: parsed.profile_id ?? null,
    email: parsed.email ?? null,
    timezone: parsed.timezone,
    mail_opt_in: parsed.mail_opt_in,
    delivery_day_key: parsed.delivery_day_key,
    ends_day_key: parsed.ends_day_key,
    payload: parsed,
    updated_at: parsed.updated_at,
    purged_at: parsed.purged_at ?? null,
  });
  if (error) {
    console.error("[companion_jobs] upsert", error.code ?? error.message);
    throw new Error(`companion_job_save_failed:${error.message}`);
  }
}

export async function getCompanionJob(id: string): Promise<CompanionJob | null> {
  if (isSupabaseAdminConfigured()) {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("companion_jobs")
      .select("id,payload")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.error("[companion_jobs] get", error.code ?? error.message);
      return memory.get(id) ?? null;
    }
    if (data) return rowToJob(data as JobRow);
  }
  return memory.get(id) ?? null;
}

export async function getCompanionJobBySession(
  sessionId: string,
): Promise<CompanionJob | null> {
  if (isSupabaseAdminConfigured()) {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("companion_jobs")
      .select("id,payload")
      .eq("session_id", sessionId)
      .is("purged_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && data) return rowToJob(data as JobRow);
  }
  for (const job of memory.values()) {
    if (job.session_id === sessionId && !job.purged_at) return job;
  }
  return null;
}

/** Jobs that still need generate/send work. */
export async function listActiveCompanionJobs(limit = 50): Promise<CompanionJob[]> {
  if (isSupabaseAdminConfigured()) {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("companion_jobs")
      .select("id,payload")
      .is("purged_at", null)
      .limit(limit);
    if (!error && data?.length) {
      return data.map((r) => rowToJob(r as JobRow));
    }
  }
  return [...memory.values()].filter((j) => !j.purged_at).slice(0, limit);
}
