import printersMarkdown from "../../../docs/help/printers-tested.md?raw";

export interface TestedDeviceRow {
  model: string;
  date: string;
  result: string;
  testedBy: string;
}

export function parseTestedDevicesMarkdown(md: string): TestedDeviceRow[] {
  const lines = md
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith("|") && l.endsWith("|"));

  const rows: TestedDeviceRow[] = [];
  for (const line of lines) {
    const cells = line
      .slice(1, -1)
      .split("|")
      .map((c) => c.trim());
    if (cells.length < 4) continue;
    // Skip markdown header row and alignment separator row
    if (cells[0].toLowerCase() === "model" || /^:?-+:?$/.test(cells[0])) continue;
    if (!cells[0]) continue;
    rows.push({
      model: cells[0],
      date: cells[1] || "",
      result: cells[2] || "",
      testedBy: cells[3] || "",
    });
  }
  return rows;
}

export function getTestedDevices(): TestedDeviceRow[] {
  return parseTestedDevicesMarkdown(printersMarkdown);
}
