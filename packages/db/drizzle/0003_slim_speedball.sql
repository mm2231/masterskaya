ALTER TABLE `orders` ADD `prepayment_cost` real;
--> statement-breakpoint
-- Снимок себестоимости для уже принятых с предоплатой: на момент
-- миграции затраты считаются учтёнными в текущем периоде предоплаты.
UPDATE `orders` SET `prepayment_cost` = `cost_total`
WHERE `prepayment` > 0 AND `prepayment_cost` IS NULL AND `status` <> 'issued';
