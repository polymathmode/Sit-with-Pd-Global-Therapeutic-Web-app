-- Per-user module completions (frontend calls complete endpoint when learner finishes a module).
CREATE TABLE "program_module_completions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "program_module_completions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "program_module_completions_userId_moduleId_key" ON "program_module_completions"("userId", "moduleId");
CREATE INDEX "program_module_completions_userId_idx" ON "program_module_completions"("userId");
CREATE INDEX "program_module_completions_moduleId_idx" ON "program_module_completions"("moduleId");

ALTER TABLE "program_module_completions" ADD CONSTRAINT "program_module_completions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "program_module_completions" ADD CONSTRAINT "program_module_completions_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "program_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "purchases" ADD COLUMN "programCompletedAt" TIMESTAMP(3);
