-- El modelo de líneas del registro de ventas cambia (cashQty/creditQty -> qty/kind)
-- para permitir varios clientes a crédito por producto. Se limpian los borradores
-- previos (datos incompatibles y aún no aprobados).
DELETE FROM "SalesRecord";
DROP TABLE "SalesRecordItem";

CREATE TABLE "SalesRecordItem" (
    "id" SERIAL NOT NULL,
    "recordId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 0,
    "kind" TEXT NOT NULL DEFAULT 'CASH',
    "customerCc" TEXT,
    "customerName" TEXT,
    "dueDate" TIMESTAMP(3),

    CONSTRAINT "SalesRecordItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SalesRecordItem" ADD CONSTRAINT "SalesRecordItem_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "SalesRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesRecordItem" ADD CONSTRAINT "SalesRecordItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
