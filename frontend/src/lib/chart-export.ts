function resolveCssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function inlineCssVars(svgText: string): string {
  return svgText.replace(/var\((--[a-z0-9-]+)\)/gi, (_, name: string) => {
    return resolveCssVar(name, "#2dd4bf");
  });
}

/** Download the first SVG inside `container` as a PNG. */
export async function exportChartPng(container: HTMLElement, filename: string): Promise<void> {
  const svg = container.querySelector("svg");
  if (!svg) throw new Error("No chart to export");

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const box = svg.getBoundingClientRect();
  if (!clone.getAttribute("width")) clone.setAttribute("width", String(Math.round(box.width)));
  if (!clone.getAttribute("height")) clone.setAttribute("height", String(Math.round(box.height)));

  const serialized = inlineCssVars(new XMLSerializer().serializeToString(clone));
  const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  try {
    const image = await loadImage(url);
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(box.width * scale));
    canvas.height = Math.max(1, Math.round(box.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create canvas");

    ctx.fillStyle = resolveCssVar("--color-bg-surface", "#121a2e");
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    await new Promise<void>((resolve, reject) => {
      canvas.toBlob((png) => {
        if (!png) {
          reject(new Error("Could not encode PNG"));
          return;
        }
        triggerDownload(URL.createObjectURL(png), filename);
        resolve();
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not render chart image"));
    img.src = src;
  });
}

export function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export function exportCsv(filename: string, header: string[], rows: Array<Array<string | number>>) {
  const lines = [
    header.map(csvEscape).join(","),
    ...rows.map((row) => row.map((cell) => csvEscape(String(cell))).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  triggerDownload(URL.createObjectURL(blob), filename);
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
