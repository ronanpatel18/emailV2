import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // Preserve whitespace inside text nodes. Word encodes inter-word
  // spaces between styled runs as a standalone <w:t xml:space="preserve"> </w:t>.
  // Default trimming would collapse that single-space run to "", causing
  // adjacent words to concatenate (e.g. "boldword" + "regularword").
  trimValues: false,
  isArray: (_name: string) => {
    const arrayElements = [
      "w:p",
      "w:r",
      "w:t",
      "w:tbl",
      "w:tr",
      "w:tc",
      "w:drawing",
      "w:style",
      "w:hyperlink",
      "w:bookmarkStart",
      "w:bookmarkEnd",
      "w:br",
      "w:tab",
      "w:pict",
      "Relationship",
      "w:numPr",
      "w:abstractNum",
      "w:num",
      "w:lvl",
    ];
    return arrayElements.includes(_name);
  },
});

// ---- Types ----

interface RunStyle {
  fontFamily?: string;
  fontSize?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  highlight?: string;
  vertAlign?: string; // superscript / subscript
}

interface ParaStyle {
  alignment?: string;
  lineSpacing?: string;
  spaceBefore?: string;
  spaceAfter?: string;
  indent?: string;
  runStyle?: RunStyle;
}

interface StyleDef {
  para?: ParaStyle;
  run?: RunStyle;
}

type StyleMap = Map<string, StyleDef>;
type ImageMap = Map<string, { base64: string; contentType: string }>;
type RelMap = Map<string, string>;

// ---- Main export ----

/**
 * Converts a DOCX buffer to HTML with full inline styles preserved.
 * Handles fonts, sizes, colors, bold/italic/underline, images (base64), tables, and hyperlinks.
 */
export async function convertDocxToStyledHtml(
  buffer: Buffer | ArrayBuffer
): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);

  // Parse XML files
  const [docXml, stylesXml, relsXml] = await Promise.all([
    readXml(zip, "word/document.xml"),
    readXml(zip, "word/styles.xml"),
    readXml(zip, "word/_rels/document.xml.rels"),
  ]);

  if (!docXml) throw new Error("Invalid DOCX: missing document.xml");

  // Build lookups
  const styleMap = buildStyleMap(stylesXml);
  const relMap = buildRelMap(relsXml);
  const imageMap = await extractImages(zip, relMap);

  // Get default style
  const defaultRun = getDefaultRunStyle(stylesXml);

  // Convert body
  const body = docXml?.["w:document"]?.["w:body"];
  if (!body) return "";

  const html = convertBody(body, styleMap, relMap, imageMap, defaultRun);
  return html;
}

// ---- XML helpers ----

async function readXml(
  zip: JSZip,
  path: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const file = zip.file(path);
  if (!file) return null;
  const text = await file.async("text");
  return parser.parse(text);
}

// ---- Style parsing ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getDefaultRunStyle(stylesXml: any): RunStyle {
  if (!stylesXml) return { fontFamily: "Calibri", fontSize: "11pt" };

  const docDefaults = stylesXml?.["w:styles"]?.["w:docDefaults"];
  const rPrDefault = docDefaults?.["w:rPrDefault"]?.["w:rPr"] as
    | Record<string, unknown>
    | undefined;

  const result: RunStyle = {
    fontFamily: "Calibri",
    fontSize: "11pt",
  };

  if (rPrDefault) {
    const fonts = rPrDefault["w:rFonts"] as Record<string, string> | undefined;
    if (fonts?.["@_w:ascii"]) result.fontFamily = fonts["@_w:ascii"];
    else if (fonts?.["@_w:asciiTheme"]) result.fontFamily = "Calibri";

    const sz = rPrDefault["w:sz"] as Record<string, string> | undefined;
    if (sz?.["@_w:val"]) {
      result.fontSize = parseInt(sz["@_w:val"]) / 2 + "pt";
    }
  }

  return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildStyleMap(stylesXml: any): StyleMap {
  const map: StyleMap = new Map();
  if (!stylesXml) return map;

  const styles = stylesXml?.["w:styles"];
  if (!styles) return map;

  const styleList = styles["w:style"] as
    | Array<Record<string, unknown>>
    | undefined;
  if (!styleList) return map;

  for (const style of styleList) {
    const styleId = style["@_w:styleId"] as string;
    if (!styleId) continue;

    const def: StyleDef = {};

    // Paragraph properties
    const pPr = style["w:pPr"] as Record<string, unknown> | undefined;
    if (pPr) {
      def.para = extractParaProps(pPr);
    }

    // Run properties
    const rPr = style["w:rPr"] as Record<string, unknown> | undefined;
    if (rPr) {
      def.run = extractRunProps(rPr);
    }

    map.set(styleId, def);
  }

  return map;
}

function extractParaProps(pPr: Record<string, unknown>): ParaStyle {
  const style: ParaStyle = {};

  const jc = pPr["w:jc"] as Record<string, string> | undefined;
  if (jc?.["@_w:val"]) {
    const val = jc["@_w:val"];
    if (val === "center") style.alignment = "center";
    else if (val === "right" || val === "end") style.alignment = "right";
    else if (val === "both" || val === "distribute")
      style.alignment = "justify";
    else style.alignment = "left";
  }

  const spacing = pPr["w:spacing"] as Record<string, string> | undefined;
  if (spacing) {
    if (spacing["@_w:before"])
      style.spaceBefore = parseInt(spacing["@_w:before"]) / 20 + "pt";
    if (spacing["@_w:after"])
      style.spaceAfter = parseInt(spacing["@_w:after"]) / 20 + "pt";
    if (spacing["@_w:line"]) {
      const lineVal = parseInt(spacing["@_w:line"]);
      if (lineVal > 0) {
        style.lineSpacing = (lineVal / 240).toFixed(2);
      }
    }
  }

  const ind = pPr["w:ind"] as Record<string, string> | undefined;
  if (ind?.["@_w:left"]) {
    style.indent = parseInt(ind["@_w:left"]) / 20 + "pt";
  }

  // Inline run props from paragraph style
  const rPr = pPr["w:rPr"] as Record<string, unknown> | undefined;
  if (rPr) {
    style.runStyle = extractRunProps(rPr);
  }

  return style;
}

function extractRunProps(rPr: Record<string, unknown>): RunStyle {
  const style: RunStyle = {};

  // Font
  const fonts = rPr["w:rFonts"] as Record<string, string> | undefined;
  if (fonts) {
    style.fontFamily =
      fonts["@_w:ascii"] || fonts["@_w:hAnsi"] || fonts["@_w:cs"];
  }

  // Size (stored in half-points)
  const sz = rPr["w:sz"] as Record<string, string> | undefined;
  if (sz?.["@_w:val"]) {
    style.fontSize = parseInt(sz["@_w:val"]) / 2 + "pt";
  }
  // Also check szCs
  if (!style.fontSize) {
    const szCs = rPr["w:szCs"] as Record<string, string> | undefined;
    if (szCs?.["@_w:val"]) {
      style.fontSize = parseInt(szCs["@_w:val"]) / 2 + "pt";
    }
  }

  // Color
  const color = rPr["w:color"] as Record<string, string> | undefined;
  if (color?.["@_w:val"] && color["@_w:val"] !== "auto") {
    style.color = "#" + color["@_w:val"];
  }

  // Bold
  if (rPr["w:b"] !== undefined) {
    const b = rPr["w:b"] as Record<string, string> | string | boolean;
    if (typeof b === "string" || typeof b === "boolean") {
      style.bold = b !== "0" && b !== "false" && b !== false;
    } else {
      style.bold = b?.["@_w:val"] !== "0" && b?.["@_w:val"] !== "false";
    }
  }
  if (rPr["w:bCs"] !== undefined && style.bold === undefined) {
    style.bold = true;
  }

  // Italic
  if (rPr["w:i"] !== undefined) {
    const i = rPr["w:i"] as Record<string, string> | string | boolean;
    if (typeof i === "string" || typeof i === "boolean") {
      style.italic = i !== "0" && i !== "false" && i !== false;
    } else {
      style.italic = i?.["@_w:val"] !== "0" && i?.["@_w:val"] !== "false";
    }
  }

  // Underline
  const u = rPr["w:u"] as Record<string, string> | undefined;
  if (u && u?.["@_w:val"] !== "none") {
    style.underline = true;
  }

  // Strikethrough
  if (rPr["w:strike"] !== undefined) {
    style.strikethrough = true;
  }

  // Highlight
  const highlight = rPr["w:highlight"] as Record<string, string> | undefined;
  if (highlight?.["@_w:val"]) {
    style.highlight = wordColorToHex(highlight["@_w:val"]);
  }

  // Vertical alignment (superscript/subscript)
  const vertAlign = rPr["w:vertAlign"] as Record<string, string> | undefined;
  if (vertAlign?.["@_w:val"]) {
    style.vertAlign = vertAlign["@_w:val"];
  }

  return style;
}

// ---- Relationship / image parsing ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildRelMap(relsXml: any): RelMap {
  const map: RelMap = new Map();
  if (!relsXml) return map;

  const rels = relsXml?.["Relationships"];
  if (!rels) return map;

  const relList = rels["Relationship"] as
    | Array<Record<string, string>>
    | undefined;
  if (!relList) return map;

  for (const rel of relList) {
    const id = rel["@_Id"];
    const target = rel["@_Target"];
    if (id && target) {
      map.set(id, target);
    }
  }

  return map;
}

async function extractImages(
  zip: JSZip,
  relMap: RelMap
): Promise<ImageMap> {
  const images: ImageMap = new Map();

  for (const [rId, target] of relMap) {
    if (!target.startsWith("media/") && !target.startsWith("word/media/"))
      continue;

    const path = target.startsWith("word/") ? target : `word/${target}`;
    const file = zip.file(path);
    if (!file) continue;

    const data = await file.async("base64");
    const ext = target.split(".").pop()?.toLowerCase() || "png";
    const contentType =
      ext === "jpg" || ext === "jpeg"
        ? "image/jpeg"
        : ext === "gif"
          ? "image/gif"
          : ext === "svg"
            ? "image/svg+xml"
            : ext === "webp"
              ? "image/webp"
              : "image/png";

    images.set(rId, { base64: data, contentType });
  }

  return images;
}

// ---- HTML conversion ----

function convertBody(
  body: Record<string, unknown>,
  styleMap: StyleMap,
  relMap: RelMap,
  imageMap: ImageMap,
  defaultRun: RunStyle
): string {
  const parts: string[] = [];
  const children = getChildren(body);

  for (const child of children) {
    if (child.name === "w:p") {
      parts.push(convertParagraph(child.node, styleMap, relMap, imageMap, defaultRun));
    } else if (child.name === "w:tbl") {
      parts.push(convertTable(child.node, styleMap, relMap, imageMap, defaultRun));
    }
  }

  return parts.join("\n");
}

function convertParagraph(
  p: Record<string, unknown>,
  styleMap: StyleMap,
  relMap: RelMap,
  imageMap: ImageMap,
  defaultRun: RunStyle
): string {
  // Get paragraph properties
  const pPr = p["w:pPr"] as Record<string, unknown> | undefined;
  let paraStyle: ParaStyle = {};
  let inheritedRunStyle: RunStyle = {};

  // Apply named style
  if (pPr) {
    const pStyleRef = pPr["w:pStyle"] as Record<string, string> | undefined;
    if (pStyleRef?.["@_w:val"]) {
      const styleDef = styleMap.get(pStyleRef["@_w:val"]);
      if (styleDef?.para) paraStyle = { ...styleDef.para };
      if (styleDef?.run) inheritedRunStyle = { ...styleDef.run };
      if (styleDef?.para?.runStyle)
        inheritedRunStyle = { ...inheritedRunStyle, ...styleDef.para.runStyle };
    }

    // Override with direct formatting
    const directPara = extractParaProps(pPr);
    paraStyle = { ...paraStyle, ...directPara };
    if (directPara.runStyle)
      inheritedRunStyle = { ...inheritedRunStyle, ...directPara.runStyle };
  }

  // Build paragraph CSS
  const pCss: string[] = [];
  if (paraStyle.alignment) pCss.push(`text-align:${paraStyle.alignment}`);
  if (paraStyle.spaceBefore) pCss.push(`margin-top:${paraStyle.spaceBefore}`);
  if (paraStyle.spaceAfter) pCss.push(`margin-bottom:${paraStyle.spaceAfter}`);
  if (paraStyle.lineSpacing)
    pCss.push(`line-height:${paraStyle.lineSpacing}`);
  if (paraStyle.indent) pCss.push(`padding-left:${paraStyle.indent}`);

  // Apply default font to paragraph if not set by style
  const pDefaultFont = inheritedRunStyle.fontFamily || defaultRun.fontFamily;
  const pDefaultSize = inheritedRunStyle.fontSize || defaultRun.fontSize;
  if (pDefaultFont) pCss.push(`font-family:'${pDefaultFont}',sans-serif`);
  if (pDefaultSize) pCss.push(`font-size:${pDefaultSize}`);
  if (inheritedRunStyle.color) pCss.push(`color:${inheritedRunStyle.color}`);
  if (inheritedRunStyle.bold) pCss.push("font-weight:bold");
  if (inheritedRunStyle.italic) pCss.push("font-style:italic");

  // Convert runs
  const innerHtml = convertRuns(p, styleMap, relMap, imageMap, defaultRun, inheritedRunStyle);

  // Empty paragraph = line break
  if (!innerHtml.trim()) {
    const styleAttr = pCss.length > 0 ? ` style="${pCss.join(";")}"` : "";
    return `<p${styleAttr}>&nbsp;</p>`;
  }

  // Check if this is a heading style
  const pStyleRef = (pPr?.["w:pStyle"] as Record<string, string>)?.["@_w:val"];
  let tag = "p";
  if (pStyleRef) {
    const lower = pStyleRef.toLowerCase();
    if (lower === "heading1" || lower === "title") tag = "h1";
    else if (lower === "heading2" || lower === "subtitle") tag = "h2";
    else if (lower === "heading3") tag = "h3";
    else if (lower === "heading4") tag = "h4";
  }

  const styleAttr = pCss.length > 0 ? ` style="${pCss.join(";")}"` : "";
  return `<${tag}${styleAttr}>${innerHtml}</${tag}>`;
}

function convertRuns(
  p: Record<string, unknown>,
  styleMap: StyleMap,
  relMap: RelMap,
  imageMap: ImageMap,
  defaultRun: RunStyle,
  inheritedRunStyle: RunStyle
): string {
  const parts: string[] = [];
  const children = getChildren(p);

  for (const child of children) {
    if (child.name === "w:r") {
      parts.push(
        convertRun(child.node, styleMap, imageMap, defaultRun, inheritedRunStyle)
      );
    } else if (child.name === "w:hyperlink") {
      parts.push(
        convertHyperlink(
          child.node,
          styleMap,
          relMap,
          imageMap,
          defaultRun,
          inheritedRunStyle
        )
      );
    }
  }

  return parts.join("");
}

function convertRun(
  r: Record<string, unknown>,
  styleMap: StyleMap,
  imageMap: ImageMap,
  defaultRun: RunStyle,
  inheritedRunStyle: RunStyle
): string {
  const parts: string[] = [];

  // Get run properties
  const rPr = r["w:rPr"] as Record<string, unknown> | undefined;
  let runStyle: RunStyle = {};

  // Apply named run style
  if (rPr) {
    const rStyleRef = rPr["w:rStyle"] as Record<string, string> | undefined;
    if (rStyleRef?.["@_w:val"]) {
      const styleDef = styleMap.get(rStyleRef["@_w:val"]);
      if (styleDef?.run) runStyle = { ...styleDef.run };
    }

    // Override with direct formatting
    const directRun = extractRunProps(rPr);
    runStyle = { ...runStyle, ...directRun };
  }

  // Text
  const texts = r["w:t"];
  if (texts) {
    const textArr = Array.isArray(texts) ? texts : [texts];
    for (const t of textArr) {
      const textContent = typeof t === "object" ? (t as Record<string, unknown>)["#text"] : t;
      if (textContent !== undefined && textContent !== null) {
        parts.push(escapeHtml(String(textContent)));
      }
    }
  }

  // Line break
  if (r["w:br"]) {
    parts.push("<br>");
  }

  // Tab
  if (r["w:tab"]) {
    parts.push("&emsp;");
  }

  // Images
  const drawings = r["w:drawing"];
  if (drawings) {
    const drawingArr = Array.isArray(drawings) ? drawings : [drawings];
    for (const drawing of drawingArr) {
      const img = extractImageFromDrawing(drawing as Record<string, unknown>, imageMap);
      if (img) parts.push(img);
    }
  }

  // Legacy images (w:pict)
  const picts = r["w:pict"];
  if (picts) {
    const pictArr = Array.isArray(picts) ? picts : [picts];
    for (const pict of pictArr) {
      const img = extractImageFromPict(pict as Record<string, unknown>, imageMap);
      if (img) parts.push(img);
    }
  }

  if (parts.length === 0) return "";

  // Build inline CSS — only include styles that differ from inherited/default
  const css: string[] = [];
  const effectiveFont = runStyle.fontFamily || inheritedRunStyle.fontFamily;
  const effectiveSize = runStyle.fontSize || inheritedRunStyle.fontSize;

  if (runStyle.fontFamily && runStyle.fontFamily !== inheritedRunStyle.fontFamily && runStyle.fontFamily !== defaultRun.fontFamily) {
    css.push(`font-family:'${runStyle.fontFamily}',sans-serif`);
  }
  if (runStyle.fontSize && runStyle.fontSize !== inheritedRunStyle.fontSize && runStyle.fontSize !== defaultRun.fontSize) {
    css.push(`font-size:${runStyle.fontSize}`);
  }
  if (runStyle.color && runStyle.color !== inheritedRunStyle.color) {
    css.push(`color:${runStyle.color}`);
  }

  const isBold = runStyle.bold !== undefined ? runStyle.bold : false;
  const inheritBold = inheritedRunStyle.bold || false;
  if (isBold && !inheritBold) css.push("font-weight:bold");
  else if (!isBold && inheritBold) css.push("font-weight:normal");

  const isItalic = runStyle.italic !== undefined ? runStyle.italic : false;
  const inheritItalic = inheritedRunStyle.italic || false;
  if (isItalic && !inheritItalic) css.push("font-style:italic");
  else if (!isItalic && inheritItalic) css.push("font-style:normal");

  if (runStyle.underline) css.push("text-decoration:underline");
  if (runStyle.strikethrough) css.push("text-decoration:line-through");
  if (runStyle.highlight) css.push(`background-color:${runStyle.highlight}`);

  const content = parts.join("");

  // Wrap in superscript/subscript if needed
  let wrapped = content;
  if (runStyle.vertAlign === "superscript") wrapped = `<sup>${content}</sup>`;
  else if (runStyle.vertAlign === "subscript") wrapped = `<sub>${content}</sub>`;

  if (css.length === 0 && !effectiveFont && !effectiveSize) return wrapped;

  return `<span style="${css.join(";")}">${wrapped}</span>`;
}

function convertHyperlink(
  node: Record<string, unknown>,
  styleMap: StyleMap,
  relMap: RelMap,
  imageMap: ImageMap,
  defaultRun: RunStyle,
  inheritedRunStyle: RunStyle
): string {
  const rId = node["@_r:id"] as string | undefined;
  const href = rId ? relMap.get(rId) || "#" : "#";

  const runs = node["w:r"];
  if (!runs) return "";

  const runArr = Array.isArray(runs) ? runs : [runs];
  const inner = runArr
    .map((r) =>
      convertRun(
        r as Record<string, unknown>,
        styleMap,
        imageMap,
        defaultRun,
        inheritedRunStyle
      )
    )
    .join("");

  return `<a href="${escapeHtml(href)}" style="color:#0563C1;text-decoration:underline">${inner}</a>`;
}

// ---- Table conversion ----

function convertTable(
  tbl: Record<string, unknown>,
  styleMap: StyleMap,
  relMap: RelMap,
  imageMap: ImageMap,
  defaultRun: RunStyle
): string {
  const rows = tbl["w:tr"];
  if (!rows) return "";

  const rowArr = Array.isArray(rows) ? rows : [rows];
  const rowsHtml = rowArr
    .map((row) =>
      convertTableRow(
        row as Record<string, unknown>,
        styleMap,
        relMap,
        imageMap,
        defaultRun
      )
    )
    .join("\n");

  return `<table style="border-collapse:collapse;width:100%" cellpadding="6" cellspacing="0">\n${rowsHtml}\n</table>`;
}

function convertTableRow(
  tr: Record<string, unknown>,
  styleMap: StyleMap,
  relMap: RelMap,
  imageMap: ImageMap,
  defaultRun: RunStyle
): string {
  const cells = tr["w:tc"];
  if (!cells) return "<tr></tr>";

  const cellArr = Array.isArray(cells) ? cells : [cells];
  const cellsHtml = cellArr
    .map((cell) =>
      convertTableCell(
        cell as Record<string, unknown>,
        styleMap,
        relMap,
        imageMap,
        defaultRun
      )
    )
    .join("");

  return `<tr>${cellsHtml}</tr>`;
}

function convertTableCell(
  tc: Record<string, unknown>,
  styleMap: StyleMap,
  relMap: RelMap,
  imageMap: ImageMap,
  defaultRun: RunStyle
): string {
  const css = ["border:1px solid #d0d0d0", "vertical-align:top"];

  // Check cell properties for shading
  const tcPr = tc["w:tcPr"] as Record<string, unknown> | undefined;
  if (tcPr) {
    const shd = tcPr["w:shd"] as Record<string, string> | undefined;
    if (shd?.["@_w:fill"] && shd["@_w:fill"] !== "auto") {
      css.push(`background-color:#${shd["@_w:fill"]}`);
    }
  }

  // Convert cell content (paragraphs)
  const paras = tc["w:p"];
  if (!paras) return `<td style="${css.join(";")}"></td>`;

  const paraArr = Array.isArray(paras) ? paras : [paras];
  const inner = paraArr
    .map((p) =>
      convertParagraph(
        p as Record<string, unknown>,
        styleMap,
        relMap,
        imageMap,
        defaultRun
      )
    )
    .join("");

  return `<td style="${css.join(";")}">${inner}</td>`;
}

// ---- Image extraction from drawing XML ----

function extractImageFromDrawing(
  drawing: Record<string, unknown>,
  imageMap: ImageMap
): string | null {
  // Navigate to the blip element
  const inline =
    (drawing["wp:inline"] as Record<string, unknown>) ||
    (drawing["wp:anchor"] as Record<string, unknown>);
  if (!inline) return null;

  const graphic = inline["a:graphic"] as Record<string, unknown> | undefined;
  if (!graphic) return null;

  const graphicData = graphic["a:graphicData"] as
    | Record<string, unknown>
    | undefined;
  if (!graphicData) return null;

  const pic =
    (graphicData["pic:pic"] as Record<string, unknown>) ||
    (graphicData["a:pic"] as Record<string, unknown>);
  if (!pic) return null;

  const blipFill = pic["pic:blipFill"] as Record<string, unknown> | undefined;
  if (!blipFill) return null;

  const blip = blipFill["a:blip"] as Record<string, string> | undefined;
  if (!blip) return null;

  const rId = blip["@_r:embed"] || blip["@_r:link"];
  if (!rId) return null;

  const image = imageMap.get(rId);
  if (!image) return null;

  // Try to get dimensions
  const extent = inline["wp:extent"] as Record<string, string> | undefined;
  let widthAttr = "";
  if (extent?.["@_cx"]) {
    // EMU to pixels (1 inch = 914400 EMU, 1 inch = 96 pixels)
    const widthPx = Math.round(parseInt(extent["@_cx"]) / 914400 * 96);
    if (widthPx > 0) widthAttr = ` width="${widthPx}"`;
  }

  return `<img src="data:${image.contentType};base64,${image.base64}"${widthAttr} style="max-width:100%;height:auto" />`;
}

function extractImageFromPict(
  pict: Record<string, unknown>,
  imageMap: ImageMap
): string | null {
  // Legacy VML images — look for v:imagedata
  const shape = pict["v:shape"] as Record<string, unknown> | undefined;
  if (!shape) return null;

  const imageData = shape["v:imagedata"] as
    | Record<string, string>
    | undefined;
  if (!imageData) return null;

  const rId = imageData["@_r:id"];
  if (!rId) return null;

  const image = imageMap.get(rId);
  if (!image) return null;

  return `<img src="data:${image.contentType};base64,${image.base64}" style="max-width:100%;height:auto" />`;
}

// ---- Utility ----

interface ChildNode {
  name: string;
  node: Record<string, unknown>;
}

function getChildren(parent: Record<string, unknown>): ChildNode[] {
  // Preserve document order by re-parsing from known element names
  // This is a limitation of JSON-based XML parsing, but works for DOCX
  const ordered: ChildNode[] = [];
  const seen = new Set<string>();

  for (const key of Object.keys(parent)) {
    if (key.startsWith("@_") || key === "#text") continue;

    const val = parent[key];
    if (!val) continue;

    if (Array.isArray(val)) {
      for (const item of val) {
        if (typeof item === "object" && item !== null) {
          ordered.push({ name: key, node: item as Record<string, unknown> });
        }
      }
    } else if (typeof val === "object") {
      ordered.push({ name: key, node: val as Record<string, unknown> });
    }

    seen.add(key);
  }

  return ordered;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wordColorToHex(color: string): string {
  const map: Record<string, string> = {
    yellow: "#FFFF00",
    green: "#00FF00",
    cyan: "#00FFFF",
    magenta: "#FF00FF",
    blue: "#0000FF",
    red: "#FF0000",
    darkBlue: "#000080",
    darkCyan: "#008080",
    darkGreen: "#008000",
    darkMagenta: "#800080",
    darkRed: "#800000",
    darkYellow: "#808000",
    darkGray: "#808080",
    lightGray: "#C0C0C0",
    black: "#000000",
    white: "#FFFFFF",
  };
  return map[color] || "#FFFF00";
}
