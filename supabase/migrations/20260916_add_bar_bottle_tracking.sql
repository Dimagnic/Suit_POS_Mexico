-- ============================================================
-- Columnas para control de botellas en el giro "bar"
-- ============================================================

alter table products add column if not exists ml_total numeric(10,2);

alter table table_order_items
  add column if not exists bottle_status text
    check (bottle_status in ('sellada', 'abierta', 'vacia'));

alter table table_order_items
  add column if not exists ml_restante numeric(10,2);