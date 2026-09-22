-- ============================================================
-- Umbral de reorden por producto, para alertas de inventario bajo
-- ============================================================

alter table products add column if not exists reorder_point integer;