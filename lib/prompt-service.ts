import { prisma } from './prisma';

export interface Prompt {
  id: string;
  key: string;
  name: string;
  description?: string;
  type: string;
  content: string;
  variables?: any;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

class PromptService {
  private promptCache: Map<string, Prompt> = new Map();
  private cacheExpiration: Map<string, number> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000;

  async getPromptByKey(key: string): Promise<Prompt | null> {
    const cached = this.promptCache.get(key);
    const expiration = this.cacheExpiration.get(key);
    
    if (cached && expiration && Date.now() < expiration) {
      return cached;
    }

    try {
      const prompt = await prisma.prompt.findUnique({
        where: { 
          key,
          isActive: true 
        }
      });

      if (prompt) {
        this.promptCache.set(key, prompt);
        this.cacheExpiration.set(key, Date.now() + this.CACHE_TTL);
        return prompt;
      }

      return null;
    } catch (error) {
      console.error(`Error fetching prompt by key ${key}:`, error);
      return null;
    }
  }

  async getAllPrompts(filters?: { type?: string; active?: boolean }): Promise<Prompt[]> {
    try {
      const where: any = {};
      if (filters?.type) where.type = filters.type;
      if (filters?.active !== undefined) where.isActive = filters.active;

      const prompts = await prisma.prompt.findMany({
        where,
        orderBy: [
          { isActive: 'desc' },
          { type: 'asc' },
          { name: 'asc' }
        ]
      });

      return prompts;
    } catch (error) {
      console.error('Error fetching all prompts:', error);
      return [];
    }
  }

  async getPromptContent(key: string): Promise<string | null> {
    const prompt = await this.getPromptByKey(key);
    return prompt?.content || null;
  }

  async getPromptVariables(key: string): Promise<any | null> {
    const prompt = await this.getPromptByKey(key);
    return prompt?.variables || null;
  }

  getSalesCoachingPrompts() {
    return {
      salesCoach: this.getPromptContent('salesCoach'),
      sentimentAnalyzer: this.getPromptContent('sentimentAnalyzer'),
      stageDetector: this.getPromptContent('stageDetector'),
      callFeedback: this.getPromptContent('callFeedback'),
    };
  }

  async getCoachingRules() {
    return await this.getPromptVariables('coachingRules');
  }

  async getPromptHelpers() {
    const helpers = await this.getPromptVariables('promptHelpers');
    if (!helpers) return null;

    const promptHelpers: any = {};
    
    if (helpers.buildCoachingContext) {
      promptHelpers.buildCoachingContext = new Function('return ' + helpers.buildCoachingContext)();
    }
    
    if (helpers.buildSentimentContext) {
      promptHelpers.buildSentimentContext = new Function('return ' + helpers.buildSentimentContext)();
    }
    
    if (helpers.buildStageContext) {
      promptHelpers.buildStageContext = new Function('return ' + helpers.buildStageContext)();
    }

    return promptHelpers;
  }

  clearCache(key?: string) {
    if (key) {
      this.promptCache.delete(key);
      this.cacheExpiration.delete(key);
    } else {
      this.promptCache.clear();
      this.cacheExpiration.clear();
    }
  }

  // Method to refresh cache for specific prompt
  async refreshPromptCache(key: string): Promise<void> {
    this.clearCache(key);
    await this.getPromptByKey(key);
  }
}

export const promptService = new PromptService(); 