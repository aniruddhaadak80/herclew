import os

src_dir = r"C:\Users\ANIRUDDHA\.gemini\antigravity\scratch\herclew\gateway-node\src"
keyword = "cliBackends"

results = []
for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith((".ts", ".js", ".json")):
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()
                    if keyword in content:
                        results.append(path)
            except Exception as e:
                pass

print("Found files:")
for r in results:
    print(r)
