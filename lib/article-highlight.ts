import hljs from "highlight.js/lib/core";
import typescript from "highlight.js/lib/languages/typescript";
import javascript from "highlight.js/lib/languages/javascript";
import python from "highlight.js/lib/languages/python";
import bash from "highlight.js/lib/languages/bash";
import shell from "highlight.js/lib/languages/shell";
import json from "highlight.js/lib/languages/json";
import css from "highlight.js/lib/languages/css";
import xml from "highlight.js/lib/languages/xml";
import nginx from "highlight.js/lib/languages/nginx";
import sql from "highlight.js/lib/languages/sql";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import makefile from "highlight.js/lib/languages/makefile";
import plaintext from "highlight.js/lib/languages/plaintext";
import cpp from "highlight.js/lib/languages/cpp";

hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("tsx", typescript);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("py", python);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("shell", shell);
hljs.registerLanguage("json", json);
hljs.registerLanguage("css", css);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("svg", xml);
hljs.registerLanguage("nginx", nginx);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("dockerfile", dockerfile);
hljs.registerLanguage("makefile", makefile);
hljs.registerLanguage("text", plaintext);
hljs.registerLanguage("plaintext", plaintext);
hljs.registerLanguage("console", shell);
hljs.registerLanguage("ini", plaintext);
hljs.registerLanguage("cpp", cpp); // Includes C/C++ aliases used by STM32 notes.

export function highlightArticleCode(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("pre code[class*=language-]").forEach((element) => {
    if (!element.dataset.highlighted) hljs.highlightElement(element);
  });
}
