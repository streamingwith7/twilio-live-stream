import { Server } from 'socket.io'

declare global {
  var io: Server | undefined
  var currentCallSid: string | undefined
  var callStateTracker: Map<string, {
    customerData?: any;
    callStartTime: number;
    stage: string;
    isOutboundCall?: boolean;
    from?: string;
    to?: string;
  }> | undefined
} 