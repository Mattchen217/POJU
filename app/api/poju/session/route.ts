import { NextResponse } from "next/server";

import {
  SessionAuthorityError,
  httpStatusForAuthorityError,
  initializeAuthoritativeSession,
  requireAuthoritativeSession,
  toAuthoritativeEnvelope,
} from "@/lib/poju/session-authority/lifecycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * M9 — server-authoritative Session identity and restore.
 *   action=init  create a new server record (NX). Client fields cannot set
 *                expires_at, revision, lifecycle_status, or the snapshot.
 *   action=get   read an existing record. This never upserts from the client.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    session_id?: string | null;
    original_question?: string;
    device_id?: string | null;
    selected_stored_profile_id?: string | null;
  };
  const action = body.action === "get" ? "get" : body.action === "init" ? "init" : null;
  if (!action) {
    return NextResponse.json(
      { error: "session_authority", code: "invalid_session_request", recoverable: false, message: "action must be init or get" },
      { status: 400 },
    );
  }

  try {
    if (action === "init") {
      const record = await initializeAuthoritativeSession({
        session_id: body.session_id,
        original_question: body.original_question,
        device_id: body.device_id ?? undefined,
        selected_stored_profile_id: body.selected_stored_profile_id,
      });
      return NextResponse.json({ ok: true, ...toAuthoritativeEnvelope(record) });
    }

    if (typeof body.session_id !== "string" || !body.session_id.trim()) {
      return NextResponse.json(
        { error: "session_authority", code: "invalid_session_request", recoverable: false, message: "session_id is required" },
        { status: 400 },
      );
    }
    const record = await requireAuthoritativeSession(body.session_id.trim());
    return NextResponse.json({ ok: true, ...toAuthoritativeEnvelope(record) });
  } catch (error) {
    if (error instanceof SessionAuthorityError) {
      return NextResponse.json(error.toBody(), { status: httpStatusForAuthorityError(error) });
    }
    console.error("[poju/session]", error);
    return NextResponse.json(
      {
        error: "session_authority",
        code: "server_persistence_unavailable",
        recoverable: false,
        message: error instanceof Error ? error.message : "session request failed",
      },
      { status: 503 },
    );
  }
}