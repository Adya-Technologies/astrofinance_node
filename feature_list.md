# AstroFinance System Feature List

This document provides a comprehensive list of features for the AstroFinance Financial Management System.

## 1. System Overview
A comprehensive Financial Management System designed for microfinance institutions, handling user management, loan processing, accounting, and financial reporting.

## 2. Technology Stack

### Backend
- **Framework**: Node.js with Express
- **Language**: TypeScript
- **Database**: PostgreSQL (via Prisma ORM)
- **Authentication**: JWT & BCrypt
- **Process Management**: Nodemon (Dev) / PM2 (Prod implied)
- **Validation**: Joi, Zod, Yup
- **Utilities**: PDFKit (Reports), ExcelJS (Exports), Multer (File Uploads)

### Frontend
- **Framework**: Next.js (React)
- **UI Library**: Chakra UI, Material UI, Headless UI
- **Styling**: Tailwind CSS, Emotion
- **State/Data Fetching**: React Query (TanStack Query)
- **Forms**: React Hook Form with Yup validation
- **Visualization**: Chart.js / React-Chartjs-2
- **Internationalization**: i18next
- **PWA Support**: Yes (@ducanh2912/next-pwa)

### Infrastructure
- **CI/CD**: Azure Pipelines
- **Containerization**: Docker (implied by devops folder presence)

---

## 3. Core Modules & Features

### 3.1 Admin Portal
Centralized control for system administration.
- **Dashboard**: Real-time stats, activity monitoring, alerts.
- **User Administration**: Manage admin users, roles, and permissions (RBAC).
- **System Configuration**: Global settings, module configs, localization.
- **Audit Trail**: Detailed logging of user activities and system events.

### 3.2 User Management (Client)
Management of customer/member accounts.
- **Registration & KYC**: New user signup, KYC document upload and verification.
- **Profile Management**: Update personal info, contacts, and documents.
- **Account Types**: Support for multiple account schemes (files indicate: Sadaran, Baal, Masik Bachat).
- **Search & Filtering**: Advanced user search and reporting capabilities.

### 3.3 Loan Module
End-to-end loan lifecycle management.
- **Product Configuration**: Define loan products, interest rates, fees, and eligibility.
- **Application Processing**: Loan application forms, document collection, and eligibility checks.
- **Workflow**: Review, approval, and disbursement workflows.
- **Servicing**: Repayment scheduling, tracking capabilities, and overdue management.
- **Closure**: Final settlement, closure documentation, and clearance.

### 3.4 Accounting & Finance
Double-entry bookkeeping and financial management.
- **Chart of Accounts**: Configurable hierarchy for assets, liabilities, income, and expenses.
- **Journal Entries**: Create, manage, and reverse journal entries.
- **Day Book**: Daily transaction logging and reconciliation.
- **Financial Reporting**:
    - Balance Sheet
    - Trial Balance
    - Income Statement
    - Financial Ratios
- **Transaction Tallying**: Daily and periodic audit/tallying features.

### 3.5 Expense Tracking
Operational expense management.
- **Categorization**: Hierarchical expense categories.
- **Recording**: Entry of expenses with receipt attachments.
- **Budgeting**: Budget definition and variance analysis.
- **Approval Workflow**: Multi-level approval for expenses.
- **Reporting**: Expense analysis and trend visualization.

### 3.6 Tax Calculation
Tax compliance and reporting.
- **Configuration**: manage tax rates and rules.
- **TDS Management**: Tax Deducted at Source calculations and adjustments.
- **Reporting**: Tax certificates and regulatory reports.

### 3.7 SMS & Notifications
Automated communication system.
- **SMS Gateway**: Integration for sending transactional SMS.
- **Templates**: Manage notification templates with dynamic variables.
- **Event Triggers**: Automated alerts based on system events (e.g., payment due).
- **History**: Tracking of sent notifications and delivery status.

### 3.8 Reporting & Documents
- **Generation**: PDF and Excel export for all major data sets.
- **Printing**: Specialized print layouts for receipts and reports.
- **Scheduling**: Automated report generation and delivery.

## 4. Advanced Features

### 4.1 Offline Field Operations (PWA)
Full support for field agents to operate without internet connectivity.
- **Offline Storage**: Uses **IndexedDB** (via Dexie.js) to store centers, groups, and client data locally.
- **Local Transactions**: Record collections, loan repayments, and savings deposits while offline.
- **Synchronization**: Two-way sync mechanism:
    - **Download**: Fetch latest roster and balances when online.
    - **Upload**: Bulk upload of offline transactions and attendance records pending sync.
- **Conflict Resolution**: Logic to handle duplicate entries or state mismatches (displayed in sync history).

### 4.2 Multi-Language Support (i18n)
Built-in internationalization for broader accessibility.
- **Languages**: 
    - **English** (default)
    - **Nepali** (local)
- **Framework**: Powered by `next-i18next` with seamless switching.
- **Scope**: Translations cover UI elements, forms, transaction receipts, and reports.
