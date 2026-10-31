// Static audit of the code that can be reached from outside: every server
// action and route handler must check who is calling, secrets may only be
// read in server modules, and client components must not import them.
// A new action or route fails this test until it is reviewed here.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const sources = walk("src").filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith(".test.ts"));
const read = (f: string) => readFileSync(f, "utf8");

// Body of each exported async function, up to the next top-level export.
function exportedFunctions(source: string): Map<string, string> {
  const result = new Map<string, string>();
  const matches = [...source.matchAll(/^export (?:async )?function (\w+)/gm)];
  matches.forEach((match, i) => {
    const end = i + 1 < matches.length ? matches[i + 1].index : source.length;
    result.set(match[1], source.slice(match.index, end));
  });
  return result;
}

const GUARDS = /\b(requireUser|requireAdmin|authorizeTask|loadTarget)\(/;

// Public by design: signing in, signing up and signing out need no session.
const PUBLIC_ACTIONS = new Set(["src/lib/auth/actions.ts:signIn", "src/lib/auth/actions.ts:signUp", "src/lib/auth/actions.ts:signOut"]);

describe("server actions", () => {
  const actionFiles = sources.filter((f) => /^\s*["']use server["'];?/m.test(read(f)));

  it("are only in the reviewed files", () => {
    expect(actionFiles.sort()).toEqual(["src/lib/admin/actions.ts", "src/lib/auth/actions.ts", "src/lib/learn/actions.ts"]);
  });

  for (const file of ["src/lib/admin/actions.ts", "src/lib/learn/actions.ts", "src/lib/auth/actions.ts"]) {
    for (const [name, body] of exportedFunctions(read(file))) {
      const key = `${file}:${name}`;
      it(`${key} checks the caller`, () => {
        if (PUBLIC_ACTIONS.has(key)) return;
        expect(body, `${key} has no requireUser/requireAdmin/authorizeTask/loadTarget`).toMatch(GUARDS);
      });
    }
  }

  it("admin actions check the admin role", () => {
    for (const [name, body] of exportedFunctions(read("src/lib/admin/actions.ts"))) {
      expect(body, name).toMatch(/\b(requireAdmin|loadTarget)\(/);
    }
    expect(read("src/lib/admin/actions.ts")).toMatch(/async function loadTarget[\s\S]*?requireAdmin\(/);
  });
});

describe("admin data access", () => {
  it("every async query starts by checking the admin role", () => {
    for (const [name, body] of exportedFunctions(read("src/lib/admin/queries.ts"))) {
      if (!/^export async function/.test(body)) continue;
      expect(body, name).toMatch(/await requireAdmin\(\)/);
    }
  });
});

describe("route handlers", () => {
  const routes = sources.filter((f) => f.endsWith("/route.ts"));

  it("are only the reviewed ones", () => {
    expect(routes.sort()).toEqual([
      "src/app/(app)/admin/export/attempts/route.ts",
      "src/app/(app)/admin/export/chats/route.ts",
      "src/app/(app)/files/[id]/route.ts",
    ]);
  });

  it("check the caller directly or through an admin query", () => {
    const queries = exportedFunctions(read("src/lib/admin/queries.ts"));
    for (const route of routes) {
      const source = read(route);
      const viaQuery = [...source.matchAll(/await (build\w+Csv)\(\)/g)].map((m) => m[1]);
      if (viaQuery.length > 0) {
        for (const fn of viaQuery) expect(queries.get(fn), `${route} -> ${fn}`).toMatch(/await requireAdmin\(\)/);
      } else {
        expect(source, route).toMatch(GUARDS);
      }
    }
  });
});

describe("secrets", () => {
  it("are read only in server modules and scripts", () => {
    const readers = sources.filter((f) => /process\.env\.(ANTHROPIC_API_KEY|SUPABASE_SERVICE_ROLE_KEY)/.test(read(f)));
    expect(readers.sort()).toEqual(["src/lib/ai/client.ts", "src/lib/supabase/admin.ts"]);
    expect(read("src/lib/supabase/admin.ts")).toMatch(/^import "server-only";/m);
  });

  it("the AI client is reached by the app only through the server-only entry", () => {
    const importsClient = (f: string) =>
      /from ["'](@\/lib\/ai\/client|[^"']*lib\/ai\/client)(\.ts)?["']/.test(read(f)) ||
      (f.startsWith("src/lib/ai/") && /from ["']\.\/client(\.ts)?["']/.test(read(f)));
    const importers = sources.filter(importsClient);
    expect(importers.sort()).toEqual(["src/lib/ai/grader.ts", "src/lib/ai/index.ts", "src/lib/ai/mentor.ts"]);
    expect(read("src/lib/ai/index.ts")).toMatch(/^import "server-only";/m);
  });

  it("only the Supabase URL and anon key are public variables", () => {
    const names = new Set(sources.flatMap((f) => [...read(f).matchAll(/NEXT_PUBLIC_\w+/g)].map((m) => m[0])));
    expect([...names].sort()).toEqual(["NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_URL"]);
  });
});

describe("client components", () => {
  const SERVER_ONLY = [
    "@/lib/supabase/admin",
    "@/lib/supabase/server",
    "@/lib/ai",
    "@/lib/files/store",
    "@/lib/admin/queries",
    "@/lib/learn/data",
    "@/lib/learn/ai-store",
    "@/lib/auth/guards",
  ];

  it("never import server-only modules", () => {
    const clientFiles = sources.filter((f) => /^\s*["']use client["'];?/m.test(read(f)));
    expect(clientFiles.length).toBeGreaterThan(5);
    for (const file of clientFiles) {
      for (const match of read(file).matchAll(/^import (?!type\b)[^;]*from ["']([^"']+)["']/gm)) {
        expect(SERVER_ONLY, `${file} imports ${match[1]}`).not.toContain(match[1]);
      }
    }
  });
});

describe("security headers", () => {
  it("are sent for every path", async () => {
    const { default: config, SECURITY_HEADERS } = await import("../next.config");
    const rules = await config.headers!();
    expect(rules).toEqual([{ source: "/:path*", headers: SECURITY_HEADERS }]);
    const names = SECURITY_HEADERS.map((h) => h.key);
    expect(names).toEqual(["X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy"]);
  });
});
