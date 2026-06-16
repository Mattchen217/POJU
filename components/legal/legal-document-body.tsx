"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

export type LegalBlock =
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "labeledList"; items: { label: string; text: string }[] }
  | { kind: "hr" }
  | {
      kind: "table";
      headers: string[];
      rows: string[][];
    }
  | {
      kind: "contact";
      lines: { label: string; email: string }[];
    }
  | {
      kind: "linkP";
      before: string;
      linkHref: string;
      linkLabel: string;
      after: string;
    };

function renderInlineLinks(text: string) {
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlPattern);
  return parts.map((part, index) => {
    if (part.match(urlPattern)) {
      const href = part.replace(/[.,)]+$/, "");
      const trailing = part.slice(href.length);
      return (
        <span key={index}>
          <a href={href} rel="noopener noreferrer" target="_blank">
            {href}
          </a>
          {trailing}
        </span>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

function LegalBlockView({ block }: { block: LegalBlock }) {
  switch (block.kind) {
    case "h2":
      return <h2>{block.text}</h2>;
    case "h3":
      return <h3>{block.text}</h3>;
    case "p":
      return <p>{renderInlineLinks(block.text)}</p>;
    case "ul":
      return (
        <ul>
          {block.items.map((item) => (
            <li key={item}>{renderInlineLinks(item)}</li>
          ))}
        </ul>
      );
    case "labeledList":
      return (
        <ul>
          {block.items.map((item) => (
            <li key={item.label}>
              <strong>{item.label}</strong> {item.text}
            </li>
          ))}
        </ul>
      );
    case "hr":
      return <hr />;
    case "table":
      return (
        <div className="legal-table-wrap">
          <table className="legal-table">
            <thead>
              <tr>
                {block.headers.map((header) => (
                  <th key={header} scope="col">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row.join("|")}>
                  {row.map((cell) => (
                    <td key={cell}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "contact":
      return (
        <>
          {block.lines.map((line) => (
            <p key={line.email}>
              {line.label}
              <br />
              <a href={`mailto:${line.email}`}>{line.email}</a>
            </p>
          ))}
        </>
      );
    case "linkP":
      return (
        <p>
          {block.before}
          <Link href={block.linkHref}>{block.linkLabel}</Link>
          {block.after}
        </p>
      );
    default:
      return null;
  }
}

type LegalDocumentBodyProps = {
  namespace: "cookies";
};

export function LegalDocumentBody({ namespace }: LegalDocumentBodyProps) {
  const t = useTranslations(namespace);
  const blocks = t.raw("blocks") as LegalBlock[];

  return (
    <>
      {blocks.map((block, index) => (
        <LegalBlockView key={`${block.kind}-${index}`} block={block} />
      ))}
    </>
  );
}
