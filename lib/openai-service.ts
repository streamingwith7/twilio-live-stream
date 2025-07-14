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
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: SALES_COACHING_PROMPTS.callFeedback 
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

  async generateDetailedCallReport(conversationTurns: any[], tipHistory: any[]): Promise<any> {
    try {

      const turnsWithTips = this.matchTipsToTurns(conversationTurns, tipHistory);
      
      const fullConversation = conversationTurns
        .map((turn, index) => `Turn ${index + 1} - ${turn.speaker}: "${turn.text}" [${turn.timestamp}]`)
        .join('\n');

      const tipsSummary = tipHistory
        .map((tip, index) => `Tip ${index + 1}: ${tip.tip} [Generated at: ${tip.timestamp}]`)
        .join('\n');

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: `You are an expert at analyzing sales conversations and coaching effectiveness. 
            
            Your task is to:
            1. Match each tip to the conversation turn that triggered it (based on timestamps)
            2. Analyze if the agent actually USED or FOLLOWED each tip in their subsequent responses
            3. An agent can use a tip by following its guidance even if they don't use the exact words
            4. Look for evidence that the agent's behavior changed or improved after receiving a tip
            
            RESPOND WITH ONLY VALID JSON - no markdown, no code blocks.` 
          },
          { 
            role: "user", 
            content: `Analyze this sales conversation and determine tip usage:

            FULL CONVERSATION:
            ${fullConversation}

            COACHING TIPS GENERATED:
            ${tipsSummary}

            For each conversation turn, determine:
            1. If it's a customer or agent turn
            2. If a tip was generated around this turn (within 30 seconds after)
            3. If the tip was actually USED by the agent in subsequent responses (analyze agent's behavior change, not exact text match)
            4. Tip is used only by agent, but customer never use tips.
            5. So tip isUsed should be defined by agent response only.
            6. Agent can use previous tips, so you should consider it
            6. Don't change original turns, just update tip usage (isUsed field)
            7. You should generate fully completed JSON structure, not just a part of it.
            8. JSON without any other text or comments or markdown

            Return ONLY this JSON structure (no markdown, no code blocks):
            {
            "turns": [
                {
                  "customer": "customer text if this turn was from customer (omit if agent turn)",
                  "timestamp": "exact timestamp from the original turn data",
                },
                {
                  "tip": "tip content if a tip was generated for this turn",
                  "isUsed": true/false based on whether agent actually followed/used the tip,
                  "timestamp": "exact timestamp from the tip data",
                  "usedTimestamp": "exact timestamp from the agent response if tip was used, so the timestamp when agent used the tip"
                },
                {
                  "agent": "agent text if this turn was from agent (omit if customer turn)",
                  "timestamp": "exact timestamp from the original turn data",
                }
              ]
            }

            Analyze each agent response AFTER a tip was given to see if they incorporated the tip's guidance. Look for:
            - Did the agent change their approach after the tip?
            - Did they follow the suggested strategy or script direction?
            - Did their tone or messaging align with the tip's advice?

            Remember: Only include "tip" field when a tip was actually generated for that turn.`
          }
        ],
        temperature: 0.1,
        max_tokens: 2000,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return null;
      
      const result = this.parseJsonResponse(content);
      
      return result.turns || [];
    } catch (error) {
      console.error('Error generating detailed call report:', error);
      return null;
    }
  }

  private matchTipsToTurns(turns: any[], tips: any[]): any[] {
    return turns.map(turn => {
      const turnTimestamp = new Date(turn.timestamp).getTime();
      
      let matchedTip = null;
      let closestTimeDiff = Infinity;
      
      for (const tip of tips) {
        const tipTimestamp = new Date(tip.timestamp).getTime();
        const timeDiff = tipTimestamp - turnTimestamp;
        
        if (timeDiff >= 0 && timeDiff <= 30000 && timeDiff < closestTimeDiff) {
          closestTimeDiff = timeDiff;
          matchedTip = tip;
        }
      }
      
      const result: any = {};
      
      if (turn.speaker === 'customer') {
        result.customer = turn.text;
      } else {
        result.agent = turn.text;
      }
      
      if (matchedTip) {
        result.tip = {
          content: matchedTip.tip,
          isUsed: false
        };
      }
      
      return result;
    });
  }
}

export const openaiService = new EnhancedOpenAIService();