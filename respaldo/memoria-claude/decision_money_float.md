---
name: decision-money-float
description: Por qué el dinero se guarda como Float y no se migró a Decimal
metadata: 
  node_type: memory
  type: project
  originSessionId: dcb01897-6d09-42a0-9949-3eb12abf864f
---

Los campos monetarios (cost, price, total, unitPrice, unitCost, amount) se dejan como `Float` en el esquema Prisma a propósito.

**Why:** La moneda es peso colombiano (COP), que en la práctica no usa centavos — todos los precios son enteros (3000, 5000, 214500...). Float64 representa enteros de forma exacta hasta 2^53, así que no hay error de redondeo real. Migrar a `Decimal` obligaría a reescribir toda la aritmética de los servicios (`.plus()`, `.minus()`, `.times()`) y devolvería strings al frontend (rompiendo el formateo `$`), con alto riesgo sobre una BD en producción y beneficio nulo.

**How to apply:** No re-recomendar migrar dinero a Decimal en revisiones futuras salvo que el negocio empiece a manejar centavos o divisiones fraccionarias. Los checks defensivos `> 0.0001` en [[.]] sale.service son inofensivos y pueden quedarse.
