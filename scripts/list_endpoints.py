#!/usr/bin/env python3
"""Parses docs/openapi.json and outputs a formatted Markdown table of all REST endpoints."""

import json
from pathlib import Path


def main():
    root_dir = Path(__file__).resolve().parent.parent
    openapi_file = root_dir / "docs" / "openapi.json"

    if not openapi_file.exists():
        print(f"Error: {openapi_file} does not exist.")
        return

    with open(openapi_file, "r", encoding="utf-8") as f:
        schema = json.load(f)

    paths = schema.get("paths", {})

    print("| Method | Path | Summary / Operation ID | Tags |")
    print("|:---:|---|---|---|")

    method_order = ["GET", "POST", "PUT", "PATCH", "DELETE"]

    rows = []
    for path, path_item in sorted(paths.items()):
        for method, op in path_item.items():
            method_upper = method.upper()
            if method_upper not in method_order:
                continue
            summary = op.get("summary") or op.get("operationId") or ""
            tags = ", ".join(op.get("tags", []))
            rows.append((path, method_upper, summary, tags))

    # Sort rows by path, then method
    for path, method, summary, tags in sorted(rows, key=lambda x: (x[0], method_order.index(x[1]))):
        print(f"| `{method}` | `{path}` | {summary} | {tags} |")


if __name__ == "__main__":
    main()

