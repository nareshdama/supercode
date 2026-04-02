# Minimal Runtime Example

Use the CLI to initialize a project and inspect the execution profile:

```bash
npx supercode init
supercode doctor
supercode run "add authentication"
```

The scaffold also writes:

- `README.md` with editor-neutral quickstart commands
- `.supercode/WORKFLOW.md` with local customization paths
- `.supercode/extensions/local/hooks.example.json`
- `.supercode/extensions/plugins/plugin.example.json`

Enable memory explicitly in `.supercode/config.json`:

```json
{
  "memory": {
    "enabled": true,
    "provider": "local",
    "attachLimit": 5
  }
}
```

Then run the same task twice and inspect stored memories:

```bash
supercode run "add authentication"
supercode run "add authentication"
supercode memory list authentication
```
