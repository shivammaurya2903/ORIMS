-- AlterTable
ALTER TABLE `optimizationrecommendation` ADD COLUMN `riskLevel` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `OptimizationRecommendation_riskLevel_idx` ON `OptimizationRecommendation`(`riskLevel`);
