import OpenAI from 'openai';
import { promptService } from './prompt-service';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ConversationContext {
  agentText?: string;
  customerText?: string;
  conversationHistory?: any[];
  fullConversation?: string;
  recentCustomerText?: string;
  previousTips?: any[];
  callSid: string;
  timestamp: string;
  analytics?: any;
  customerProfile?: any;
}

class EnhancedOpenAIService {
  private cachedPrompts: {
    salesCoach?: string;
    sentimentAnalyzer?: string;
    stageDetector?: string;
    callFeedback?: string;
    promptHelpers?: any;
    coachingRules?: any;
  } = {};
  
  private promptsLoaded: boolean = false;

  async initializePrompts(): Promise<void> {
    try {
      const [
        salesCoachPrompt,
        sentimentPrompt,
        stageDetectorPrompt,
        feedbackPrompt,
        promptHelpers,
        coachingRules
      ] = await Promise.all([
        promptService.getPromptContent('salesCoach'),
        promptService.getPromptContent('sentimentAnalyzer'),
        promptService.getPromptContent('stageDetector'),
        promptService.getPromptContent('callFeedback'),
        promptService.getPromptHelpers(),
        promptService.getCoachingRules()
      ]);

      this.cachedPrompts = {
        salesCoach: salesCoachPrompt || undefined,
        sentimentAnalyzer: sentimentPrompt || undefined,
        stageDetector: stageDetectorPrompt || undefined,
        callFeedback: feedbackPrompt || undefined,
        promptHelpers,
        coachingRules
      };

      this.promptsLoaded = true;
      console.log('Prompts successfully cached for this transcription session');
    } catch (error) {
      console.error('Error initializing prompts:', error);
      // Fallback to fetching on-demand if initialization fails
      this.promptsLoaded = false;
    }
  }

  // Get cached prompts or fetch on-demand as fallback
  private async getPrompts() {
    if (!this.promptsLoaded) {
      console.warn('Prompts not preloaded, fetching on-demand');
      await this.initializePrompts();
    }
    return this.cachedPrompts;
  }

  // Clear cached prompts to free memory after call ends
  clearCachedPrompts(): void {
    this.cachedPrompts = {};
    this.promptsLoaded = false;
    console.log('🗑️ Cleared cached prompts from memory');
  }

  // Force refresh of cached prompts (useful when prompts are updated in database)
  async refreshPrompts(): Promise<void> {
    console.log('🔄 Refreshing cached prompts...');
    this.clearCachedPrompts();
    await this.initializePrompts();
  }

  // Check if prompts are currently loaded
  arePromptsLoaded(): boolean {
    return this.promptsLoaded;
  }

  private parseJsonResponse(content: string): any {
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    try {
      return JSON.parse(content);
    } catch (error) {
      console.error('JSON parsing failed. Raw content:', content);
      console.error('Cleaned content:', content);
      throw new Error(`Failed to parse JSON response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateCoachingTip(context: ConversationContext): Promise<any> {
    try {
      const prompts = await this.getPrompts();

      if (!prompts.promptHelpers || !prompts.salesCoach) {
        throw new Error('Required prompts not found in cache');
      }

      const prompt = prompts.promptHelpers.buildCoachingContext(
        context.fullConversation || '', 
        context.analytics, 
        context.recentCustomerText || '',
        context.previousTips || []
      );

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: prompts.salesCoach },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;

      if (!content) throw new Error('No response from OpenAI');
      return this.parseJsonResponse(content);
    } catch (error) {
      console.error('Error generating coaching tip:', error);
      throw error;
    }
  }

  async analyzeSentiment(text: string, speaker: 'agent' | 'customer'): Promise<any> {
    try {
      const prompts = await this.getPrompts();

      if (!prompts.promptHelpers || !prompts.sentimentAnalyzer) {
        console.error('Required prompts not found in cache');
        return null;
      }

      const prompt = prompts.promptHelpers.buildSentimentContext(text, speaker);
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: prompts.sentimentAnalyzer },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 150,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      return content ? this.parseJsonResponse(content) : null;
    } catch (error) {
      console.error('Error analyzing sentiment:', error);
      return null;
    }
  }

  async analyzePerformance(conversationTurns: any[], analytics: any): Promise<any> {
    try {
      const conversationText = conversationTurns
        .slice(-10)
        .map(turn => `${turn.speaker}: "${turn.text}"`)
        .join('\n');

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a sales performance analyst. Provide brief analysis in JSON format." },
          { 
            role: "user", 
            content: `Analyze this sales conversation performance:

            CONVERSATION EXCERPT:
            ${conversationText}

            CURRENT ANALYTICS:
            - Stage: ${analytics.conversationStage}
            - Customer Sentiment: ${analytics.customerSentiment}
            - Talk Ratio: Agent ${analytics.talkRatio?.agent?.toFixed(1)}%, Customer ${analytics.talkRatio?.customer?.toFixed(1)}%

            Provide ONLY this JSON (no markdown, no code blocks):
            {
            "overallScore": 75,
            "strengths": ["what agent is doing well"],
            "improvements": ["specific areas to improve"],
            "riskFactors": ["conversation risks"],
            "opportunities": ["missed or potential opportunities"],
            "nextBestActions": ["immediate recommended actions"],
            "strategicAdvice": "high-level guidance for this conversation",
            "reasoning": "detailed explanation of assessment"
            }`
          }
        ],
        temperature: 0.4,
        max_tokens: 600,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      console.log('performance analysis', content);
      return content ? this.parseJsonResponse(content) : null;
    } catch (error) {
      console.error('Error analyzing performance:', error);
      return null;
    }
  }

  async generateCallSummary(conversationTurns: any[], analytics: any): Promise<any> {
    try {
      const fullConversation = conversationTurns
        .map(turn => `${turn.speaker}: "${turn.text}"`)
        .join('\n');

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: "You are an expert sales call analyst. Create comprehensive, actionable call summaries. RESPOND WITH ONLY VALID JSON - no markdown, no code blocks." 
          },
          { 
            role: "user", 
            content: `Analyze this complete sales conversation and provide a comprehensive summary:

FULL CONVERSATION:
${fullConversation}

FINAL ANALYTICS:
${JSON.stringify(analytics, null, 2)}

Provide ONLY this JSON structure (no markdown, no code blocks):
{
  "outcome": "advancing",
  "keyMoments": ["important conversation highlights"],
  "customerProfile": {
    "painPoints": ["identified pain points"],
    "motivations": ["what drives customer"],
    "objections": ["concerns raised"],
    "buyingSignals": ["positive indicators"]
  },
  "agentPerformance": {
    "score": 75,
    "strengths": ["what worked well"],
    "improvements": ["specific areas to improve"],
    "missedOpportunities": ["what could have been better"]
  },
  "actionItems": ["specific follow up actions"],
  "nextCallStrategy": "recommended approach for next interaction",
  "coachingFocus": ["areas for agent development"],
  "dealProbability": 75,
  "reasoning": "detailed explanation of assessment"
}`
          }
        ],
        temperature: 0.5,
        max_tokens: 1000,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      return content ? this.parseJsonResponse(content) : null;
    } catch (error) {
      console.error('Error generating call summary:', error);
      return null;
    }
  }

  async chat(messages: any[], options: any = {}): Promise<string> {
    try {
      const response = await openai.chat.completions.create({
        model: options.model || "gpt-4o",
        messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.max_tokens || 500,
        ...options
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('Error in chat completion:', error);
      throw error;
    }
  }

  async chatWithFunctions(messages: any[], functions: any[], options: any = {}): Promise<any> {
    try {
      const tools = functions.map(func => ({
        type: "function",
        function: func
      }));

      let tool_choice: any = "auto";
      if (options.function_call) {
        if (typeof options.function_call === "string" && options.function_call === "auto") {
          tool_choice = "auto";
        } else if (typeof options.function_call === "object" && options.function_call.name) {
          tool_choice = {
            type: "function",
            function: { name: options.function_call.name }
          };
        }
      }

      const requestParams: any = {
        model: "gpt-4o-mini",
        messages,
        tools,
        tool_choice,
        temperature: options.temperature || 0.7,
        max_tokens: options.max_tokens || 500,
      };

      if (options.top_p) requestParams.top_p = options.top_p;
      if (options.frequency_penalty) requestParams.frequency_penalty = options.frequency_penalty;
      if (options.presence_penalty) requestParams.presence_penalty = options.presence_penalty;

      const response = await openai.chat.completions.create(requestParams);

      const choice = response.choices[0];
      if (choice?.message?.tool_calls?.[0]) {
        const toolCall = choice.message.tool_calls[0];
        choice.message.function_call = {
          name: toolCall.function.name,
          arguments: toolCall.function.arguments
        };
      }

      return response;
    } catch (error) {
      console.error('Error in function calling chat completion:', error);
      console.error('Error details:', error);
      throw error;
    }
  }

  async generateCallFeedback(context: {
    conversationHistory: any[];
    fullConversation: string;
    analytics: any;
    tipHistory: any[];
  }): Promise<any> {
    try {
      const { conversationHistory, fullConversation, analytics, tipHistory } = context;
      
      const prompts = await this.getPrompts();
      
      if (!prompts.callFeedback) {
        throw new Error('Call feedback prompt not found in cache');
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: prompts.callFeedback 
          },
          { 
            role: "user", 
            content: `Analyze this complete sales conversation and provide comprehensive call feedback:

            FULL CONVERSATION:
            ${fullConversation}

            CONVERSATION ANALYTICS:
            ${JSON.stringify(analytics, null, 2)}

            COACHING TIPS GIVEN:
            ${tipHistory.map((tip, index) => `Tip ${index + 1}: ${tip.tip} [${tip.urgency}] - ${tip.reasoning}`).join('\n')}

            CONVERSATION SUMMARY:
            - Total Turns: ${conversationHistory.length}
            - Agent Turns: ${conversationHistory.filter(t => t.speaker === 'agent').length}
            - Customer Turns: ${conversationHistory.filter(t => t.speaker === 'customer').length}
            - Call Duration: ${Math.round((analytics?.conversationSummary?.duration || 0) / 60000)} minutes
            - Tips Generated: ${tipHistory.length}
            - Tips Used: ${tipHistory.filter(tip => tip.isUsed).length}

            Provide comprehensive call feedback following the exact JSON format specified in the system prompt.`
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return null;
      
      return this.parseJsonResponse(content);
    } catch (error) {
      console.error('Error generating call feedback:', error);
      return null;
    }
  }

  async analyzeTipUsage(conversationTurns: any[], tipHistory: any[]): Promise<any[]> {
    try {
      if (!tipHistory || tipHistory.length === 0) {
        return [];
      }

      const agentTurns = conversationTurns
        .filter(turn => turn.speaker === 'agent')
        .map(turn => `${turn.timestamp}: "${turn.text}"`);

      const prompt = `Analyze the following agent conversation turns and determine which of the provided coaching tips were actually used or implemented by the agent.

AGENT CONVERSATION TURNS:
${agentTurns.join('\n')}

COACHING TIPS PROVIDED:
${tipHistory.map((tip, index) => `
Tip ${index + 1}:
- ID: ${tip.id}
- Suggestion: ${tip.tip}
- Suggested Script: ${tip.suggestedScript}
- Timestamp: ${tip.timestamp}
`).join('\n')}

For each tip, determine if the agent used or implemented the suggestion based on:
1. Similar phrasing or concepts in agent responses
2. Following the suggested script (even if not word-for-word)
3. Implementing the strategic advice in subsequent turns
4. Addressing the specific concern mentioned in the tip

Provide ONLY this JSON format (no markdown, no code blocks):
{
  "analyzedTips": [
    {
      "id": "tip_id_here",
      "isUsed": true/false,
      "matchingTurns": ["relevant agent responses that show usage"],
    }
  ]
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: "You are an expert conversation analyst. Analyze coaching tip usage with high accuracy." 
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1500,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return tipHistory;

      const analysis = this.parseJsonResponse(content);
      
      return tipHistory.map(tip => {
        const analyzedTip = analysis.analyzedTips?.find((a: any) => a.id === tip.id);
        return {
          ...tip,
          isUsed: analyzedTip?.isUsed || false,
          matchingTurns: analyzedTip?.matchingTurns || []
        };
      });
    } catch (error) {
      console.error('Error analyzing tip usage:', error);
      return tipHistory.map(tip => ({
        ...tip,
        isUsed: false,
        usageConfidence: 0,
        matchingTurns: []
      }));
    }
  }

  async analyzeChunkedTipUsage(conversationTurns: any[], tipHistory: any[], chunkSizeMinutes: number = 5): Promise<any[]> {
    try {
      if (!conversationTurns || conversationTurns.length === 0 || !tipHistory || tipHistory.length === 0) {
        return tipHistory.map(tip => ({
          ...tip,
          isUsed: false,
          usageConfidence: 0,
          matchingTurns: []
        }));
      }

      const chunkSizeMs = chunkSizeMinutes * 60 * 1000;
      
      const firstTurnTime = new Date(conversationTurns[0].timestamp).getTime();
      
      const chunks: any[][] = [];
      
      for (const turn of conversationTurns) {
        const turnTime = new Date(turn.timestamp).getTime();
        const timeSinceStart = turnTime - firstTurnTime;
        const chunkIndex = Math.floor(timeSinceStart / chunkSizeMs);
        
        while (chunks.length <= chunkIndex) {
          chunks.push([] as any[]);
        }
        
        chunks[chunkIndex].push(turn);
      }

      let updatedTips = tipHistory.map(tip => ({
        ...tip,
        isUsed: false,
        usageConfidence: 0,
        matchingTurns: []
      }));

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (chunk.length === 0) continue;

        console.log(`Analyzing chunk ${i + 1}/${chunks.length} (${chunk.length} turns)`);
        
        const chunkStartTime = new Date(chunk[0].timestamp).getTime();
        const chunkEndTime = new Date(chunk[chunk.length - 1].timestamp).getTime(); 
        
        const relevantTips = updatedTips.filter(tip => {
          const tipTime = new Date(tip.timestamp).getTime();
          return tipTime >= chunkStartTime - 30000 && tipTime <= chunkEndTime + 30000;
        });

        if (relevantTips.length > 0) {
          const chunkAnalysis = await this.analyzeTipUsage(chunk, relevantTips);
          
          chunkAnalysis.forEach(analyzedTip => {
            const tipIndex = updatedTips.findIndex(t => t.id === analyzedTip.id);
            if (tipIndex !== -1) {
              updatedTips[tipIndex] = {
                ...updatedTips[tipIndex],
                isUsed: analyzedTip.isUsed || updatedTips[tipIndex].isUsed,
                matchingTurns: [...(updatedTips[tipIndex].matchingTurns || []), ...(analyzedTip.matchingTurns || [])]
              };
            }
          });
        }
      }

      return updatedTips;
    } catch (error) {
      console.error('Error in chunked tip usage analysis:', error);
      return tipHistory.map(tip => ({
        ...tip,
        isUsed: false,
        matchingTurns: []
      }));
    }
  }
}

export const openaiService = new EnhancedOpenAIService();