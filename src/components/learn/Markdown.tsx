import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Raw HTML in the source is not rendered (react-markdown default), and
// unsafe URLs such as javascript: are stripped by its URL transform.
const components: Components = {
  p: ({ children }) => <p className="my-3 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-6">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-6">{children}</ol>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  // Images by URL only; uploads are not used for task texts.
  // eslint-disable-next-line @next/next/no-img-element -- external URLs of unknown size
  img: ({ src, alt }) => <img src={typeof src === "string" ? src : undefined} alt={alt ?? ""} className="my-3 h-auto max-w-full rounded-lg" />,
  a: ({ children, href }) => (
    <a href={href} className="text-brand-600 underline" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-xl border-2 border-line">
      <table className="min-w-full border-collapse text-sm tabular-nums">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b-2 border-line bg-paper px-3 py-2 text-left font-bold">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="border-t border-line px-3 py-2">{children}</td>,
};

export function Markdown({ children }: { children: string }) {
  return (
    <div className="text-[17px] leading-relaxed text-ink">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
