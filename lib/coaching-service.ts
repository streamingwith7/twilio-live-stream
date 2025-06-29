import { openaiService } from '@/lib/openai-service'
const { COACHING_RULES } = require('./prompts-store');

interface ConversationTurn {
  speaker: 'agent' | 'customer';
  text: string;
  timestamp: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  intent?: string;
  confidence?: number;
}

interface CallAnalytics {
  conversationStage: 'opening' | 'discovery' | 'presentation' | 'objection' | 'closing';
  customerSentiment: 'positive' | 'negative' | 'neutral';
  agentPerformance: number; // 0-100 score
  talkRatio: { agent: number; customer: number }; // percentage
  keyMoments: string[];
  detectedIntents: string[];
  riskFactors: string[];
  opportunities: string[];
}

// Simplified coaching tip interface
interface SimpleCoachingTip {
  id: string;
  tip: string;
  urgency: 'low' | 'medium' | 'high';
  reasoning: string;
  callSid: string;
  timestamp: string;
  conversationStage: string;
}

class EnhancedConversationTracker {
  private conversations = new Map<string, {
    turns: ConversationTurn[];
    analytics: CallAnalytics;
    lastTipTime: number;
    tipHistory: SimpleCoachingTip[];
    callStartTime: number;
    customerProfile?: any;
  }>();

  initializeCall(callSid: string, customerData?: any) {
    this.conversations.set(callSid, {
      turns: [],
      analytics: {
        conversationStage: 'opening',
        customerSentiment: 'neutral',
        agentPerformance: 50,
        talkRatio: { agent: 0, customer: 0 },
        keyMoments: [],
        detectedIntents: [],
        riskFactors: [],
        opportunities: []
      },
      lastTipTime: 0,
      tipHistory: [],
      callStartTime: Date.now(),
      customerProfile: customerData
    });
  }

  addTranscript(callSid: string, speaker: 'agent' | 'customer', text: string, timestamp: string) {
    const conversation = this.conversations.get(callSid);
    if (!conversation) return;

    // Analyze the transcript
    const turn: ConversationTurn = {
      speaker,
      text,
      timestamp,
      sentiment: this.analyzeSentiment(text),
      intent: this.detectIntent(text, speaker),
      confidence: this.calculateConfidence(text)
    };

    conversation.turns.push(turn);
    this.updateAnalytics(callSid, turn);
  }

  private analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    // Enhanced sentiment analysis
    const positiveWords = ['great', 'excellent', 'perfect', 'love', 'amazing', 'fantastic', 'wonderful', 'interested', 'yes', 'absolutely'];
    const negativeWords = ['terrible', 'awful', 'hate', 'no', 'never', 'problem', 'issue', 'concerned', 'worried', 'expensive'];
    
    const words = text.toLowerCase().split(' ');
    let positiveScore = 0;
    let negativeScore = 0;
    
    words.forEach(word => {
      if (positiveWords.some(pw => word.includes(pw))) positiveScore++;
      if (negativeWords.some(nw => word.includes(nw))) negativeScore++;
    });

    if (positiveScore > negativeScore) return 'positive';
    if (negativeScore > positiveScore) return 'negative';
    return 'neutral';
  }

  private detectIntent(text: string, speaker: 'agent' | 'customer'): string {
    const lowerText = text.toLowerCase();
    
    if (speaker === 'customer') {
      if (lowerText.includes('price') || lowerText.includes('cost') || lowerText.includes('expensive')) {
        return 'price_inquiry';
      }
      if (lowerText.includes('think about') || lowerText.includes('consider') || lowerText.includes('decide later')) {
        return 'hesitation';
      }
      if (lowerText.includes('not interested') || lowerText.includes('not right now')) {
        return 'rejection';
      }
      if (lowerText.includes('tell me more') || lowerText.includes('how does') || lowerText.includes('what about')) {
        return 'information_seeking';
      }
      if (lowerText.includes('yes') || lowerText.includes('sounds good') || lowerText.includes('interested')) {
        return 'positive_engagement';
      }
    } else {
      if (lowerText.includes('tell me about') || lowerText.includes('what') || lowerText.includes('how')) {
        return 'discovery_question';
      }
      if (lowerText.includes('i understand') || lowerText.includes('that makes sense')) {
        return 'empathy';
      }
      if (lowerText.includes('would you like') || lowerText.includes('shall we')) {
        return 'closing_attempt';
      }
    }
    
    return 'general';
  }

  private calculateConfidence(text: string): number {
    // Simple confidence calculation based on text length and completeness
    const wordCount = text.split(' ').length;
    if (wordCount < 3) return 0.6;
    if (wordCount < 8) return 0.8;
    return 0.95;
  }

  private updateAnalytics(callSid: string, turn: ConversationTurn) {
    const conversation = this.conversations.get(callSid);
    if (!conversation) return;

    const { analytics, turns } = conversation;
    
    // Update talk ratio
    const agentTurns = turns.filter(t => t.speaker === 'agent').length;
    const customerTurns = turns.filter(t => t.speaker === 'customer').length;
    const total = agentTurns + customerTurns;
    
    analytics.talkRatio = {
      agent: total > 0 ? (agentTurns / total) * 100 : 0,
      customer: total > 0 ? (customerTurns / total) * 100 : 0
    };

    // Update conversation stage
    analytics.conversationStage = this.determineConversationStage(turns);
    
    // Update customer sentiment
    const recentCustomerTurns = turns.filter(t => t.speaker === 'customer').slice(-3);
    if (recentCustomerTurns.length > 0) {
      const sentiments = recentCustomerTurns.map(t => t.sentiment);
      analytics.customerSentiment = this.calculateOverallSentiment(sentiments);
    }

    // Detect risk factors
    this.detectRiskFactors(analytics, turn);
    
    // Detect opportunities
    this.detectOpportunities(analytics, turn);
  }

  private determineConversationStage(turns: ConversationTurn[]): 'opening' | 'discovery' | 'presentation' | 'objection' | 'closing' {
    const recentTurns = turns.slice(-5);
    const recentText = recentTurns.map(t => t.text.toLowerCase()).join(' ');
    
    if (recentText.includes('price') || recentText.includes('cost') || recentText.includes('objection')) {
      return 'objection';
    }
    if (recentText.includes('close') || recentText.includes('move forward') || recentText.includes('sign up')) {
      return 'closing';
    }
    if (recentText.includes('features') || recentText.includes('benefits') || recentText.includes('solution')) {
      return 'presentation';
    }
    if (recentText.includes('tell me') || recentText.includes('what') || recentText.includes('how')) {
      return 'discovery';
    }
    
    return turns.length < 6 ? 'opening' : 'discovery';
  }

  private calculateOverallSentiment(sentiments: (string | undefined)[]): 'positive' | 'negative' | 'neutral' {
    const validSentiments = sentiments.filter(s => s) as string[];
    const positiveCount = validSentiments.filter(s => s === 'positive').length;
    const negativeCount = validSentiments.filter(s => s === 'negative').length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  private detectRiskFactors(analytics: CallAnalytics, turn: ConversationTurn) {
    const text = turn.text.toLowerCase();
    
    // Customer disengagement
    if (turn.speaker === 'customer' && text.length < 10 && analytics.customerSentiment === 'negative') {
      analytics.riskFactors.push('Customer seems disengaged');
    }
    
    // Price objections
    if (text.includes('expensive') || text.includes('too much') || text.includes('budget')) {
      analytics.riskFactors.push('Price objection detected');
    }
    
    // Competitor mentions
    if (text.includes('competitor') || text.includes('other option') || text.includes('looking at')) {
      analytics.riskFactors.push('Competitor consideration mentioned');
    }
    
    // Agent talking too much
    if (analytics.talkRatio.agent > 70) {
      analytics.riskFactors.push('Agent dominating conversation');
    }
  }

  private detectOpportunities(analytics: CallAnalytics, turn: ConversationTurn) {
    const text = turn.text.toLowerCase();
    
    // Positive engagement
    if (turn.speaker === 'customer' && turn.sentiment === 'positive') {
      analytics.opportunities.push('Customer showing positive interest');
    }
    
    // Pain points mentioned
    if (text.includes('problem') || text.includes('challenge') || text.includes('struggle')) {
      analytics.opportunities.push('Pain point identified');
    }
    
    // Decision maker indicators
    if (text.includes('i decide') || text.includes('my decision') || text.includes('i can approve')) {
      analytics.opportunities.push('Decision maker identified');
    }
  }

  getConversation(callSid: string) {
    return this.conversations.get(callSid);
  }

  endCall(callSid: string) {
    const conversation = this.conversations.get(callSid);
    if (conversation) {
      // Store final analytics for reporting
      console.log(`Call ${callSid} ended. Final analytics:`, conversation.analytics);
    }
    this.conversations.delete(callSid);
  }
}

class EnhancedCoachingService {
  private tracker = new EnhancedConversationTracker();

  async processTranscript(
    callSid: string,
    track: string,
    transcriptionData: string,
    timestamp: string,
    speaker: 'agent' | 'customer'
  ): Promise<SimpleCoachingTip | null> {
    try {
      
      let actualTranscript = transcriptionData;
      try {
        const parsed = JSON.parse(transcriptionData);
        actualTranscript = parsed.transcript || transcriptionData;
      } catch (e) {
        actualTranscript = transcriptionData;
      }

      this.tracker.addTranscript(callSid, speaker, actualTranscript, timestamp);
      
      const conversation = this.tracker.getConversation(callSid);
      if (!conversation) {
        this.tracker.initializeCall(callSid);
        return null;
      }

      const now = Date.now();
      const timeSinceLastTip = now - conversation.lastTipTime;
      const minTimeBetweenTips = this.calculateMinTimeBetweenTips(conversation.analytics);

      if (timeSinceLastTip < minTimeBetweenTips) {
        console.log('returned null');
        return null;
      }

      const tip = await this.generateEnhancedTip(callSid, conversation);
      
      if (tip) {
        conversation.lastTipTime = now;
        conversation.tipHistory.push(tip);
        return tip;
      }

      return null;
    } catch (error) {
      console.error('Error in enhanced coaching analysis:', error);
      return null;
    }
  }

  private calculateMinTimeBetweenTips(analytics: CallAnalytics): number {
    const baseTime = 8000; // 8 seconds
    
    if (analytics.conversationStage === 'closing') return baseTime * 0.5;
    if (analytics.customerSentiment === 'negative') return baseTime * 0.7;
    if (analytics.conversationStage === 'opening') return baseTime * 1.5;
    
    return baseTime;
  }

  private async generateEnhancedTip(
    callSid: string,
    conversation: any
  ): Promise<SimpleCoachingTip | null> {
    const { turns, analytics } = conversation;
    console.log('conversation', conversation);
    
    if (turns.length < 2) {
      console.log('turns.length < 2');
      return null;
    }    
    const lastAgentTurn = turns.filter((t: ConversationTurn) => t.speaker === 'agent').slice(-1)[0];
    const lastCustomerTurn = turns.filter((t: ConversationTurn) => t.speaker === 'customer').slice(-1)[0];
    
    if (!lastAgentTurn || !lastCustomerTurn) return null;

    try {
      const tipData = await openaiService.generateCoachingTip({
        agentText: lastAgentTurn.text,
        customerText: lastCustomerTurn.text,
        callSid,
        timestamp: new Date().toISOString(),
        analytics
      });
      
      return {
        id: `tip_${callSid}_${Date.now()}`,
        tip: tipData.tip,
        urgency: tipData.urgency,
        reasoning: tipData.reasoning,
        callSid,
        timestamp: new Date().toISOString(),
        conversationStage: analytics.conversationStage
      };
      
    } catch (error) {
      console.error('Error generating tip:', error);
      return null;
    }
  }

  // Analytics and reporting methods
  getCallAnalytics(callSid: string) {
    const conversation = this.tracker.getConversation(callSid);
    return conversation?.analytics;
  }

  generateCallSummary(callSid: string) {
    const conversation = this.tracker.getConversation(callSid);
    if (!conversation) return null;

    return {
      duration: Date.now() - conversation.callStartTime,
      totalTurns: conversation.turns.length,
      analytics: conversation.analytics,
      tipCount: conversation.tipHistory.length,
      keyInsights: this.extractKeyInsights(conversation)
    };
  }

  private extractKeyInsights(conversation: any): string[] {
    const insights: string[] = [];
    const { analytics, turns } = conversation;

    if (analytics.talkRatio.agent > 70) {
      insights.push('Agent dominated the conversation - consider asking more questions');
    }

    if (analytics.customerSentiment === 'positive' && analytics.conversationStage !== 'closing') {
      insights.push('Customer is engaged - good time to move toward closing');
    }

    if (analytics.riskFactors.length > 2) {
      insights.push('Multiple risk factors detected - focus on addressing concerns');
    }

    return insights;
  }

  endCall(callSid: string) {
    return this.tracker.endCall(callSid);
  }
}

export const coachingService = new EnhancedCoachingService();