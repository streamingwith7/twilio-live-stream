import { openaiService } from '@/lib/openai-service'
import { Conversation } from 'twilio/lib/twiml/VoiceResponse';

interface ConversationTurn {
  speaker: 'agent' | 'customer';
  text: string;
  timestamp: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  intent?: string;
  confidence?: number;
}

interface TurnWithTip {
  customer?: string;
  agent?: string;
  tip?: {
    content: string;
    isUsed: boolean;
    timestamp: string;
  }
}

interface IncrementalReport {
  startTurnIndex: number;
  endTurnIndex: number;
  turns: TurnWithTip[];
  timestamp: string;
}

interface CallAnalytics {
  conversationStage: 'opening' | 'discovery' | 'presentation' | 'objection' | 'closing';
  customerSentiment: 'positive' | 'negative' | 'neutral';
  agentPerformance: number;
  talkRatio: { agent: number; customer: number };
  keyMoments: string[];
  detectedIntents: string[];
  riskFactors: string[];
  opportunities: string[];
}

interface SimpleCoachingTip {
  id: string;
  tip: string;
  urgency: 'low' | 'medium' | 'high';
  reasoning: string;
  callSid: string;
  timestamp: string;
  conversationStage: string;
  suggestedScript: string;
  sentiment: string;
}

class EnhancedConversationTracker {
  private conversations = new Map<string, {
    turns: ConversationTurn[];
    analytics: CallAnalytics;
    lastTipTime: number;
    tipHistory: SimpleCoachingTip[];
    callStartTime: number;
    customerProfile?: any;
    lastSpeaker?: 'agent' | 'customer';
    customerJustFinishedSpeaking: boolean;
    incrementalReports: IncrementalReport[];
    lastReportTurnCount: number;
  }>();

  initializeCall(callSid: string, customerData?: any) {
    console.log('🚀 initializeCall: Initializing conversation for callSid:', callSid);
    
    openaiService.initializePrompts().then(() => {
      console.log('✅ Prompts preloaded for call:', callSid);
    }).catch((error) => {
      console.error('❌ Failed to preload prompts for call:', callSid, error);
    });

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
      customerProfile: customerData,
      lastSpeaker: undefined,
      customerJustFinishedSpeaking: false,
      incrementalReports: [],
      lastReportTurnCount: 0
    });
    console.log('✅ initializeCall: Successfully initialized conversation for callSid:', callSid);
  }

  addTranscript(callSid: string, speaker: 'agent' | 'customer', text: string, timestamp: string) {
    const conversation = this.conversations.get(callSid);
    if (!conversation) return;

    const wasCustomerSpeaking = conversation.lastSpeaker === 'customer';
    const isCustomerSpeaking = speaker === 'customer';
    conversation.customerJustFinishedSpeaking = (wasCustomerSpeaking && !isCustomerSpeaking) || 
                                                 (conversation.lastSpeaker === undefined && !isCustomerSpeaking && conversation.turns.some(t => t.speaker === 'customer'));
    conversation.lastSpeaker = speaker;

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
    const positiveWords = ['great', 'excellent', 'perfect', 'love', 'amazing', 'fantastic', 'wonderful', 'interested', 'yes', 'absolutely',
                          'fair offer', 'good price', 'reasonable', 'motivated', 'excited', 'sounds good', 'looking forward',
                          'need to sell', 'ready to sell', 'cash offer', 'quick sale', 'no hassle', 'convenient'];
    const negativeWords = ['terrible', 'awful', 'hate', 'no', 'never', 'problem', 'issue', 'concerned', 'worried', 'lowball',
                          'too low', 'not enough', 'bad offer', 'not interested', 'disappointing', 'insulting',
                          'market value', 'worth more', 'unrealistic', 'not worth it', 'other offers'];
    
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
      if (lowerText.includes('how much') || lowerText.includes('what price') || lowerText.includes('offer') || lowerText.includes('worth')) {
        return 'price_inquiry';
      }
      if (lowerText.includes('why should i sell') || lowerText.includes('not interested') || lowerText.includes('not selling') || lowerText.includes('happy here')) {
        return 'not_motivated';
      }
      if (lowerText.includes('need to think') || lowerText.includes('consider') || lowerText.includes('decide later') || lowerText.includes('discuss with')) {
        return 'hesitation';
      }
      if (lowerText.includes('other offers') || lowerText.includes('other buyers') || lowerText.includes('realtor') || lowerText.includes('agent')) {
        return 'competition_mentioned';
      }
      if (lowerText.includes('repairs') || lowerText.includes('condition') || lowerText.includes('as-is') || lowerText.includes('fix')) {
        return 'property_condition';
      }
      if (lowerText.includes('quick sale') || lowerText.includes('need to sell') || lowerText.includes('urgent') || lowerText.includes('fast')) {
        return 'urgency_expressed';
      }
      if (lowerText.includes('cash') || lowerText.includes('financing') || lowerText.includes('mortgage') || lowerText.includes('closing')) {
        return 'transaction_terms';
      }
      if (lowerText.includes('moving') || lowerText.includes('relocating') || lowerText.includes('downsizing') || lowerText.includes('upsizing')) {
        return 'lifestyle_change';
      }
      if (lowerText.includes('inherited') || lowerText.includes('estate') || lowerText.includes('divorce') || lowerText.includes('foreclosure')) {
        return 'distressed_situation';
      }
      if (lowerText.includes('yes') || lowerText.includes('sounds good') || lowerText.includes('interested') || lowerText.includes('tell me more')) {
        return 'positive_engagement';
      }
    } else {
      if (lowerText.includes('tell me about') || lowerText.includes('why selling') || lowerText.includes('situation') || lowerText.includes('circumstances')) {
        return 'discovery_question';
      }
      if (lowerText.includes('i understand') || lowerText.includes('that makes sense') || lowerText.includes('i hear you')) {
        return 'empathy';
      }
      if (lowerText.includes('cash offer') || lowerText.includes('can offer') || lowerText.includes('willing to pay')) {
        return 'making_offer';
      }
      if (lowerText.includes('buy as-is') || lowerText.includes('no repairs needed') || lowerText.includes('any condition')) {
        return 'as_is_benefit';
      }
      if (lowerText.includes('close quickly') || lowerText.includes('fast closing') || lowerText.includes('days not months')) {
        return 'speed_benefit';
      }
      if (lowerText.includes('no fees') || lowerText.includes('no commission') || lowerText.includes('no realtor fees')) {
        return 'cost_savings';
      }
      if (lowerText.includes('help you') || lowerText.includes('solve your problem') || lowerText.includes('make it easy')) {
        return 'problem_solving';
      }
    }
    
    return 'general';
  }

  private calculateConfidence(text: string): number {
    const wordCount = text.split(' ').length;
    if (wordCount < 3) return 0.6;
    if (wordCount < 8) return 0.8;
    return 0.95;
  }

  private updateAnalytics(callSid: string, turn: ConversationTurn) {
    const conversation = this.conversations.get(callSid);
    if (!conversation) return;

    const { analytics, turns } = conversation;
    
    const agentTurns = turns.filter(t => t.speaker === 'agent').length;
    const customerTurns = turns.filter(t => t.speaker === 'customer').length;
    const total = agentTurns + customerTurns;
    
    analytics.talkRatio = {
      agent: total > 0 ? (agentTurns / total) * 100 : 0,
      customer: total > 0 ? (customerTurns / total) * 100 : 0
    };

    analytics.conversationStage = this.determineConversationStage(turns);
    
    const recentCustomerTurns = turns.filter(t => t.speaker === 'customer').slice(-3);
    if (recentCustomerTurns.length > 0) {
      const sentiments = recentCustomerTurns.map(t => t.sentiment);
      analytics.customerSentiment = this.calculateOverallSentiment(sentiments);
    }

    this.detectRiskFactors(analytics, turn);
    
    this.detectOpportunities(analytics, turn);
  }

  private determineConversationStage(turns: ConversationTurn[]): 'opening' | 'discovery' | 'presentation' | 'objection' | 'closing' {
    const recentTurns = turns.slice(-5);
    const recentText = recentTurns.map(t => t.text.toLowerCase()).join(' ');
    
    if (recentText.includes('too low') || recentText.includes('not enough') || recentText.includes('worth more') || recentText.includes('market value') || 
        recentText.includes('other offers') || recentText.includes('not interested') || recentText.includes('lowball')) {
      return 'objection';
    }
    if (recentText.includes('make an offer') || recentText.includes('cash offer') || recentText.includes('willing to sell') || 
        recentText.includes('move forward') || recentText.includes('accept') || recentText.includes('deal')) {
      return 'closing';
    }
    if (recentText.includes('we buy') || recentText.includes('cash offer') || recentText.includes('as-is') || recentText.includes('fast closing') || 
        recentText.includes('no fees') || recentText.includes('no repairs') || recentText.includes('benefits')) {
      return 'presentation';
    }
    if (recentText.includes('why selling') || recentText.includes('situation') || recentText.includes('circumstances') || recentText.includes('tell me about') ||
        recentText.includes('motivation') || recentText.includes('timeline') || recentText.includes('condition')) {
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
    
    if (turn.speaker === 'customer' && text.length < 10 && analytics.customerSentiment === 'negative') {
      analytics.riskFactors.push('Seller seems disengaged');
    }
    
    if (text.includes('too low') || text.includes('not enough') || text.includes('lowball') || text.includes('insulting') ||
        text.includes('worth more') || text.includes('market value') || text.includes('asking more')) {
      analytics.riskFactors.push('Seller thinks offer too low');
    }
    
    if (text.includes('not interested') || text.includes('not selling') || text.includes('happy here') || text.includes('no need') ||
        text.includes('not motivated') || text.includes('change my mind')) {
      analytics.riskFactors.push('Seller not motivated to sell');
    }
    
    if (text.includes('other offers') || text.includes('other buyers') || text.includes('realtor') || text.includes('agent') ||
        text.includes('listing') || text.includes('multiple offers') || text.includes('better offer')) {
      analytics.riskFactors.push('Competition from other buyers');
    }
    
    if (text.includes('zillow says') || text.includes('neighbor sold') || text.includes('should be worth') || 
        text.includes('appraisal says') || text.includes('assessed value')) {
      analytics.riskFactors.push('Unrealistic price expectations');
    }
    
    if (text.includes('no rush') || text.includes('not urgent') || text.includes('take my time') || text.includes('think about it') ||
        text.includes('no hurry') || text.includes('maybe later')) {
      analytics.riskFactors.push('No urgency to sell');
    }
    
    if (text.includes('family home') || text.includes('sentimental') || text.includes('memories') || text.includes('grew up here') ||
        text.includes('hard to leave') || text.includes('emotional')) {
      analytics.riskFactors.push('Strong emotional attachment');
    }
    
    if (text.includes('spouse disagrees') || text.includes('family not sure') || text.includes('partner thinks') ||
        text.includes('need to discuss') || text.includes('not on same page')) {
      analytics.riskFactors.push('Family disagreement detected');
    }
    
    if (text.includes('try realtor first') || text.includes('list it first') || text.includes('see what market') ||
        text.includes('traditional sale') || text.includes('mls') || text.includes('open house')) {
      analytics.riskFactors.push('Wants to try traditional sale');
    }
    
    if (analytics.talkRatio.agent > 70) {
      analytics.riskFactors.push('Agent dominating conversation');
    }
  }

  private detectOpportunities(analytics: CallAnalytics, turn: ConversationTurn) {
    const text = turn.text.toLowerCase();
    
    if (turn.speaker === 'customer' && turn.sentiment === 'positive') {
      analytics.opportunities.push('Seller showing positive interest');
    }
    
    if (text.includes('need to sell') || text.includes('must sell') || text.includes('urgent') || text.includes('quick sale') ||
        text.includes('asap') || text.includes('right away') || text.includes('time sensitive')) {
      analytics.opportunities.push('Highly motivated seller');
    }
    
    if (text.includes('foreclosure') || text.includes('behind on payments') || text.includes('financial hardship') || 
        text.includes('cant afford') || text.includes('job loss') || text.includes('medical bills')) {
      analytics.opportunities.push('Financial distress situation');
    }
    
    if (text.includes('divorce') || text.includes('death') || text.includes('inherited') || text.includes('estate') ||
        text.includes('relocating') || text.includes('job transfer') || text.includes('military')) {
      analytics.opportunities.push('Life change driving sale');
    }
    
    if (text.includes('as-is') || text.includes('no repairs') || text.includes('any condition') || text.includes('needs work') ||
        text.includes('fixer') || text.includes('handyman special')) {
      analytics.opportunities.push('Accepts as-is condition');
    }
    
    if (text.includes('cash') || text.includes('no financing') || text.includes('quick closing') || text.includes('fast close') ||
        text.includes('days not months') || text.includes('no loan contingency')) {
      analytics.opportunities.push('Values cash offer benefits');
    }
    
    if (text.includes('no fees') || text.includes('no commission') || text.includes('save money') || text.includes('no realtor') ||
        text.includes('avoid fees') || text.includes('keep more money')) {
      analytics.opportunities.push('Cost savings motivation');
    }
    
    if (text.includes('easy') || text.includes('simple') || text.includes('hassle-free') || text.includes('convenient') ||
        text.includes('no showings') || text.includes('no staging') || text.includes('one stop')) {
      analytics.opportunities.push('Values convenience and simplicity');
    }
    
    if (text.includes('i decide') || text.includes('my decision') || text.includes('my house') || text.includes('sole owner') ||
        text.includes('up to me') || text.includes('my choice')) {
      analytics.opportunities.push('Decision maker identified');
    }
    
    if (text.includes('private sale') || text.includes('no sign') || text.includes('discreet') || text.includes('confidential') ||
        text.includes('neighbors') || text.includes('quiet sale')) {
      analytics.opportunities.push('Privacy concerns favor direct sale');
    }
    
    if (text.includes('bad realtor') || text.includes('disappointed') || text.includes('listing expired') || 
        text.includes('overpriced') || text.includes('no showings') || text.includes('failed to sell')) {
      analytics.opportunities.push('Negative realtor experience');
    }
    
    if (text.includes('you seem honest') || text.includes('straightforward') || text.includes('trust you') ||
        text.includes('fair') || text.includes('helpful') || text.includes('professional')) {
      analytics.opportunities.push('Trust and rapport building');
    }
    
    if (text.includes('rental') || text.includes('investment') || text.includes('tenant') || text.includes('cash flow') ||
        text.includes('flip') || text.includes('business decision')) {
      analytics.opportunities.push('Investment property (less emotional)');
    }
    
    if (text.includes('other properties') || text.includes('portfolio') || text.includes('several houses') ||
        text.includes('more than one') || text.includes('investment properties')) {
      analytics.opportunities.push('Multiple property owner');
    }
  }

  getConversation(callSid: string) {
    return this.conversations.get(callSid);
  }

  endCall(callSid: string) {
    console.log('🛑 endCall: Ending conversation for callSid:', callSid);
    
    openaiService.clearCachedPrompts();
    
    this.conversations.delete(callSid);
    console.log('🗑️ endCall: Deleted conversation for callSid:', callSid);
  }
}

class EnhancedCoachingService {
  private tracker = new EnhancedConversationTracker();

  getConversation(callSid: string) {
    return this.tracker.getConversation(callSid);
  }

  async generateReport(
    callSid: string,
  ): Promise<{ turns: ConversationTurn[], tipHistory: SimpleCoachingTip[] } | null> {
    const conversation = this.tracker.getConversation(callSid);
    if (!conversation) {
      Array.from((this.tracker as any).conversations.keys());
      return null;
    }
    
    return {
      turns: conversation.turns,
      tipHistory: conversation.tipHistory
    };
  }

  async generateReportWithTipUsage(
    callSid: string,
  ): Promise<{ turns: ConversationTurn[], tipHistory: SimpleCoachingTip[] } | null> {
    const conversation = this.tracker.getConversation(callSid);
    if (!conversation) {
      console.log('No conversation found for report generation:', callSid);
      return null;
    }
    
    const { turns, tipHistory } = conversation;
    
    if (!tipHistory || tipHistory.length === 0) {
      console.log('No tips to analyze for callSid:', callSid);
      return {
        turns,
        tipHistory: []
      };
    }

    console.log(`Analyzing tip usage for ${tipHistory.length} tips in call ${callSid}`);
    
    const callDuration = Date.now() - conversation.callStartTime;
    const callDurationMinutes = callDuration / (1000 * 60);
    
    let analyzedTips;
    
    if (callDurationMinutes > 10) {
      console.log(`Long conversation detected (${callDurationMinutes.toFixed(1)} minutes). Using chunked analysis.`);
      analyzedTips = await openaiService.analyzeChunkedTipUsage(turns, tipHistory, 5);
    } else {
      console.log(`Short conversation (${callDurationMinutes.toFixed(1)} minutes). Using regular analysis.`);
      analyzedTips = await openaiService.analyzeTipUsage(turns, tipHistory);
    }

    console.log(`Tip usage analysis complete. ${analyzedTips.filter(tip => tip.isUsed).length}/${analyzedTips.length} tips marked as used.`);
    
    return {
      turns,
      tipHistory: analyzedTips
    };
  }

  async generateCallFeedback(callSid: string): Promise<any> {
    const conversation = this.tracker.getConversation(callSid);
    if (!conversation) {
      console.log('No conversation found for feedback generation:', callSid);
      return null;
    }

    const { turns, analytics, tipHistory } = conversation;
    
    const fullConversation = turns
      .map((turn: ConversationTurn, index: number) => {
        const turnNumber = index + 1;
        const sentiment = turn.sentiment ? ` [${turn.sentiment}]` : '';
        const intent = turn.intent ? ` [${turn.intent}]` : '';
        return `Turn ${turnNumber} - ${turn.speaker}${sentiment}${intent}: "${turn.text}"`;
      })
      .join('\n');

    const conversationSummary = {
      totalTurns: turns.length,
      agentTurns: turns.filter((t: ConversationTurn) => t.speaker === 'agent').length,
      customerTurns: turns.filter((t: ConversationTurn) => t.speaker === 'customer').length,
      duration: Date.now() - conversation.callStartTime,
      previousTipCount: tipHistory?.length || 0
    };

    try {
      const feedbackData = await openaiService.generateCallFeedback({
        conversationHistory: turns,
        fullConversation,
        analytics: {
          ...analytics,
          conversationSummary
        },
        tipHistory: tipHistory || []
      });

      return feedbackData;
    } catch (error) {
      console.error('Error generating call feedback:', error);
      return null;
    }
  }

  async saveCallFeedbackToDatabase(callSid: string, feedbackData: any): Promise<boolean> {
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();

      const existingReport = await prisma.callReport.findUnique({
        where: { callSid }
      });

      if (existingReport) {
        await prisma.callReport.update({
          where: { callSid },
          data: {
            reportData: {
              ...existingReport.reportData,
              feedback: feedbackData
            },
            updatedAt: new Date()
          }
        });
      } else {
        await prisma.callReport.create({
          data: {
            callSid,
            reportData: {
              feedback: feedbackData
            },
            totalTurns: feedbackData?.callSummary?.totalTurns || 0,
            totalTips: feedbackData?.tipHistory?.length || 0,
            usedTips: feedbackData?.tipHistory?.filter((tip: any) => tip.isUsed).length || 0
          }
        });
      }

      await prisma.$disconnect();
      console.log('✅ Call feedback saved to database for callSid:', callSid);
      return true;
    } catch (error) {
      console.error('❌ Error saving call feedback to database:', error);
      return false;
    }
  }

  async endCallWithFeedback(callSid: string): Promise<any> {
    try {
      const feedbackData = await this.generateCallFeedback(callSid);
      
      if (feedbackData) {
        const saved = await this.saveCallFeedbackToDatabase(callSid, feedbackData);
        
        if (saved) {
          console.log('✅ Call feedback generated and saved successfully for callSid:', callSid);
        } else {
          console.log('⚠️ Call feedback generated but failed to save for callSid:', callSid);
        }
      } else {
        console.log('⚠️ No feedback data generated for callSid:', callSid);
      }

      this.tracker.endCall(callSid);
      
      return feedbackData;
    } catch (error) {
      console.error('❌ Error in endCallWithFeedback:', error);
      this.tracker.endCall(callSid);
      return null;
    }
  }
  
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
      
      let conversation = this.tracker.getConversation(callSid);
      if (!conversation) {
        this.tracker.initializeCall(callSid);
        conversation = this.tracker.getConversation(callSid);
        if (!conversation) {
          console.error(`Failed to initialize conversation for ${callSid}`);
          return null;
        }
      }

      if (speaker === 'agent') {
        return null;
      }

      const now = Date.now();
      const timeSinceLastTip = now - conversation.lastTipTime;
      const minTimeBetweenTips = 15000;
      
      if (timeSinceLastTip < minTimeBetweenTips) {
        console.log(`Skipping tip generation - only ${timeSinceLastTip}ms since last tip (minimum: ${minTimeBetweenTips}ms)`);
        return null;
      }

      const tip = await this.generateEnhancedTip(callSid, conversation);

      const existingTip = conversation.tipHistory.find((t: SimpleCoachingTip) => t.tip === tip?.tip || t.suggestedScript === tip?.suggestedScript);

      
      if (tip && !existingTip && tip.tip !== 'SAME' && tip.suggestedScript !== 'SAME') {
        conversation.lastTipTime = Date.now();
        conversation.tipHistory.push(tip);
        return tip;
      }

      return null;
    } catch (error) {
      console.error('Error in enhanced coaching analysis:', error);
      return null;
    }
  }

  private async generateEnhancedTip(
    callSid: string,
    conversation: any
  ): Promise<SimpleCoachingTip | null> {

    const { turns, analytics } = conversation;
    const lastCustomerTurn = turns.filter((t: ConversationTurn) => t.speaker === 'customer').slice(-1)[0];
    if (!lastCustomerTurn) {
      console.log('No customer speech detected yet');
      return null;
    }

    const fullConversation = turns
      .map((turn: ConversationTurn, index: number) => {
        const turnNumber = index + 1;
        const sentiment = turn.sentiment ? ` [${turn.sentiment}]` : '';
        const intent = turn.intent ? ` [${turn.intent}]` : '';
        return `Turn ${turnNumber} - ${turn.speaker}${sentiment}${intent}: "${turn.text}"`;
      })
      .join('\n');

    const conversationSummary = {
      totalTurns: turns.length,
      agentTurns: turns.filter((t: ConversationTurn) => t.speaker === 'agent').length,
      customerTurns: turns.filter((t: ConversationTurn) => t.speaker === 'customer').length,
      duration: Date.now() - conversation.callStartTime,
      previousTipCount: conversation.tipHistory?.length || 0
    };
    try {

      const tipData = await openaiService.generateCoachingTip({
        conversationHistory: turns,
        fullConversation,
        recentCustomerText: lastCustomerTurn.text,
        previousTips: conversation.tipHistory || [],
        callSid,
        timestamp: new Date().toISOString(),
        analytics: {
          ...analytics,
          conversationSummary
        }
      });

      return {
        id: `tip_${callSid}_${Date.now()}`,
        tip: tipData.tip,
        urgency: tipData.urgency,
        suggestedScript: tipData.suggested_script,
        reasoning: `${tipData.reasoning} (Based on ${turns.length} conversation turns + ${conversation.tipHistory?.length || 0} previous tips)`,
        callSid,
        timestamp: new Date().toISOString(),
        conversationStage: analytics.conversationStage,
        sentiment: tipData.sentiment
      };
      
    } catch (error) {
      console.error('Error generating tip:', error);
      return null;
    }
  }

  getCallAnalytics(callSid: string) {
    const conversation = this.tracker.getConversation(callSid);
    return conversation?.analytics;
  }

  getIncrementalReportStatus(callSid: string) {
    const conversation = this.tracker.getConversation(callSid);
    if (!conversation) return null;
    
    return {
      totalTurns: conversation.turns.length,
      lastReportTurnCount: conversation.lastReportTurnCount,
      incrementalReportsCount: conversation.incrementalReports.length,
      hasRemainingTurns: conversation.lastReportTurnCount < conversation.turns.length
    };
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
      insights.push('Seller is engaged - good time to move toward making an offer');
    }

    if (analytics.riskFactors.length > 2) {
      insights.push('Multiple risk factors detected - focus on addressing seller concerns');
    }

    if (analytics.opportunities.some((op: string) => op.includes('motivated') || op.includes('distress'))) {
      insights.push('Motivated seller detected - emphasize quick cash solutions');
    }

    return insights;
  }

  endCall(callSid: string) {
    return this.tracker.endCall(callSid);
  }

  initializeCall(callSid: string, customerData?: any) {
    return this.tracker.initializeCall(callSid, customerData);
  }
}

export const coachingService = new EnhancedCoachingService();