import OpenAI from 'openai';
const { SALES_COACHING_PROMPTS, PROMPT_HELPERS } = require('./prompts-store');

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
      const prompt = PROMPT_HELPERS.buildCoachingContext(
        context.fullConversation || '', 
        context.analytics, 
        context.recentCustomerText || '',
        context.previousTips || []
      );
      console.log('coaching tip prompt', prompt);
      console.log('system prompt', SALES_COACHING_PROMPTS.salesCoach);

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SALES_COACHING_PROMPTS.salesCoach },
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
      const prompt = PROMPT_HELPERS.buildSentimentContext(text, speaker);
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SALES_COACHING_PROMPTS.sentimentAnalyzer },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 150, // Reduced for simpler analysis
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      console.log('sentiment analysis', content);
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
      console.log('call summary', content);
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
      // Convert legacy functions format to new tools format
      const tools = functions.map(func => ({
        type: "function",
        function: func
      }));

      // Convert legacy function_call to new tool_choice format
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

      // Create the request parameters, excluding potentially problematic options
      const requestParams: any = {
        model: "gpt-4o-mini",
        messages,
        tools,
        tool_choice,
        temperature: options.temperature || 0.7,
        max_tokens: options.max_tokens || 500,
      };

      // Only add additional options that are known to be safe for function calling
      if (options.top_p) requestParams.top_p = options.top_p;
      if (options.frequency_penalty) requestParams.frequency_penalty = options.frequency_penalty;
      if (options.presence_penalty) requestParams.presence_penalty = options.presence_penalty;

      console.log('Making OpenAI function call with params:', {
        model: requestParams.model,
        toolsCount: tools.length,
        tool_choice: tool_choice,
        messagesCount: messages.length
      });

      const response = await openai.chat.completions.create(requestParams);

      // Convert response format for backward compatibility
      const choice = response.choices[0];
      if (choice?.message?.tool_calls?.[0]) {
        const toolCall = choice.message.tool_calls[0];
        // Create legacy format for backward compatibility
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
}

export const openaiService = new EnhancedOpenAIService();