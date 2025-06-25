import { openaiService } from '@/lib/openai-service'

interface ClientRequirement {
  id: string;
  requirement: string;
  confidence: number;
  category: 'product' | 'pricing' | 'timeline' | 'features' | 'support' | 'integration' | 'other';
  timestamp: string;
  source: string; // transcript excerpt
}

interface CallStrategy {
  id: string;
  callSid: string;
  overallObjective: string;
  keyRequirements: ClientRequirement[];
  recommendedApproach: string;
  focusAreas: string[];
  riskFactors: string[];
  opportunities: string[];
  nextSteps: string[];
  confidence: number;
  lastUpdated: string;
  version: number;
}

interface ConversationContext {
  callSid: string;
  conversationHistory: string[];
  currentStage: string;
  customerSentiment: string;
  detectedRequirements: ClientRequirement[];
}

class CallStrategyService {
  private strategies = new Map<string, CallStrategy>();
  private requirements = new Map<string, ClientRequirement[]>();

  async analyzeClientRequirements(
    callSid: string,
    transcript: string,
    speaker: 'agent' | 'customer',
    conversationContext: any
  ): Promise<ClientRequirement[]> {
    try {
      if (speaker !== 'customer') {
        return [];
      }

      const existingRequirements = this.requirements.get(callSid) || [];
      
      const functions = [
        {
          name: "identify_client_requirements",
          description: "Identify new client requirements from customer statements",
          parameters: {
            type: "object",
            properties: {
              requirements: {
                type: "array",
                description: "Array of new requirements identified from the customer statement",
                items: {
                  type: "object",
                  properties: {
                    requirement: {
                      type: "string",
                      description: "The specific requirement or need expressed by the customer"
                    },
                    confidence: {
                      type: "number",
                      description: "Confidence level (0-1) that this is a genuine requirement",
                      minimum: 0,
                      maximum: 1
                    },
                    category: {
                      type: "string",
                      enum: ["product", "pricing", "timeline", "features", "support", "integration", "other"],
                      description: "Category of the requirement"
                    },
                    source: {
                      type: "string",
                      description: "Exact transcript excerpt that indicates this requirement"
                    }
                  },
                  required: ["requirement", "confidence", "category"]
                }
              }
            },
            required: ["requirements"]
          }
        }
      ];

      const response = await openaiService.chatWithFunctions([
        {
          role: 'system',
          content: `You are an expert sales analyst specializing in identifying client requirements from conversation transcripts. 
          
          Your task is to analyze customer statements and identify specific requirements, needs, or preferences they express.
          
          Focus on:
          - Product features they need
          - Pricing concerns or budget constraints
          - Timeline requirements
          - Integration needs
          - Support requirements
          - Decision criteria
          - Pain points they're trying to solve
          
          Only identify requirements that are explicitly stated or strongly implied by the customer.
          Do not duplicate requirements that already exist in the conversation.`
        },
        {
          role: 'user',
          content: `Analyze this customer statement for any requirements or needs they express:

Customer Statement: "${transcript}"

Existing Requirements: ${JSON.stringify(existingRequirements.map(r => r.requirement))}

Conversation Context:
- Stage: ${conversationContext?.conversationStage || 'unknown'}
- Customer Sentiment: ${conversationContext?.customerSentiment || 'unknown'}
- Talk Ratio: Agent ${conversationContext?.talkRatio?.agent?.toFixed(1) || 0}%, Customer ${conversationContext?.talkRatio?.customer?.toFixed(1) || 0}%

Identify any NEW requirements (not already in existing requirements) that the customer has expressed. If no new requirements are found, return an empty array.`
        }
      ], functions, {
        function_call: { name: "identify_client_requirements" },
        temperature: 0.3,
        max_tokens: 500
      });

      const functionCall = response.choices[0]?.message?.function_call;
      if (!functionCall || functionCall.name !== 'identify_client_requirements') {
        return [];
      }

      const args = JSON.parse(functionCall.arguments);
      const newRequirements = args.requirements || [];
      
      const validRequirements: ClientRequirement[] = newRequirements
        .filter((req: any) => req.requirement && req.confidence > 0.6)
        .map((req: any) => ({
          id: `req_${callSid}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          requirement: req.requirement,
          confidence: req.confidence,
          category: req.category || 'other',
          timestamp: new Date().toISOString(),
          source: req.source || transcript
        }));

      // Update stored requirements
      const allRequirements = [...existingRequirements, ...validRequirements];
      this.requirements.set(callSid, allRequirements);

      return validRequirements;
    } catch (error) {
      console.error('Error analyzing client requirements:', error);
      return [];
    }
  }

  async generateCallStrategy(
    callSid: string,
    requirements: ClientRequirement[],
    conversationContext: any
  ): Promise<CallStrategy | null> {
    try {
      const existingStrategy = this.strategies.get(callSid);
      const version = (existingStrategy?.version || 0) + 1;

      const functions = [
        {
          name: "generate_call_strategy",
          description: "Generate a comprehensive call strategy based on client requirements",
          parameters: {
            type: "object",
            properties: {
              overallObjective: {
                type: "string",
                description: "Clear objective for this call based on client needs"
              },
              recommendedApproach: {
                type: "string",
                description: "Strategic approach the agent should take"
              },
              focusAreas: {
                type: "array",
                items: { type: "string" },
                description: "Key areas the agent should focus on during the call"
              },
              riskFactors: {
                type: "array",
                items: { type: "string" },
                description: "Potential risks that need to be addressed"
              },
              opportunities: {
                type: "array",
                items: { type: "string" },
                description: "Opportunities to capitalize on during the call"
              },
              nextSteps: {
                type: "array",
                items: { type: "string" },
                description: "Specific actions the agent should take"
              },
              confidence: {
                type: "number",
                description: "Confidence level in this strategy (0-1)",
                minimum: 0,
                maximum: 1
              }
            },
            required: ["overallObjective", "recommendedApproach", "focusAreas", "riskFactors", "opportunities", "nextSteps", "confidence"]
          }
        }
      ];

      const response = await openaiService.chatWithFunctions([
        {
          role: 'system',
          content: `You are an expert sales strategist. Based on identified client requirements, create a comprehensive call strategy that guides the sales agent on how to approach the conversation.

          Your strategy should include:
          - Overall objective for the call
          - Recommended approach based on client needs
          - Key focus areas to emphasize
          - Risk factors to address
          - Opportunities to capitalize on
          - Specific next steps for the agent
          
          Be strategic, actionable, and focused on closing the deal.`
        },
        {
          role: 'user',
          content: `Generate a call strategy based on these client requirements:

Client Requirements:
${requirements.map(req => `- ${req.requirement} (${req.category}, confidence: ${req.confidence})`).join('\n')}

Conversation Context:
- Stage: ${conversationContext?.conversationStage || 'unknown'}
- Customer Sentiment: ${conversationContext?.customerSentiment || 'unknown'}
- Talk Ratio: Agent ${conversationContext?.talkRatio?.agent?.toFixed(1) || 0}%, Customer ${conversationContext?.talkRatio?.customer?.toFixed(1) || 0}%

${existingStrategy ? `
Previous Strategy Version ${existingStrategy.version}:
- Objective: ${existingStrategy.overallObjective}
- Approach: ${existingStrategy.recommendedApproach}
` : ''}

Create a comprehensive call strategy.`
        }
      ], functions, {
        function_call: { name: "generate_call_strategy" },
        temperature: 0.4,
        max_tokens: 800
      });

      const functionCall = response.choices[0]?.message?.function_call;
      if (!functionCall || functionCall.name !== 'generate_call_strategy') {
        return null;
      }

      const strategyData = JSON.parse(functionCall.arguments);
      
      const strategy: CallStrategy = {
        id: `strategy_${callSid}_${Date.now()}`,
        callSid,
        overallObjective: strategyData.overallObjective,
        keyRequirements: requirements,
        recommendedApproach: strategyData.recommendedApproach,
        focusAreas: strategyData.focusAreas || [],
        riskFactors: strategyData.riskFactors || [],
        opportunities: strategyData.opportunities || [],
        nextSteps: strategyData.nextSteps || [],
        confidence: strategyData.confidence || 0.7,
        lastUpdated: new Date().toISOString(),
        version
      };

      this.strategies.set(callSid, strategy);
      return strategy;
    } catch (error) {
      console.error('Error generating call strategy:', error);
      return null;
    }
  }

  async processTranscript(
    callSid: string,
    transcript: string,
    speaker: 'agent' | 'customer',
    conversationContext: any
  ): Promise<{ requirements: ClientRequirement[], strategy: CallStrategy | null }> {
    try {
      const newRequirements = await this.analyzeClientRequirements(
        callSid,
        transcript,
        speaker,
        conversationContext
      );

      let strategy = null;
      if (newRequirements.length > 0) {
        const allRequirements = this.requirements.get(callSid) || [];
        strategy = await this.generateCallStrategy(callSid, allRequirements, conversationContext);
      }

      return { requirements: newRequirements, strategy };
    } catch (error) {
      console.error('Error processing transcript for strategy:', error);
      return { requirements: [], strategy: null };
    }
  }

  getCurrentStrategy(callSid: string): CallStrategy | null {
    return this.strategies.get(callSid) || null;
  }

  getRequirements(callSid: string): ClientRequirement[] {
    return this.requirements.get(callSid) || [];
  }

  endCall(callSid: string) {
    this.strategies.delete(callSid);
    this.requirements.delete(callSid);
  }
}

export const callStrategyService = new CallStrategyService(); 