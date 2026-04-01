import type {
  ModelDescriptor,
  ModelInvocationRequest,
  ModelInvocationResult,
  ModelProviderAdapter,
  ProviderHealth
} from "@supercode/core";
import { OpenAIProvider } from "./openai-provider.js";
import { AnthropicProvider } from "./anthropic-provider.js";

export interface ModelCatalogOptions {
  env?: Record<string, string | undefined>;
}

export class ModelCatalog {
  private readonly providers = new Map<string, ModelProviderAdapter>();

  registerProvider(provider: ModelProviderAdapter): void {
    this.providers.set(provider.providerId, provider);
  }

  getProvider(providerId: string): ModelProviderAdapter | undefined {
    return this.providers.get(providerId);
  }

  listProviders(): ModelProviderAdapter[] {
    return [...this.providers.values()];
  }

  listModels(): ModelDescriptor[] {
    const models: ModelDescriptor[] = [];
    for (const provider of this.providers.values()) {
      models.push(...provider.listModels());
    }
    return models;
  }

  getModel(modelId: string): ModelDescriptor | undefined {
    for (const provider of this.providers.values()) {
      const match = provider.listModels().find(m => m.modelId === modelId);
      if (match) return match;
    }
    return undefined;
  }

  findByFamily(family: string): ModelDescriptor[] {
    return this.listModels().filter(m => m.family === family);
  }

  getHealth(): ProviderHealth[] {
    return [...this.providers.values()].map(p => p.getHealth());
  }

  async invoke(providerId: string, request: ModelInvocationRequest): Promise<ModelInvocationResult> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider "${providerId}" is not registered.`);
    }
    return provider.invoke(request);
  }

  static autoDiscover(options?: ModelCatalogOptions): ModelCatalog {
    const env = options?.env ?? process.env;
    const catalog = new ModelCatalog();

    const openaiKey = env.OPENAI_API_KEY;
    if (openaiKey) {
      catalog.registerProvider(
        new OpenAIProvider({
          apiKey: openaiKey,
          baseUrl: env.OPENAI_BASE_URL,
          defaultModel: env.OPENAI_MODEL
        })
      );
    }

    const anthropicKey = env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      catalog.registerProvider(
        new AnthropicProvider({
          apiKey: anthropicKey,
          defaultModel: env.ANTHROPIC_MODEL
        })
      );
    }

    return catalog;
  }
}
