import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ConversationContext {
  agentText: string;
  customerText: string;
  conversationHistory?: any[];
  callSid: string;
  timestamp: string;
  analytics?: any;
  customerProfile?: any;
}

class EnhancedOpenAIService {
  private systemPrompts = {
    salesCoach: `You are an expert AI sales coach with 20+ years of experience in high-performance sales training. Your role is to provide real-time, actionable coaching during live sales calls.

CORE PRINCIPLES:
- Be specific and immediately actionable
- Focus on the next best action, not general advice
- Consider the conversation stage and customer psychology
- Provide responses that increase close probability
- Address risk factors before they become objections
- Capitalize on buying signals and opportunities

RESPONSE GUIDELINES:
- Tips should be 50-100 words maximum
- Include specific language when helpful
- Consider timing and customer state
- Prioritize based on impact and urgency
- Always include reasoning for your advice

CONVERSATION STAGES:
- Opening: Build rapport, establish credibility
- Discovery: Uncover needs, pain points, decision criteria
- Presentation: Present solutions aligned to needs
- Objection Handling: Address concerns, provide reassurance
- Closing: Create urgency, ask for commitment

CUSTOMER PSYCHOLOGY INDICATORS:
- Positive: Engaged questions, "tell me more", agreement
- Negative: Short responses, skepticism, price focus
- Neutral: Fact-gathering, comparison shopping

CRITICAL: You must respond with ONLY valid JSON. Do not use markdown formatting, code blocks, or any other text. Only pure JSON.`,

    sentimentAnalyzer: `You are an expert in conversation sentiment analysis and customer psychology. Analyze the emotional state and intent behind customer communications.

SENTIMENT CATEGORIES:
- Positive: Interested, engaged, excited, ready to buy
- Negative: Frustrated, skeptical, resistant, concerned
- Neutral: Information-gathering, comparison, undecided

INTENT CATEGORIES:
- price_inquiry: Asking about cost, pricing, budget
- information_seeking: Wanting details, features, benefits
- objection: Expressing concerns or resistance
- comparison: Evaluating against alternatives
- closing_signals: Ready to move forward
- stalling: Delaying decision, need to think

CRITICAL: Respond with ONLY valid JSON. No markdown, no code blocks, no additional text.`,

    performanceAnalyzer: `You are a sales performance analyst. Evaluate agent behavior and conversation flow to identify improvement opportunities.

EVALUATION CRITERIA:
- Question quality and discovery effectiveness
- Listening and response alignment
- Objection handling technique
- Closing attempt timing and approach
- Rapport building and relationship management
- Product knowledge demonstration

PERFORMANCE INDICATORS:
- Talk ratio (optimal: 30-40% agent, 60-70% customer)
- Question-to-statement ratio
- Customer engagement level
- Objection resolution success
- Progress toward close

CRITICAL: Respond with ONLY valid JSON. No markdown, no code blocks, no additional text.`
  };

  // Robust JSON parsing helper
  private parseJsonResponse(content: string): any {
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    // Remove markdown code blocks if present
    let cleanContent = content.trim();
    
    // Remove ```json and ``` if present
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '');
    }
    if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '');
    }
    if (cleanContent.endsWith('```')) {
      cleanContent = cleanContent.replace(/\s*```$/, '');
    }

    // Remove any leading/trailing whitespace
    cleanContent = cleanContent.trim();
    console.log('cleanContent', cleanContent);
    try {
      return JSON.parse(cleanContent);
    } catch (error) {
      console.error('JSON parsing failed. Raw content:', content);
      console.error('Cleaned content:', cleanContent);
      throw new Error(`Failed to parse JSON response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateCoachingTip(context: ConversationContext): Promise<any> {
    try {
      const prompt = this.buildCoachingPrompt(context);
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: this.systemPrompts.salesCoach },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No response from OpenAI');
      console.log('coaching tip', content);
      return this.parseJsonResponse(content);
    } catch (error) {
      console.error('Error generating coaching tip:', error);
      throw error;
    }
  }

  private buildCoachingPrompt(context: ConversationContext): string {
    const { agentText, customerText, analytics, customerProfile } = context;
    
    return `
CONVERSATION ANALYSIS REQUEST:

LATEST EXCHANGE:
Agent: "${agentText}"
Customer: "${customerText}"

CURRENT CONTEXT:
${analytics ? `
- Conversation Stage: ${analytics.conversationStage}
- Customer Sentiment: ${analytics.customerSentiment}  
- Talk Ratio: Agent ${analytics.talkRatio?.agent?.toFixed(1)}%, Customer ${analytics.talkRatio?.customer?.toFixed(1)}%
- Risk Factors: ${analytics.riskFactors?.join(', ') || 'None identified'}
- Opportunities: ${analytics.opportunities?.join(', ') || 'None identified'}
` : 'Context analysis in progress...'}

${customerProfile ? `
CUSTOMER PROFILE:
- Industry: ${customerProfile.industry || 'Unknown'}
- Company Size: ${customerProfile.companySize || 'Unknown'}
- Previous Interactions: ${customerProfile.previousInteractions || 'None'}
- Pain Points: ${customerProfile.knownPainPoints || 'To be discovered'}
` : ''}

COACHING REQUEST:
Based on this conversation context, provide ONE specific, immediately actionable coaching tip.

RESPOND WITH ONLY THIS JSON STRUCTURE (no markdown, no code blocks):
{
  "type": "suggestion",
  "category": "rapport",
  "message": "Specific, actionable tip (50-100 words)",
  "priority": "medium",
  "relevanceScore": 85,
  "suggestedResponse": "Exact words for agent to say",
  "reasoning": "Why this tip is important right now",
  "expectedOutcome": "What should happen if agent follows this advice"
}`;
  }

  async analyzeSentiment(text: string, speaker: 'agent' | 'customer'): Promise<any> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: this.systemPrompts.sentimentAnalyzer },
          { 
            role: "user", 
            content: `Analyze the sentiment and intent of this ${speaker} statement: "${text}"
            
            Respond with ONLY this JSON (no markdown, no code blocks):
            {
              "sentiment": "positive",
              "confidence": 0.8,
              "intent": "information_seeking",
              "emotions": ["curious", "interested"],
              "buyingSignals": [],
              "riskIndicators": [],
              "keyPhrases": ["important phrases"],
              "reasoning": "explanation of analysis"
            }`
          }
        ],
        temperature: 0.3,
        max_tokens: 300,
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
        .slice(-10) // Last 10 turns
        .map(turn => `${turn.speaker}: "${turn.text}"`)
        .join('\n');

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: this.systemPrompts.performanceAnalyzer },
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
}

export const openaiService = new EnhancedOpenAIService();