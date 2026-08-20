import ast, sys
try:
    with open("be/app/routers/tecnicos.py", "r", encoding="utf-8") as f:
        ast.parse(f.read())
    print("OK: syntax valid")
except SyntaxError as e:
    print(f"SYNTAX ERROR: {e}")
    sys.exit(1)