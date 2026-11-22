"""Summarize walk_raw.json into rule-violations breakdown & flow stats."""
import json
import os
from collections import Counter

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
RAW_PATH = os.path.join(BASE_DIR, "docs/audit/walk/raw/walk_raw.json")
OUT_STATS = os.path.join(BASE_DIR, "docs/audit/walk/raw/walk_stats.json")

with open(RAW_PATH, encoding="utf-8") as f:
    data = json.load(f)

summary = {
    "total_steps": len(data),
    "pass_count": sum(1 for x in data if x["status"] == "PASS"),
    "fail_count": sum(1 for x in data if x["status"] == "FAIL"),
    "blocked_count": sum(1 for x in data if x["status"] == "BLOCKED"),
    "steps_with_http_errors": sum(1 for x in data if x["httpErrors"]),
    "steps_with_console_errors": sum(1 for x in data if x["consoleErrors"]),
    "steps_with_page_errors": sum(1 for x in data if x["pageErrors"]),
    "horizontal_scroll_screens": sum(1 for x in data if x["horizontalScroll"]),
    "small_tap_target_screens": sum(1 for x in data if x["smallTapTargetsCount"] > 0),
    "small_tap_target_total_elements": sum(x["smallTapTargetsCount"] for x in data),
    "small_text_screens": sum(1 for x in data if x["smallTextCount"] > 0),
    "small_text_total_elements": sum(x["smallTextCount"] for x in data),
    "axe_violation_screens": sum(1 for x in data if x["axeSeriousCriticalCount"] > 0),
    "low_contrast_screens": sum(1 for x in data if x["lowContrastCount"] > 0),
    "orange_text_screens": sum(1 for x in data if x["orangeTextCount"] > 0),
    "white_on_orange_screens": sum(1 for x in data if x["whiteOnOrangeCount"] > 0),
    "broken_media_screens": sum(1 for x in data if x["brokenMediaCount"] > 0),
    "skeleton_10s_screens": sum(1 for x in data if x["skeletonStillVisibleAfter10s"]),
    "zeros_after_failed_req_screens": sum(1 for x in data if x["zerosAfterFailedRequest"]),
    "forbidden_word_screens": sum(1 for x in data if x["forbiddenWords"]),
    "counter_table_word_screens": sum(1 for x in data if x["counterTableWords"]),
    "missing_tamil_screens": sum(1 for x in data if x["missingTamil"]),
    "non_pass_steps": [],
    "forbidden_words_histogram": {},
    "axe_rules_histogram": {},
    "http_errors_list": [],
}

fw_hist = Counter()
axe_hist = Counter()
for x in data:
    for w in x["forbiddenWords"]:
        fw_hist[w.lower()] += 1
    for av in x["axeViolations"]:
        axe_hist[f"{av['id']} ({av['impact']})"] += 1
    for he in x["httpErrors"]:
        summary["http_errors_list"].append(
            {
                "flow": x["flowId"],
                "step": x["stepId"],
                "viewport": x["viewport"],
                "role": x["role"],
                "url_page": x["url"],
                **he,
            }
        )
    if x["status"] != "PASS" or x["httpErrors"] or x["pageErrors"]:
        summary["non_pass_steps"].append(
            {
                "flow": x["flowId"],
                "step": x["stepId"],
                "role": x["role"],
                "viewport": x["viewport"],
                "status": x["status"],
                "note": x["note"],
                "url": x["url"],
                "httpErrors": x["httpErrors"],
                "consoleErrors": x["consoleErrors"],
                "pageErrors": x["pageErrors"],
                "shotPath": x["shotPath"],
            }
        )

summary["forbidden_words_histogram"] = dict(fw_hist.most_common())
summary["axe_rules_histogram"] = dict(axe_hist.most_common())

with open(OUT_STATS, "w", encoding="utf-8") as f:
    json.dump(summary, f, indent=2)

print(json.dumps({k: v for k, v in summary.items() if k not in ("non_pass_steps", "http_errors_list")}, indent=2))
print("\n--- NON-PASS OR HTTP ERROR STEPS ---")
for item in summary["non_pass_steps"]:
    print(f"{item['flow']} {item['step']} [{item['viewport']}] ({item['role']}): {item['status']} | {item['note']} | HTTP={item['httpErrors']}")
