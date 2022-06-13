import {
  AnyNode,
  AttrEntry,
  Attrs,
  AttrVal,
  Elem,
  Fragment,
  isElem,
  isFragment,
  isTextNode,
  TextNode,
} from "../core/node.ts";
import { concat, join } from "../core/utils.ts";
import { Renderer } from "./types.ts";

interface HtmlStrRendererOpts {
  doctype?: string;
  forceRenderDoctype?: boolean;
  wrapNode?: (node: AnyNode) => AnyNode;
  onVisitAttr?: (entry: AttrEntry, params: OnVisitAttrParams) => AttrEntry;
}

interface HtmlStrRendererHooks {
  onVisitAttr: (entry: AttrEntry, params: OnVisitAttrParams) => AttrEntry;
}

export interface OnVisitAttrParams {
  readonly tagName: string;
  readonly attrs: Attrs;
}

export class HtmlStrRenderer implements Renderer<string> {
  #doctype: string;
  #forceRenderDoctype: boolean;
  #wrapNode: (node: AnyNode) => AnyNode;
  #hooks: HtmlStrRendererHooks;

  constructor(opts?: HtmlStrRendererOpts) {
    this.#doctype = opts?.doctype ?? "html";
    this.#forceRenderDoctype = opts?.forceRenderDoctype ?? false;
    this.#wrapNode = opts?.wrapNode ?? identity;
    this.#hooks = {
      onVisitAttr: opts?.onVisitAttr ?? identity,
    };
  }

  render(node: AnyNode): string {
    const wrappedNode = this.#wrapNode(node);
    const shouldRenderDoctype = this.#forceRenderDoctype ||
      (isElem(wrappedNode) && wrappedNode.tagName === "html");
    return concat([
      shouldRenderDoctype && encodeDoctype(this.#doctype),
      encodeAnyNode(wrappedNode, this.#hooks),
    ]);
  }
}

function identity<T>(val: T): T {
  return val;
}

function encodeDoctype(value: string): string {
  return `<!doctype ${value}>`;
}

function encodeAnyNode(node: AnyNode, hooks: HtmlStrRendererHooks): string {
  return isTextNode(node)
    ? encodeTextNode(node)
    : isFragment(node)
    ? encodeHtmlFragment(node, hooks)
    : encodeHtmlElement(node, hooks);
}

function encodeTextNode(node: TextNode): string {
  return node.innerText;
}

function encodeHtmlFragment(
  node: Fragment,
  hooks: HtmlStrRendererHooks,
): string {
  return concatEncodedNodes(
    node.children.map((ch) => encodeAnyNode(ch, hooks)),
  );
}

function encodeHtmlElement(
  { tagName, attrs, children }: Elem,
  hooks: HtmlStrRendererHooks,
): string {
  const open = `<${join(" ", [tagName, encodeAttrs(tagName, attrs, hooks)])}>`;
  if (isSelfClosedTagName(tagName)) return open;

  const encodedChildren = children.map((ch) => encodeAnyNode(ch, hooks));
  return `${open}${concatEncodedNodes(encodedChildren)}</${tagName}>`;
}

function concatEncodedNodes(encodedChildren: string[]): string {
  return join(" ", encodedChildren).replace(/>\s+?</g, "><");
}

function encodeAttrs(
  tagName: string,
  attrs: Attrs,
  hooks: HtmlStrRendererHooks,
): string {
  return join(
    " ",
    Object.entries(attrs).map((entry) => {
      const [key, value] = hooks.onVisitAttr(entry, { tagName, attrs });
      return encodeAttr(key, value);
    }),
  );
}

function encodeAttr(key: string, value: AttrVal): string {
  if (typeof value === "boolean") {
    return value ? key : "";
  }
  return `${key}="${value}"`;
}

function isSelfClosedTagName(tagName: string): boolean {
  return SELF_CLOSED_HTML_TAG_NAMES.includes(tagName);
}

const SELF_CLOSED_HTML_TAG_NAMES = [
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
  "command",
  "keygen",
  "menuitem",
];