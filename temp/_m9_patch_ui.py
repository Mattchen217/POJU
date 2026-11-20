from pathlib import Path

# --- session page ---
p = Path(r"D:\POJU\pojulife\app") / "[locale]" / "(marketing)" / "poju" / "session" / "[sessionId]" / "page.tsx"
text = p.read_text(encoding="utf-8")
text = text.replace(
    'import { loadPOJUSession, savePOJUSession } from "@/lib/poju/session-manager";\n',
    'import { loadPOJUSession, restoreAuthoritativePOJUSession, savePOJUSession } from "@/lib/poju/session-manager";\n',
    1,
)
text = text.replace(
    '''  const [session, setSession] = useState<POJUSessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pausedOnly, setPausedOnly] = useState(false);
''',
    '''  const [session, setSession] = useState<POJUSessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pausedOnly, setPausedOnly] = useState(false);
  const [authorityNotice, setAuthorityNotice] = useState<string | null>(null);
''',
    1,
)

old_load_start = '''    const row = await getPojuDb().pojuSessionRecords.get(sessionId);
    if (!row) {
      setError("session_not_found");
      setLoading(false);
      return;
    }
    if (row.status === "archived" || row.status === "resolved") {
      setError("session_closed");
      setLoading(false);
      return;
    }
    if (row.status === "paused") {
      setPausedOnly(true);
      setLoading(false);
      return;
    }

    let local = await loadPOJUSession(sessionId);
    if (!local) {
      setError("session_not_found");
      setLoading(false);
      return;
    }
'''
new_load_start = '''    setAuthorityNotice(null);
    const row = await getPojuDb().pojuSessionRecords.get(sessionId);
    if (row?.status === "archived" || row?.status === "resolved") {
      setError("session_closed");
      setLoading(false);
      return;
    }
    if (row?.status === "paused") {
      setPausedOnly(true);
      setLoading(false);
      return;
    }

    const restored = await restoreAuthoritativePOJUSession(sessionId);
    if (restored.authority_sync === "server_missing") {
      setError("session_not_found");
      setLoading(false);
      return;
    }
    if (restored.authority_sync === "server_expired") {
      setError("session_expired");
      setSession(restored.session);
      setAuthorityNotice(restored.message);
      setLoading(false);
      return;
    }
    if (restored.authority_sync === "server_terminated") {
      setError("session_terminated");
      setSession(restored.session);
      setAuthorityNotice(restored.message);
      setLoading(false);
      return;
    }
    if (restored.authority_sync === "offline_cache") {
      setAuthorityNotice(restored.message);
    }

    let local = restored.session ?? (await loadPOJUSession(sessionId));
    if (!local) {
      setError("session_not_found");
      setLoading(false);
      return;
    }
    if (restored.authority_sync === "server_frozen") {
      setAuthorityNotice(restored.message);
    }
'''
if old_load_start not in text:
    raise SystemExit("session page load start not found")
text = text.replace(old_load_start, new_load_start, 1)

old_err = '''        <p className="text-text-primary">
          {closed ? "This session is archived or marked as ended." : "Session not available."}
        </p>
'''
new_err = '''        <p className="text-text-primary">
          {closed
            ? "This session is archived or marked as ended."
            : error === "session_expired"
              ? "This session has expired on the server. Intake cannot continue."
              : error === "session_terminated"
                ? "This session has been terminated on the server and cannot be restored locally."
                : "Session not available."}
        </p>
        {authorityNotice ? <p className="mt-2 max-w-md text-center text-sm text-white/60">{authorityNotice}</p> : null}
'''
if old_err not in text:
    raise SystemExit("session page error copy not found")
text = text.replace(old_err, new_err, 1)

# show notice on the chat shell as well? optional banner before return
old_shell = '''  return (
    <AppDialogProvider>
      <PojuSessionChatShell
'''
new_shell = '''  return (
    <AppDialogProvider>
      {authorityNotice ? (
        <p className="bg-amber-950/40 px-4 py-2 text-center text-sm text-amber-100">{authorityNotice}</p>
      ) : null}
      <PojuSessionChatShell
'''
if old_shell not in text:
    raise SystemExit("shell return not found")
text = text.replace(old_shell, new_shell, 1)
p.write_text(text, encoding="utf-8", newline="\n")
print("patched session page")

# --- DI2 lab ---
lab = Path(r"D:\POJU\pojulife\app\ops\delivery-lab\di2\page.tsx")
lt = lab.read_text(encoding="utf-8")
lt = lt.replace(
    '''import {
  createPOJUSession,
  loadPOJUSession,
  savePOJUSession,
} from "@/lib/poju/session-manager";
''',
    '''import {
  createPOJUSession,
  loadPOJUSession,
  restoreAuthoritativePOJUSession,
  savePOJUSession,
} from "@/lib/poju/session-manager";
''',
    1,
)
lt = lt.replace(
    '''    { label: "Fresh Session", detail: session.session_id },
''',
    '''    { label: "Fresh Session", detail: session.session_id },
    { label: "Server Session", detail: typeof session.session_revision === "number" ? `revision ${session.session_revision}` : "awaiting server restore" },
''',
    1,
)
old_restore = '''  const restore = useCallback(async (id: string) => {
    const loaded = await loadPOJUSession(id.trim());
    if (!loaded) throw new Error("本浏览器 IndexedDB 中没有该 Session，或当前用户无权读取。");
    setSession(loaded);
    setSessionId(loaded.session_id);
    setQuestion(loaded.original_question);
    setNotice("Session 已从本机 IndexedDB 恢复；恢复不会自动启动模型或报告任务。");
    return loaded;
  }, []);
'''
new_restore = '''  const restore = useCallback(async (id: string) => {
    const restored = await restoreAuthoritativePOJUSession(id.trim());
    if (restored.authority_sync === "server_missing" && !restored.session) {
      throw new Error("服务端没有该 Session，本机缓存也无法读取。");
    }
    const loaded = restored.session;
    if (!loaded) throw new Error("无法恢复 Session。");
    setSession(loaded);
    setSessionId(loaded.session_id);
    setQuestion(loaded.original_question);
    if (restored.authority_sync === "offline_cache") {
      setNotice("网络不可用，正在展示本机缓存。离线修改不是已提交的服务端权威状态。");
    } else if (restored.authority_sync === "server_missing") {
      setNotice("服务端 Session 不存在。本机缓存不能作为权威状态继续 Intake。");
    } else if (restored.authority_sync === "server_expired") {
      setNotice("服务端 Session 已过期，不允许继续 Intake。");
    } else if (restored.authority_sync === "server_frozen") {
      setNotice("服务端 Session 已 Freeze，不能重新进入 Intake。报告恢复仍走独立 Report Recovery 路径。");
    } else if (restored.authority_sync === "server_terminated") {
      setNotice("服务端 Session 已终止，不能通过本地恢复或改字段解除。");
    } else {
      setNotice(`已从服务端权威 Session 恢复（revision ${restored.revision ?? "?"}）。本地 IndexedDB 已更新为服务端镜像。`);
    }
    return loaded;
  }, []);
'''
if old_restore not in lt:
    raise SystemExit("lab restore not found")
lt = lt.replace(old_restore, new_restore, 1)
lt = lt.replace(
    '>从 IndexedDB 恢复</button>',
    '>从服务端权威 Session 恢复</button>',
    1,
)
lt = lt.replace(
    'placeholder="IndexedDB 中的 Session ID"',
    'placeholder="先恢复 Session ID，再拉取服务端权威快照"',
    1,
)
lab.write_text(lt, encoding="utf-8", newline="\n")
print("patched DI2 lab")