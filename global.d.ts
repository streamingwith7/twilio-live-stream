import { Server } from 'socket.io'

declare global {
  var io: Server | undefined
  var currentCallSid: string | undefined
} 