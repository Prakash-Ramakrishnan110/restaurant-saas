import json, os

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
with open(os.path.join(BASE_DIR, "docs/audit/walk/raw/walk_raw.json"), encoding="utf-8") as f:
    walk = json.load(f)
with open(os.path.join(BASE_DIR, "docs/audit/walk/raw/flow_timings.json"), encoding="utf-8") as f:
    timings = json.load(f)
with open(os.path.join(BASE_DIR, "docs/audit/walk/raw/route_probe_raw.json"), encoding="utf-8") as f:
    probe = json.load(f)

print("=== FLOW TIMINGS ===")
for t in timings:
    print(f"{t['flowId']} [{t['viewport']}]: taps={t['taps']} durationMs={t['durationMs']}")

print("\n=== STEPS WITH AXE CRITICAL / SKELETON / SMALL TEXT / ORANGE / CONTRAST ===")
for x in walk:
    crits = [v for v in x["axeViolations"] if v["impact"] == "critical"]
    if crits or x["skeletonStillVisibleAfter10s"] or x["brokenMediaCount"] > 0 or x["counterTableWords"] or x["httpErrors"]:
        print(
            f"{x['flowId']} {x['stepId']} [{x['viewport']}] status={x['status']} url={x['url']} "
            f"skel10s={x['skeletonStillVisibleAfter10s']} broken={x['brokenMediaCount']} "
            f"crits={[c['id']+':'+str(c['nodesCount']) for c in crits]} http={x['httpErrors']}"
        )

print("\n=== ROUTES OPEN BY URL FOR ROLES WITHOUT SIDEBAR OR UNAUTHORIZED ISSUES ===")
for r, info in sorted(probe.items()):
    if any("403" in u for u in info["unauthorized_behaviors"]) or "PUBLIC" in info["allowed_roles"] or len(info["allowed_roles"]) >= 5:
        print(f"{r}: allowed={info['allowed_roles']} unauth={info['unauthorized_behaviors']}")
