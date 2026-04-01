import type { PromptTemplate, RenderedPrompt } from "@supercode/core";

function now(): string {
  return new Date().toISOString();
}

export class PromptRegistry {
  private readonly templates = new Map<string, Map<string, PromptTemplate>>();

  register(template: PromptTemplate): void {
    let versions = this.templates.get(template.promptId);
    if (!versions) {
      versions = new Map();
      this.templates.set(template.promptId, versions);
    }
    versions.set(template.version, { ...template });
  }

  resolve(promptId: string, version?: string): PromptTemplate | undefined {
    const versions = this.templates.get(promptId);
    if (!versions || versions.size === 0) return undefined;

    if (version) {
      return versions.get(version);
    }

    // Return latest version (lexicographically highest).
    let latest: PromptTemplate | undefined;
    for (const template of versions.values()) {
      if (!latest || template.version > latest.version) {
        latest = template;
      }
    }
    return latest;
  }

  render(promptId: string, variables: Record<string, string>, version?: string): RenderedPrompt {
    const template = this.resolve(promptId, version);
    if (!template) {
      throw new Error(`Prompt "${promptId}" not found${version ? ` (version ${version})` : ""}.`);
    }

    let content = template.body;
    for (const varName of template.variables) {
      const value = variables[varName];
      if (value === undefined) {
        throw new Error(`Missing variable "${varName}" for prompt "${promptId}".`);
      }
      content = content.replaceAll(`{{${varName}}}`, value);
    }

    return {
      promptId: template.promptId,
      version: template.version,
      content,
      renderedAt: now()
    };
  }

  list(): PromptTemplate[] {
    const all: PromptTemplate[] = [];
    for (const versions of this.templates.values()) {
      for (const template of versions.values()) {
        all.push({ ...template });
      }
    }
    return all;
  }

  listVersions(promptId: string): string[] {
    const versions = this.templates.get(promptId);
    return versions ? [...versions.keys()].sort() : [];
  }

  static withBuiltins(): PromptRegistry {
    const registry = new PromptRegistry();

    registry.register({
      promptId: "supercode.system",
      version: "1.0.0",
      description: "Default Supercode system prompt for task execution.",
      body: "You are Supercode, an AI agent operating in a {{projectType}} project. Your task is: {{goal}}. Follow the execution plan and use the available tools safely.",
      variables: ["projectType", "goal"]
    });

    registry.register({
      promptId: "supercode.task-plan",
      version: "1.0.0",
      description: "Prompt for generating an execution plan from a goal.",
      body: "Given the goal \"{{goal}}\" in a {{projectType}} project with {{packageManager}} as the package manager, produce an ordered execution plan as a list of steps.",
      variables: ["goal", "projectType", "packageManager"]
    });

    registry.register({
      promptId: "supercode.review",
      version: "1.0.0",
      description: "Prompt for reviewing execution results.",
      body: "Review the following execution results for the task \"{{goal}}\":\n\n{{results}}\n\nSummarize the outcome and flag any issues.",
      variables: ["goal", "results"]
    });

    return registry;
  }
}
