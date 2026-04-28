-- Make StandardSize replaceable by width/height instead of relying on ad hoc IDs.
CREATE UNIQUE INDEX "StandardSize_width_height_key" ON "StandardSize"("width", "height");
