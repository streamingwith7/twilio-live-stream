-- CreateTable
CREATE TABLE "call_records" (
    "id" TEXT NOT NULL,
    "callSid" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "fromNumber" TEXT NOT NULL,
    "toNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "duration" INTEGER,
    "recordingUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "call_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_transcriptions" (
    "id" TEXT NOT NULL,
    "callRecordId" TEXT NOT NULL,
    "speaker" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startTime" DOUBLE PRECISION,
    "endTime" DOUBLE PRECISION,

    CONSTRAINT "call_transcriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_reports" (
    "id" TEXT NOT NULL,
    "callSid" TEXT NOT NULL,
    "reportData" JSONB NOT NULL,
    "totalTurns" INTEGER,
    "totalTips" INTEGER,
    "usedTips" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "call_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "call_records_callSid_key" ON "call_records"("callSid");

-- CreateIndex
CREATE UNIQUE INDEX "call_reports_callSid_key" ON "call_reports"("callSid");

-- AddForeignKey
ALTER TABLE "call_transcriptions" ADD CONSTRAINT "call_transcriptions_callRecordId_fkey" FOREIGN KEY ("callRecordId") REFERENCES "call_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
