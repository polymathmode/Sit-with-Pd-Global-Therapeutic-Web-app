-- One Cal.com event type maps to at most one consultation service (multiple NULLs still allowed).
-- If this fails, remove or reassign duplicate non-null calEventTypeId values first.

CREATE UNIQUE INDEX "consultation_services_calEventTypeId_key" ON "consultation_services"("calEventTypeId");
