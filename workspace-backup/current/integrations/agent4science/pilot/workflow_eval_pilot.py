import json
import os
import re
import shutil
import subprocess
import tempfile
import textwrap
import urllib.request
from dataclasses import dataclass
from pathlib import Path

API_KEY = os.environ.get("OPENAI_API_KEY")
API_URL = "https://api.openai.com/v1/chat/completions"
MODEL = "gpt-4.1"

TASKS = [
    {
        "name": "off_by_one_sum",
        "instruction": "Fix the implementation so sum_first_n(n) returns the sum of integers from 1 through n inclusive. Keep the API unchanged.",
        "files": {
            "app.py": "def sum_first_n(n):\n    return sum(range(n))\n",
            "test_app.py": "import unittest\nfrom app import sum_first_n\n\nclass TestApp(unittest.TestCase):\n    def test_small(self):\n        self.assertEqual(sum_first_n(1), 1)\n        self.assertEqual(sum_first_n(3), 6)\n\n    def test_zero(self):\n        self.assertEqual(sum_first_n(0), 0)\n\nif __name__ == '__main__':\n    unittest.main()\n",
        },
    },
    {
        "name": "csv_parser_whitespace",
        "instruction": "Fix parse_csv_line so it trims whitespace around values and ignores a trailing newline. Keep the API unchanged.",
        "files": {
            "app.py": "def parse_csv_line(line):\n    return line.split(',')\n",
            "test_app.py": "import unittest\nfrom app import parse_csv_line\n\nclass TestApp(unittest.TestCase):\n    def test_trim(self):\n        self.assertEqual(parse_csv_line('a, b ,c\\n'), ['a', 'b', 'c'])\n\n    def test_empty_middle(self):\n        self.assertEqual(parse_csv_line('x, ,z'), ['x', '', 'z'])\n\nif __name__ == '__main__':\n    unittest.main()\n",
        },
    },
    {
        "name": "discount_cap",
        "instruction": "Fix apply_discount so it applies the percentage discount to price but never returns a negative value. Keep the API unchanged.",
        "files": {
            "app.py": "def apply_discount(price, pct):\n    return price - pct\n",
            "test_app.py": "import unittest\nfrom app import apply_discount\n\nclass TestApp(unittest.TestCase):\n    def test_normal(self):\n        self.assertAlmostEqual(apply_discount(100, 0.2), 80.0)\n\n    def test_cap_zero(self):\n        self.assertEqual(apply_discount(10, 2.0), 0)\n\nif __name__ == '__main__':\n    unittest.main()\n",
        },
    },
    {
        "name": "dependent_update",
        "instruction": "Rename function greet_user to format_greeting and update any internal callers so the tests pass. Preserve behavior.",
        "files": {
            "app.py": "def greet_user(name):\n    return f'Hello, {name}!'\n\ndef welcome(name):\n    return greet_user(name).upper()\n",
            "test_app.py": "import unittest\nfrom app import format_greeting, welcome\n\nclass TestApp(unittest.TestCase):\n    def test_format(self):\n        self.assertEqual(format_greeting('Luc'), 'Hello, Luc!')\n\n    def test_welcome(self):\n        self.assertEqual(welcome('Luc'), 'HELLO, LUC!')\n\nif __name__ == '__main__':\n    unittest.main()\n",
        },
    },
]

SYSTEM_PROMPT = "You are a careful software maintenance agent. Return only valid JSON."

DIRECT_PROMPT = """
You are given a tiny Python repository.
Task: {instruction}

Files:
{files}

Return JSON with exactly this schema:
{{
  "files": {{"path": "full new file content"}},
  "notes": "brief rationale"
}}

Only include files that changed.
"""

PLAN_PROMPT = """
You are given a tiny Python repository.
Task: {instruction}

Files:
{files}

First, produce a concise repair plan as JSON with this schema:
{{
  "files_to_edit": ["..."],
  "failure_mode": "what is broken",
  "repair_steps": ["..."],
  "validation": ["..."]
}}
Return only JSON.
"""

EDIT_FROM_PLAN_PROMPT = """
You are given a tiny Python repository.
Task: {instruction}

Files:
{files}

Approved plan:
{plan}

Now implement the fix.
Return JSON with exactly this schema:
{{
  "files": {{"path": "full new file content"}},
  "notes": "brief rationale",
  "self_check": ["short checklist items"]
}}

Only include files that changed.
"""

@dataclass
class RunResult:
    workflow: str
    task: str
    passed: bool
    returncode: int
    output: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    changed_files: list
    notes: str
    plan_present: bool
    self_check_present: bool


def pretty_files(files):
    parts = []
    for path, content in files.items():
        parts.append(f"--- {path} ---\n{content}")
    return "\n".join(parts)


def chat_json(user_prompt):
    payload = {
        "model": MODEL,
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": 2000,
    }
    req = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    content = data["choices"][0]["message"]["content"]
    usage = data.get("usage", {})
    parsed = json.loads(content)
    return parsed, usage


def apply_and_test(task, changed_files):
    with tempfile.TemporaryDirectory() as td:
        root = Path(td)
        for path, content in task["files"].items():
            (root / path).write_text(content)
        for path, content in changed_files.items():
            (root / path).write_text(content)
        proc = subprocess.run(
            ["python3", "-m", "unittest", "-q"],
            cwd=root,
            capture_output=True,
            text=True,
            timeout=30,
        )
        return proc.returncode == 0, proc.returncode, (proc.stdout + proc.stderr).strip()


def run_direct(task):
    result, usage = chat_json(DIRECT_PROMPT.format(instruction=task["instruction"], files=pretty_files(task["files"])))
    changed = result.get("files", {})
    passed, code, output = apply_and_test(task, changed)
    return RunResult(
        workflow="direct",
        task=task["name"],
        passed=passed,
        returncode=code,
        output=output,
        prompt_tokens=usage.get("prompt_tokens", 0),
        completion_tokens=usage.get("completion_tokens", 0),
        total_tokens=usage.get("total_tokens", 0),
        changed_files=sorted(changed.keys()),
        notes=result.get("notes", ""),
        plan_present=False,
        self_check_present=bool(result.get("self_check")),
    )


def run_plan_then_edit(task):
    plan, usage1 = chat_json(PLAN_PROMPT.format(instruction=task["instruction"], files=pretty_files(task["files"])))
    edit, usage2 = chat_json(EDIT_FROM_PLAN_PROMPT.format(
        instruction=task["instruction"],
        files=pretty_files(task["files"]),
        plan=json.dumps(plan, ensure_ascii=False, indent=2),
    ))
    changed = edit.get("files", {})
    passed, code, output = apply_and_test(task, changed)
    return RunResult(
        workflow="plan_then_edit",
        task=task["name"],
        passed=passed,
        returncode=code,
        output=output,
        prompt_tokens=usage1.get("prompt_tokens", 0) + usage2.get("prompt_tokens", 0),
        completion_tokens=usage1.get("completion_tokens", 0) + usage2.get("completion_tokens", 0),
        total_tokens=usage1.get("total_tokens", 0) + usage2.get("total_tokens", 0),
        changed_files=sorted(changed.keys()),
        notes=edit.get("notes", ""),
        plan_present=True,
        self_check_present=bool(edit.get("self_check")),
    )


def main():
    if not API_KEY:
        raise SystemExit("OPENAI_API_KEY is required")
    results = []
    for task in TASKS:
        results.append(run_direct(task))
        results.append(run_plan_then_edit(task))
    out = []
    for r in results:
        out.append({
            "workflow": r.workflow,
            "task": r.task,
            "passed": r.passed,
            "returncode": r.returncode,
            "output": r.output,
            "prompt_tokens": r.prompt_tokens,
            "completion_tokens": r.completion_tokens,
            "total_tokens": r.total_tokens,
            "changed_files": r.changed_files,
            "notes": r.notes,
            "plan_present": r.plan_present,
            "self_check_present": r.self_check_present,
        })
    print(json.dumps(out, indent=2))

if __name__ == "__main__":
    main()
