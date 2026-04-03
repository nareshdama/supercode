# Memory-Enabled Runtime Example

This tutorial shows the smallest useful memory-enabled flow.

## 1. Initialize A Project

```bash
npx @nareshdama/supercode init
supercode doctor
```

## 2. Enable Memory

Edit `.supercode/config.json` and update the `memory` block to:

```json
{
  "memory": {
    "enabled": true,
    "provider": "local",
    "attachLimit": 5
  }
}
```

## 3. Run The Same Task More Than Once

```bash
supercode run "add authentication"
supercode run "add authentication"
supercode memory list authentication
```

What to look for:

- the second run can attach memories created by the first run
- `supercode memory list authentication` shows persisted memory records for the current session
- `supercode memory show <memory-id>` can inspect a specific stored memory
