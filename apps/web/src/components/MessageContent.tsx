import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  oneDark,
  oneLight,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "./theme-provider";

interface MessageContentProps {
  content: string;
  plain?: boolean;
}

export function MessageContent({ content, plain = false }: MessageContentProps) {
  const { theme } = useTheme();

  if (plain) {
    return (
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-800 dark:text-neutral-100">
        {content}
      </p>
    );
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <p className="mb-2 text-sm leading-relaxed last:mb-0">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="mb-2 list-disc space-y-1 pl-5 text-sm">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-2 list-decimal space-y-1 pl-5 text-sm">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        h1: ({ children }) => (
          <h1 className="mb-2 text-lg font-semibold">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-2 text-base font-semibold">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-2 text-sm font-semibold">{children}</h3>
        ),
        blockquote: ({ children }) => (
          <blockquote className="mb-2 border-l-2 border-neutral-300 pl-3 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
            {children}
          </blockquote>
        ),
        code: ({ className, children }) => {
          const match = /language-(\w+)/.exec(className ?? "");
          const code = String(children).replace(/\n$/, "");
          if (match) {
            return (
              <SyntaxHighlighter
                style={theme === "dark" ? oneDark : oneLight}
                language={match[1]}
                PreTag="div"
                customStyle={{
                  margin: 0,
                  borderRadius: "0.5rem",
                  fontSize: "0.75rem",
                }}
              >
                {code}
              </SyntaxHighlighter>
            );
          }
          return (
            <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs dark:bg-neutral-900">
              {children}
            </code>
          );
        },
        pre: ({ children }) => <div className="mb-2 last:mb-0">{children}</div>,
        a: ({ href, children }) => (
          <a
            href={href}
            className="underline underline-offset-2"
            target="_blank"
            rel="noreferrer"
          >
            {children}
          </a>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
