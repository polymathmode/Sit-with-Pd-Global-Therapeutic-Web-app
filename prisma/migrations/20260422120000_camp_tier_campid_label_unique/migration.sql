-- One participation label per camp (e.g. a single "Individual" tier).
CREATE UNIQUE INDEX "camp_tiers_campId_label_key" ON "camp_tiers"("campId", "label");
