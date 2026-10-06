import { cp, readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import type { Plugin } from "vite";

/** Keep editor runtime assets on the same origin, including offline admin use. */
export function localVditor(): Plugin {
  let source = "";
  let output = "";
  let base = "/";
  let building = false;
  return {
    name: "local-vditor-runtime",
    configResolved(config) {
      source = resolve(config.root, "node_modules/vditor/dist");
      output = resolve(config.root, config.build.outDir, "vditor/dist");
      base = config.base;
      building = config.command === "build";
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const prefix = `${base}vditor/dist/`;
        const pathname = new URL(req.url || "/", "http://localhost").pathname;
        if (!pathname.startsWith(prefix)) return next();
        let file: string;
        try {
          file = resolve(
            source,
            decodeURIComponent(pathname.slice(prefix.length))
          );
          if (!file.startsWith(source + sep)) return next();
          const data = await readFile(file);
          const extension = file.split(".").pop();
          const mime: Record<string, string> = {
            js: "text/javascript",
            css: "text/css",
            svg: "image/svg+xml",
            json: "application/json",
            woff: "font/woff",
            woff2: "font/woff2"
          };
          res.setHeader(
            "Content-Type",
            mime[extension || ""] || "application/octet-stream"
          );
          res.end(data);
        } catch {
          next();
        }
      });
    },
    async closeBundle() {
      if (building) await cp(source, output, { recursive: true });
    }
  };
}
