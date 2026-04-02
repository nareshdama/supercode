# Plugin Release Workflow Example

This tutorial focuses on the local extension surface that ships with `supercode init`.

## 1. Initialize And Inspect The Project

```bash
npx supercode init
supercode extension list
supercode plugin list
```

## 2. Reconcile The Managed Workflow Baseline

```bash
supercode pack recommend --apply
supercode pack sync
supercode extension validate
```

What to look for:

- `.supercode/extensions/local/hooks.example.json` provides a copy-safe hook template
- `.supercode/extensions/plugins/plugin.example.json` provides a copy-safe plugin manifest template
- `supercode extension validate` checks local hooks and plugin manifests for invalid tool references, cycles, and command conflicts

## 3. Exercise A Simple Runtime Flow

```bash
supercode run "prepare release checklist"
supercode result list
```

This demonstrates the release-oriented workflow surface without requiring a custom plugin to be authored first.
