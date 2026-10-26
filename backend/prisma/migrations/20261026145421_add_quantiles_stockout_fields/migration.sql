-- AlterTable
ALTER TABLE `forecast` ADD COLUMN `daysOfSupply` DOUBLE NULL,
    ADD COLUMN `predictedDemandP50` DOUBLE NULL,
    ADD COLUMN `predictedDemandP90` DOUBLE NULL,
    ADD COLUMN `predictedDemandP95` DOUBLE NULL,
    ADD COLUMN `stockoutProbability` DOUBLE NULL,
    ADD COLUMN `stockoutRiskLevel` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `optimizationrecommendation` ADD COLUMN `daysOfSupply` DOUBLE NULL,
    ADD COLUMN `reorderPoint` INTEGER NULL,
    ADD COLUMN `stockoutProbability` DOUBLE NULL;
