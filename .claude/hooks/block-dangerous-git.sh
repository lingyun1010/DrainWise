#!/bin/bash

INPUT=$(cat)
# python3 instead of jq (jq is not installed here). Fail closed if the input cannot be parsed.
COMMAND=$(echo "$INPUT" | python3 -c 'import sys, json; print(json.load(sys.stdin)["tool_input"]["command"])' 2>/dev/null)
if [ $? -ne 0 ]; then
  echo "BLOCKED: could not parse the hook input, refusing to run the command." >&2
  exit 2
fi

DANGEROUS_PATTERNS=(
  "git push"
  "git reset --hard"
  "git clean -fd"
  "git clean -f"
  "git branch -D"
  "git checkout \."
  "git restore \."
  "push --force"
  "reset --hard"
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qE "$pattern"; then
    echo "BLOCKED: '$COMMAND' matches dangerous pattern '$pattern'. The user has prevented you from doing this." >&2
    exit 2
  fi
done

exit 0
