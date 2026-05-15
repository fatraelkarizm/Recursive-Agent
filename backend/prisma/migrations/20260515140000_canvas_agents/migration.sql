-- CreateTable
CREATE TABLE "canvas_agents" (
    "id" TEXT NOT NULL,
    "missionId" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "profileJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canvas_agents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "canvas_agents_createdAt_idx" ON "canvas_agents"("createdAt");
