#!/usr/bin/env python3
"""Convert TERMS SoT markdown (Purpose → end) into LegalPageShell JSX."""
from __future__ import annotations

import re
import sys
from pathlib import Path

SOT = Path(r"D:/POJU/pojulife/temp/eos-refund-1.1/TERMS-of-Service-SoT.md")
OUT = Path(r"D:/POJU/pojulife/temp/terms-page-new.tsx")

# Internal path links → next-intl Link
INTERNAL_HREFS = {
    "/disclaimer",
    "/privacy",
    "/refund",
    "/cookies",
    "/terms",
    "/contact",
}


def inline(text: str) -> str:
    """Convert inline markdown to JSX, escaping as needed."""
    # Protect code-ish backticks first (rare)
    # Links: [label](url)
    def link_sub(m: re.Match) -> str:
        label, url = m.group(1), m.group(2)
        label_jsx = bold_italic(label)
        if url.startswith("mailto:"):
            return f'<a href="{url}">{label_jsx}</a>'
        if url.startswith("http://") or url.startswith("https://"):
            return (
                f'<a href="{url}" rel="noopener noreferrer" target="_blank">'
                f"{label_jsx}</a>"
            )
        # internal
        path = url.split("?")[0]
        return f'<Link href="{url}">{label_jsx}</Link>'

    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", link_sub, text)
    text = bold_italic(text)
    return text


def bold_italic(text: str) -> str:
    # Escape bare < > that aren't tags (none expected after link pass)
    # **bold** — greedy non-greedy across non-asterisk
    text = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", text)
    # *italic* rarely used — skip to avoid eating bold leftovers
    # Escape & in remaining text carefully: only bare & not already entities
    # But content may have &amp; already from nowhere — MD uses &
    # Do NOT escape <strong> we just added.
    # Escape & that aren't part of entities
    parts: list[str] = []
    i = 0
    while i < len(text):
        if text.startswith("<strong>", i):
            parts.append("<strong>")
            i += 8
            continue
        if text.startswith("</strong>", i):
            parts.append("</strong>")
            i += 9
            continue
        if text.startswith("<Link ", i) or text.startswith("<a ", i):
            # find end of opening tag
            j = text.find(">", i)
            parts.append(text[i : j + 1])
            i = j + 1
            continue
        if text.startswith("</Link>", i):
            parts.append("</Link>")
            i += 7
            continue
        if text.startswith("</a>", i):
            parts.append("</a>")
            i += 4
            continue
        ch = text[i]
        if ch == "&":
            # keep existing entities
            ent = re.match(r"&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);", text[i:])
            if ent:
                parts.append(ent.group(0))
                i += len(ent.group(0))
            else:
                parts.append("&amp;")
                i += 1
            continue
        if ch == "<":
            parts.append("&lt;")
            i += 1
            continue
        if ch == ">":
            parts.append("&gt;")
            i += 1
            continue
        if ch == "{":
            parts.append("{" + "'{'}")
            i += 1
            continue
        if ch == "}":
            parts.append("{" + "'}'}")
            i += 1
            continue
        parts.append(ch)
        i += 1
    return "".join(parts)


def parse_table(lines: list[str], start: int) -> tuple[str, int]:
    """Parse GFM table starting at start; return (jsx, next_index)."""
    rows = []
    i = start
    while i < len(lines) and lines[i].strip().startswith("|"):
        row = lines[i].strip()
        # skip separator
        cells = [c.strip() for c in row.strip("|").split("|")]
        if all(re.match(r"^:?-+:?$", c) for c in cells):
            i += 1
            continue
        rows.append(cells)
        i += 1
    if not rows:
        return "", start + 1
    header = rows[0]
    body = rows[1:]
    out = ['      <div className="legal-table-wrap">', '        <table className="legal-table">', "          <thead>", "            <tr>"]
    for h in header:
        out.append(f'              <th scope="col">{inline(h)}</th>')
    out.append("            </tr>")
    out.append("          </thead>")
    out.append("          <tbody>")
    for row in body:
        out.append("            <tr>")
        # pad if needed
        while len(row) < len(header):
            row.append("")
        for cell in row[: len(header)]:
            out.append(f"              <td>{inline(cell)}</td>")
        out.append("            </tr>")
    out.append("          </tbody>")
    out.append("        </table>")
    out.append("      </div>")
    return "\n".join(out), i


def convert_body(md: str) -> str:
    lines = md.splitlines()
    # Find "## Purpose of these Terms"
    start = None
    for idx, line in enumerate(lines):
        if line.strip() == "## Purpose of these Terms":
            start = idx
            break
    if start is None:
        raise SystemExit("Purpose heading not found")

    # Drop trailing --- and trailing whitespace
    body_lines = lines[start:]
    while body_lines and body_lines[-1].strip() in ("", "---"):
        body_lines.pop()

    out: list[str] = []
    i = 0
    n = len(body_lines)

    def flush_para(buf: list[str]) -> None:
        if not buf:
            return
        text = " ".join(s.strip() for s in buf)
        out.append(f"      <p>{inline(text)}</p>")

    para: list[str] = []

    while i < n:
        line = body_lines[i]
        stripped = line.strip()

        if stripped == "---":
            flush_para(para)
            para = []
            i += 1
            continue

        if not stripped:
            flush_para(para)
            para = []
            i += 1
            continue

        if stripped.startswith("|"):
            flush_para(para)
            para = []
            jsx, i = parse_table(body_lines, i)
            out.append(jsx)
            continue

        if stripped.startswith("### "):
            flush_para(para)
            para = []
            out.append(f"      <h3>{inline(stripped[4:])}</h3>")
            i += 1
            continue

        if stripped.startswith("## "):
            flush_para(para)
            para = []
            out.append(f"      <h2>{inline(stripped[3:])}</h2>")
            i += 1
            continue

        # ordered list
        if re.match(r"^\d+\.\s+", stripped):
            flush_para(para)
            para = []
            items = []
            while i < n and re.match(r"^\d+\.\s+", body_lines[i].strip()):
                item = re.sub(r"^\d+\.\s+", "", body_lines[i].strip())
                # continuation lines?
                i += 1
                while i < n and body_lines[i].strip() and not re.match(
                    r"^(\d+\.\s+|[-*]\s+|#{1,3}\s+|\|)", body_lines[i].strip()
                ) and body_lines[i].strip() != "---":
                    # unlikely multi-line list items in this SoT
                    item += " " + body_lines[i].strip()
                    i += 1
                items.append(item)
            out.append("      <ol>")
            for item in items:
                out.append(f"        <li>{inline(item)}</li>")
            out.append("      </ol>")
            continue

        # unordered list
        if re.match(r"^[-*]\s+", stripped):
            flush_para(para)
            para = []
            items = []
            while i < n and re.match(r"^[-*]\s+", body_lines[i].strip()):
                item = re.sub(r"^[-*]\s+", "", body_lines[i].strip())
                i += 1
                while i < n and body_lines[i].strip() and not re.match(
                    r"^(\d+\.\s+|[-*]\s+|#{1,3}\s+|\|)", body_lines[i].strip()
                ) and body_lines[i].strip() != "---":
                    item += " " + body_lines[i].strip()
                    i += 1
                items.append(item)
            out.append("      <ul>")
            for item in items:
                out.append(f"        <li>{inline(item)}</li>")
            out.append("      </ul>")
            continue

        para.append(stripped)
        i += 1

    flush_para(para)
    return "\n".join(out)


def main() -> None:
    md = SOT.read_text(encoding="utf-8")
    # Stamp override (already 1.1 in SoT; keep explicit)
    version = "Version 1.1"
    updated = "Last updated: 2026-10-20"
    body = convert_body(md)

    # Governing language intro from SoT (not Version 1.0 old wording)
    intro = """        <>
          <p>
            <strong>Governing Language.</strong> These Terms of Service are written and intended to be
            interpreted exclusively in the English language. Any translation provided elsewhere is for
            convenience only. In the event of conflict or ambiguity,{" "}
            <strong>this English version governs and prevails</strong>.
          </p>
        </>"""

    footer = """        <p>
          <strong>PENDING COUNSEL REVIEW / 须真人律师确认</strong>
          {" "}
          — Counsel must review before relying on this as the live /terms page.
        </p>"""

    page = f"""import type {{ Metadata }} from "next";

import {{ LegalPageShell }} from "@/components/legal/legal-page-shell";
import {{ Link }} from "@/i18n/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {{
  title: "Terms of Service — Eastern OS",
  description: "Eastern OS Terms of Service — Version 1.1",
}};

export default function TermsPage() {{
  return (
    <LegalPageShell
      version="{version}"
      title="Terms of Service"
      updated="{updated}"
      intro={{
{intro}
      }}
      footer={{
{footer}
      }}
    >
{body}
    </LegalPageShell>
  );
}}
"""
    OUT.write_text(page, encoding="utf-8")
    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes)")
    # Sanity checks
    text = OUT.read_text(encoding="utf-8")
    checks = [
        "Version 1.1",
        "Last updated: 2026-10-20",
        "unused purchased Buy Pass",
        "PASS-details self-serve",
        "PASS details",
        "Refund §3.3",
        "PENDING COUNSEL REVIEW",
        "May be eligible",
        "How to request",
        "FIFO",
        "one-click refund",
    ]
    for c in checks:
        print(f"  {'OK' if c in text else 'MISSING'}: {c}")


if __name__ == "__main__":
    main()
