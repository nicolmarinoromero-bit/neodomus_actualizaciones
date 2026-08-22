import ast
with open("be/app/routers/tecnicos.py", "r", encoding="utf-8") as f:
    ast.parse(f.read())
print("Syntax OK")