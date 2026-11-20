const fs = require("fs");
const path = "app/api/poju/final-delivery/route.ts";
let s = fs.readFileSync(path, "utf8");

const startMarker = "const requireDecisionContext = body.require_decision_context === true;";
const endMarker = "const jobInput: FinalDeliveryJobInput = {";
const start = s.indexOf(startMarker);
const end = s.indexOf(endMarker);
if (start < 0 || end < 0 || end <= start) {
  throw new Error(`markers not found start=${start} end=${end}`);
}

const replacement = `const requireDecisionContext = body.require_decision_context === true;
    let decision_context_binding: import("@/lib/poju/decision-context").DecisionContextBinding | null =
      null;
    let decision_context_snapshot: import("@/lib/poju/decision-context").DecisionContext | null =
      null;
    let m22_claim_token: string | null = null;
    let m22_claim_key: string | null = null;
    let m22_report_job_id: string | null = null;
    let m22_reused_completed = false;
    try {
      const { assertSnapshotMatchesBinding } = await import(
        "@/lib/poju/decision-context"
      );
      const {
        loadAuthoritativeFreeze,
        createFrozenReportSnapshot,
      } = await import("@/lib/poju/decision-intake/freeze-bound-report");
      const { loadPOJUSession, savePOJUSession } = await import(
        "@/lib/poju/session-manager"
      );
      const { prepareFreezeBoundFinalDeliveryServer } = await import(
        "@/lib/poju/decision-intake/freeze-bound-report-server"
      );

      const bindingRaw = body.decision_context_binding;
      const snapRaw = body.decision_context_snapshot;
      const clientWantsDc =
        requireDecisionContext ||
        bindingRaw != null ||
        snapRaw != null ||
        body.decision_context != null ||
        (Array.isArray(body.decision_context_versions) &&
          body.decision_context_versions.length > 0);

      // M2.2-R2: server-persisted session is the Freeze authority.
      // Client snapshot/binding may be compared, never replace server Freeze.
      const sessionRow = await loadPOJUSession(sessionIdRaw);
      if (!sessionRow) {
        if (requireDecisionContext || clientWantsDc) {
          return NextResponse.json(
            {
              ok: false,
              error: "Session not found for authoritative Freeze",
              code: "DC_REPORT_MISSING",
            },
            { status: 400 },
          );
        }
      } else if (clientWantsDc || requireDecisionContext) {
        const freezeIdRaw =
          typeof (body as { freeze_id?: unknown }).freeze_id === "string"
            ? String((body as { freeze_id?: string }).freeze_id)
            : undefined;
        const clientBinding =
          bindingRaw && typeof bindingRaw === "object"
            ? (bindingRaw as import("@/lib/poju/decision-context").DecisionContextBinding)
            : null;
        const clientSnap =
          snapRaw && typeof snapRaw === "object"
            ? (snapRaw as import("@/lib/poju/decision-context").DecisionContext)
            : null;

        let loaded;
        try {
          loaded = loadAuthoritativeFreeze(sessionRow, {
            freezeId: freezeIdRaw,
            context_id: clientBinding?.context_id,
            version: clientBinding?.context_version,
            expected_hash: clientBinding?.context_hash,
          });
        } catch (e) {
          const code =
            e && typeof e === "object" && "code" in e
              ? String((e as { code: string }).code)
              : "DC_REPORT_MISSING";
          return NextResponse.json(
            {
              ok: false,
              error: e instanceof Error ? e.message : "Authoritative Freeze load failed",
              code,
            },
            { status: 400 },
          );
        }

        const frozenSnap = createFrozenReportSnapshot({
          sessionId: sessionIdRaw,
          frozen: loaded.frozen,
          binding: loaded.binding,
        });

        // Compare client payload against server authority — never accept client as Freeze.
        if (clientBinding) {
          if (
            clientBinding.context_id !== frozenSnap.binding.context_id ||
            clientBinding.context_version !== frozenSnap.binding.context_version ||
            clientBinding.context_hash !== frozenSnap.binding.context_hash
          ) {
            return NextResponse.json(
              {
                ok: false,
                error: "Client Freeze binding does not match server-authoritative Freeze",
                code: "DC_REPORT_HASH_MISMATCH",
              },
              { status: 400 },
            );
          }
        }
        if (clientSnap) {
          try {
            assertSnapshotMatchesBinding(clientSnap, frozenSnap.binding);
            // Tampered content with matching binding fields still fails hash verify below.
            const { computeContentHash } = await import(
              "@/lib/poju/decision-context/content-hash"
            );
            const clientHash = computeContentHash(clientSnap);
            if (clientHash !== frozenSnap.contentHash) {
              return NextResponse.json(
                {
                  ok: false,
                  error: "Client Freeze snapshot hash does not match server-authoritative Freeze",
                  code: "DC_REPORT_HASH_MISMATCH",
                },
                { status: 400 },
              );
            }
          } catch (e) {
            const code =
              e && typeof e === "object" && "code" in e
                ? String((e as { code: string }).code)
                : "DC_REPORT_HASH_MISMATCH";
            return NextResponse.json(
              {
                ok: false,
                error:
                  e instanceof Error
                    ? e.message
                    : "Client Freeze snapshot rejected against server authority",
                code,
              },
              { status: 400 },
            );
          }
        }

        decision_context_snapshot =
          frozenSnap.decisionContext as import("@/lib/poju/decision-context").DecisionContext;
        decision_context_binding = frozenSnap.binding;

        // Persist Freeze-bound job + acquire shared KV claim BEFORE xhigh create/start.
        const prepared = await prepareFreezeBoundFinalDeliveryServer({
          session: sessionRow,
          freezeId: frozenSnap.freezeId,
          expected_hash: frozenSnap.contentHash,
          acquireGenerationClaim: true,
          deps: {
            persistSession: savePOJUSession,
            loadSession: loadPOJUSession,
          },
        });

        if (!prepared.ok) {
          if (prepared.code === "GENERATION_IN_PROGRESS") {
            // Competing request: reuse in-progress xhigh job; do not start another generator.
            const latest = await findLatestXhighJobForSession(
              "final_delivery",
              sessionIdRaw,
            ).catch(() => null);
            if (latest) {
              return await jobStatusResponse(latest);
            }
            return NextResponse.json(
              {
                ok: false,
                error: prepared.error,
                code: prepared.code,
                retryable: true,
                status: "running",
                job_id: prepared.job?.job_id ?? null,
              },
              { status: 409 },
            );
          }
          if (requireDecisionContext) {
            return NextResponse.json(
              {
                ok: false,
                error: prepared.error,
                code: prepared.code,
              },
              { status: 400 },
            );
          }
        } else {
          decision_context_snapshot = prepared.decision_context_snapshot;
          decision_context_binding = prepared.decision_context_binding;
          m22_report_job_id = prepared.job.job_id;
          m22_reused_completed = prepared.reusedCompleted === true;
          if (prepared.claimHeld && prepared.claimToken && prepared.claimKey) {
            m22_claim_token = prepared.claimToken;
            m22_claim_key = prepared.claimKey;
          }
          if (m22_reused_completed) {
            // Completed Freeze-bound report already exists — still allow formal
            // delivery resume/reuse via existing xhigh job lookup below, but do
            // not acquire a new generator claim.
          }
        }
      }
    } catch (e) {
      const code =
        e && typeof e === "object" && "code" in e
          ? String((e as { code: string }).code)
          : "DC_REPORT_BIND_FAILED";
      if (requireDecisionContext || body.decision_context_binding != null || body.decision_context != null) {
        return NextResponse.json(
          {
            ok: false,
            error: e instanceof Error ? e.message : "Decision Context bind failed",
            code,
          },
          { status: 400 },
        );
      }
    }

    if (requireDecisionContext && (!decision_context_binding || !decision_context_snapshot)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Stage4 requires frozen Decision Context binding",
          code: "DC_REPORT_MISSING",
        },
        { status: 400 },
      );
    }

    `;

s = s.slice(0, start) + replacement + s.slice(end);
fs.writeFileSync(path, s);
console.log("route Freeze block replaced");
