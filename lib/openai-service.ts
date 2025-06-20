import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface CoachingTip {
  id: string;
  type: 'suggestion' | 'warning' | 'opportunity' | 'next_step';
  message: string;
  priority: 'low' | 'medium' | 'high';
  timestamp: string;
  context?: string;
}

export interface ConversationContext {
  agentText: string;
  customerText: string;
  conversationHistory: string[];
  callSid: string;
  timestamp: string;
}

const SALES_COACHING_PROMPT = `You are an expert sales coach providing real-time guidance to sales representatives during customer calls. 

Your role is to:
1. Analyze the conversation in real-time
2. Provide concise, actionable tips (max 15 words)
3. Help the agent close more deals and set appointments
4. Identify opportunities, objections, and next steps

Conversation context:
- Agent is the sales person trying to close deals/set appointments
- Customer is the prospect being contacted
- Provide tips that are immediately actionable
- Be encouraging and solution-focused

Types of tips to provide:
- "suggestion": Positive advice on what to say or do next
- "warning": Alert about potential issues or things to avoid
- "opportunity": Highlight chances to close or advance the sale
- "next_step": Clear direction on how to proceed

Respond with a JSON object containing:
{
  "type": "suggestion|warning|opportunity|next_step",
  "message": "Brief, actionable tip (max 15 words)",
  "priority": "low|medium|high",
  "context": "Brief explanation if needed"
}

Only provide tips when there's a clear, actionable insight. Don't provide generic advice.`;

export class OpenAIService {
  private conversationHistory: Map<string, string[]> = new Map();

  async generateCoachingTip(context: ConversationContext): Promise<CoachingTip | null> {
    try {
      // Update conversation history
      const history = this.conversationHistory.get(context.callSid) || [];
      
      // Add the latest exchanges to history
      if (context.agentText) {
        history.push(`Agent: ${context.agentText}`);
      }
      if (context.customerText) {
        history.push(`Customer: ${context.customerText}`);
      }
      
      // Keep only last 10 exchanges to manage token usage
      const recentHistory = history.slice(-10);
      this.conversationHistory.set(context.callSid, recentHistory);

      // Only generate tips if we have meaningful conversation
      if (recentHistory.length < 2) {
        return null;
      }

      const conversationText = recentHistory.join('\n');

      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: SALES_COACHING_PROMPT
          },
          {
            role: 'user',
            content: `Recent conversation:\n${conversationText}\n\nProvide a coaching tip based on this exchange.`
          }
        ],
        max_tokens: 100,
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return null;
      }

      // Parse the JSON response
      const tipData = JSON.parse(content);
      
      return {
        id: `tip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: tipData.type || 'suggestion',
        message: tipData.message,
        priority: tipData.priority || 'medium',
        timestamp: new Date().toISOString(),
        context: tipData.context
      };

    } catch (error) {
      console.error('Error generating coaching tip:', error);
      return null;
    }
  }

  async analyzeCustomerSentiment(customerText: string): Promise<{
    sentiment: 'positive' | 'neutral' | 'negative';
    confidence: number;
    indicators: string[];
  } | null> {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `Analyze the customer's sentiment from their speech. Respond with JSON:
            {
              "sentiment": "positive|neutral|negative",
              "confidence": 0.0-1.0,
              "indicators": ["specific words or phrases that indicate sentiment"]
            }`
          },
          {
            role: 'user',
            content: `Customer said: "${customerText}"`
          }
        ],
        max_tokens: 150,
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return null;
      }

      return JSON.parse(content);
    } catch (error) {
      console.error('Error analyzing sentiment:', error);
      return null;
    }
  }

  // Clean up conversation history when call ends
  clearConversationHistory(callSid: string): void {
    this.conversationHistory.delete(callSid);
  }

  // Get conversation summary for the call
  async getConversationSummary(callSid: string): Promise<string | null> {
    try {
      const history = this.conversationHistory.get(callSid);
      if (!history || history.length === 0) {
        return null;
      }

      const conversationText = history.join('\n');

      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Summarize this sales conversation highlighting key points, objections, and outcomes. Keep it concise (max 100 words).'
          },
          {
            role: 'user',
            content: conversationText
          }
        ],
        max_tokens: 150,
        temperature: 0.5,
      });

      return response.choices[0]?.message?.content || null;
    } catch (error) {
      console.error('Error generating conversation summary:', error);
      return null;
    }
  }
}

export const openaiService = new OpenAIService(); 