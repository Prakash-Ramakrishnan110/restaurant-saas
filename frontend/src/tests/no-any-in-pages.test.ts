import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Strict Type Safety in Pages", () => {
  it("ensures zero instances of 'as any' in frontend/src/pages", () => {
    const pagesDir = path.resolve(__dirname, "../pages");

    function findFiles(dir: string): string[] {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      list.forEach((file) => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
          results = results.concat(findFiles(fullPath));
        } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
          results.push(fullPath);
        }
      });
      return results;
    }

    const pageFiles = findFiles(pagesDir);
    expect(pageFiles.length).toBeGreaterThan(0);

    const violations: { file: string; line: number; text: string }[] = [];

    pageFiles.forEach((filePath) => {
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");
      lines.forEach((line, idx) => {
        if (line.includes("as any")) {
          violations.push({
            file: path.relative(pagesDir, filePath),
            line: idx + 1,
            text: line.trim(),
          });
        }
      });
    });

    if (violations.length > 0) {
      console.error("Found 'as any' violations in pages:", violations);
    }

    expect(violations).toEqual([]);
  });
});
