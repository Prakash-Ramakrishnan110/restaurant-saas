import json, os

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
with open(os.path.join(BASE_DIR, "docs/audit/walk/raw/walk_raw.json"), encoding="utf-8") as f:
    data = json.load(f)

for x in data:
    if x["brokenMediaCount"] > 0 or x["forbiddenWords"] or x["counterTableWords"] or x["missingTamil"] or x["axeSeriousCriticalCount"] > 0:
        if x["brokenMediaCount"] > 0 or x["forbiddenWords"] or x["counterTableWords"] or x["missingTamil"]:
            print(
                f"{x['flowId']} {x['stepId']} [{x['viewport']}] ({x['url']}) "
                f"broken={x['brokenMedia']} fw={x['forbiddenWords']} ctbl={x['counterTableWords']} ta={x['missingTamil']}"
            )
