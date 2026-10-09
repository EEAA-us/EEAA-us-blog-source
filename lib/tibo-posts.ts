import { parse } from "acorn";

type Ast = { type: string; [key: string]: unknown };
type RecordValue = Record<string, unknown>;
export interface TiboPost { id: string; text: string; publishedAt: string; url: string }
const asRecord = (value: unknown): RecordValue => value && typeof value === "object" ? value as RecordValue : {};

// Read the public profile's serialized data as syntax. Never execute its
// scripts: only literal values, containers and numbered references are read.
export function parseTiboPosts(html: string): TiboPost[] {
  if (html.length > 2_000_000 || !html.includes('Tibo (@thsottiaux)')) throw new Error("无法确认动态来源");
  const definitions = new Map<number, Ast>();
  const values = new Map<number, unknown>();
  const reference = (node: Ast): number | null => {
    const object = asRecord(node.object), property = asRecord(node.property);
    return node.type === "MemberExpression" && object.name === "$R" && property.type === "Literal" && typeof property.value === "number"
      ? property.value : null;
  };
  const walk = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(walk); return; }
    const node = value as Ast;
    if (node.type === "AssignmentExpression" && node.operator === "=") {
      const key = reference(node.left as Ast);
      if (key !== null) definitions.set(key, node.right as Ast);
    }
    Object.values(node).forEach(walk);
  };
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
    if (!match[1].includes("$R[")) continue;
    try { walk(parse(match[1], { ecmaVersion: "latest" })); } catch { /* Other page scripts are not data. */ }
  }
  const resolving = new Set<number>();
  const readReference = (key: number): unknown => {
    if (values.has(key)) return values.get(key);
    if (resolving.has(key) || !definitions.has(key)) return null;
    resolving.add(key);
    const result = read(definitions.get(key)!);
    values.set(key, result);
    resolving.delete(key);
    return result;
  };
  const read = (node: Ast): unknown => {
    if (node.type === "Literal") return node.value;
    if (node.type === "MemberExpression") { const key = reference(node); return key === null ? null : readReference(key); }
    if (node.type === "AssignmentExpression") return read(node.right as Ast);
    if (node.type === "UnaryExpression" && node.operator === "!") return !read(node.argument as Ast);
    if (node.type === "ArrayExpression") return (node.elements as Ast[]).map(item => item ? read(item) : null);
    if (node.type === "ObjectExpression") {
      const record: RecordValue = Object.create(null);
      for (const property of node.properties as Ast[]) {
        if (property.type !== "Property" || property.computed) continue;
        const keyNode = asRecord(property.key);
        const key = keyNode.type === "Identifier" ? keyNode.name : keyNode.value;
        if (typeof key === "string") record[key] = read(property.value as Ast);
      }
      return record;
    }
    return null;
  };
  for (const key of definitions.keys()) readReference(key);
  const posts = new Map<string, TiboPost>();
  for (const value of values.values()) {
    const tweet = asRecord(value);
    if (tweet.__typename !== "Tweet") continue;
    const user = asRecord(asRecord(asRecord(tweet.core).user_results).result);
    if (asRecord(user.core).screen_name !== "thsottiaux") continue;
    const details = asRecord(tweet.details);
    const note = asRecord(asRecord(asRecord(tweet.note_tweet).note_tweet_results).result);
    const text = typeof note.text === "string" ? note.text : details.full_text;
    const id = tweet.rest_id, timestamp = details.created_at_ms;
    if (typeof id !== "string" || !/^\d{10,25}$/.test(id) || typeof text !== "string" || typeof timestamp !== "number" || !Number.isFinite(timestamp)) continue;
    const date = new Date(timestamp);
    if (!Number.isFinite(date.getTime())) continue;
    posts.set(id, { id, text, publishedAt: date.toISOString(), url: `https://x.com/thsottiaux/status/${id}` });
  }
  return [...posts.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 6);
}
