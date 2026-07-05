-- Customer: agregar cédula (cc) e intercambiar el índice único (por cc en vez de name)
ALTER TABLE "Customer" ADD COLUMN "cc" TEXT;
DROP INDEX "Customer_kioskId_name_key";
CREATE UNIQUE INDEX "Customer_kioskId_cc_key" ON "Customer"("kioskId", "cc");

-- Sale: número de crédito secuencial
ALTER TABLE "Sale" ADD COLUMN "creditNumber" INTEGER;

-- CreateTable
CREATE TABLE "SalesRecord" (
    "id" SERIAL NOT NULL,
    "kioskId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesRecordItem" (
    "id" SERIAL NOT NULL,
    "recordId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "cashQty" INTEGER NOT NULL DEFAULT 0,
    "creditQty" INTEGER NOT NULL DEFAULT 0,
    "customerCc" TEXT,
    "customerName" TEXT,
    "dueDate" TIMESTAMP(3),

    CONSTRAINT "SalesRecordItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SalesRecord" ADD CONSTRAINT "SalesRecord_kioskId_fkey" FOREIGN KEY ("kioskId") REFERENCES "Kiosk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesRecordItem" ADD CONSTRAINT "SalesRecordItem_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "SalesRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesRecordItem" ADD CONSTRAINT "SalesRecordItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
