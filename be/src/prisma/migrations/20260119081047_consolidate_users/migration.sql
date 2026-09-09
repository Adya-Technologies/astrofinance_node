/*
  Warnings:

  - You are about to drop the `admin_user_roles` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `admin_users` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[username]` on the table `staff` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "admin_user_roles" DROP CONSTRAINT "admin_user_roles_adminUserId_fkey";

-- DropForeignKey
ALTER TABLE "admin_user_roles" DROP CONSTRAINT "admin_user_roles_roleId_fkey";

-- DropForeignKey
ALTER TABLE "budgets" DROP CONSTRAINT "budgets_approvedById_fkey";

-- DropForeignKey
ALTER TABLE "budgets" DROP CONSTRAINT "budgets_createdById_fkey";

-- DropForeignKey
ALTER TABLE "day_book" DROP CONSTRAINT "day_book_closedById_fkey";

-- DropForeignKey
ALTER TABLE "day_book_transactions" DROP CONSTRAINT "day_book_transactions_createdById_fkey";

-- DropForeignKey
ALTER TABLE "loan_applications" DROP CONSTRAINT "loan_applications_approvedById_fkey";

-- DropForeignKey
ALTER TABLE "loan_documents" DROP CONSTRAINT "loan_documents_verifiedById_fkey";

-- DropForeignKey
ALTER TABLE "loan_payments" DROP CONSTRAINT "loan_payments_receivedById_fkey";

-- DropForeignKey
ALTER TABLE "report_templates" DROP CONSTRAINT "report_templates_createdById_fkey";

-- DropForeignKey
ALTER TABLE "setting_audit_logs" DROP CONSTRAINT "setting_audit_logs_changedById_fkey";

-- DropForeignKey
ALTER TABLE "share_certificates" DROP CONSTRAINT "share_certificates_issuedById_fkey";

-- DropForeignKey
ALTER TABLE "share_transactions" DROP CONSTRAINT "share_transactions_createdById_fkey";

-- DropForeignKey
ALTER TABLE "system_settings" DROP CONSTRAINT "system_settings_updatedById_fkey";

-- DropForeignKey
ALTER TABLE "tax_certificates" DROP CONSTRAINT "tax_certificates_generatedById_fkey";

-- DropForeignKey
ALTER TABLE "tds_exemptions" DROP CONSTRAINT "tds_exemptions_verifiedById_fkey";

-- DropForeignKey
ALTER TABLE "user_account_statements" DROP CONSTRAINT "user_account_statements_generatedById_fkey";

-- DropForeignKey
ALTER TABLE "user_account_transactions" DROP CONSTRAINT "user_account_transactions_performedById_fkey";

-- DropForeignKey
ALTER TABLE "user_accounts" DROP CONSTRAINT "user_accounts_createdById_fkey";

-- AlterTable
ALTER TABLE "staff" ADD COLUMN     "passwordChangedAt" TIMESTAMP(3),
ADD COLUMN     "passwordResetExpires" TIMESTAMP(3),
ADD COLUMN     "passwordResetToken" TEXT,
ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twoFactorSecret" TEXT,
ADD COLUMN     "username" TEXT;

-- DropTable
DROP TABLE "admin_user_roles";

-- DropTable
DROP TABLE "admin_users";

-- CreateIndex
CREATE UNIQUE INDEX "staff_username_key" ON "staff"("username");

-- AddForeignKey
ALTER TABLE "user_accounts" ADD CONSTRAINT "user_accounts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_account_transactions" ADD CONSTRAINT "user_account_transactions_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_account_statements" ADD CONSTRAINT "user_account_statements_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_payments" ADD CONSTRAINT "loan_payments_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_documents" ADD CONSTRAINT "loan_documents_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "day_book" ADD CONSTRAINT "day_book_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "day_book_transactions" ADD CONSTRAINT "day_book_transactions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tds_exemptions" ADD CONSTRAINT "tds_exemptions_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_certificates" ADD CONSTRAINT "tax_certificates_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_templates" ADD CONSTRAINT "report_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_transactions" ADD CONSTRAINT "share_transactions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_certificates" ADD CONSTRAINT "share_certificates_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "setting_audit_logs" ADD CONSTRAINT "setting_audit_logs_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
