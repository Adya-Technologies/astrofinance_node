import dotenv from "dotenv";

// Load environment variables first, before any other imports
dotenv.config();

import express, { type Express } from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import prisma from "./config/database";
import logger from "./config/logger";
import { errorHandler, notFound } from "./common/middleware/error.middleware";

// Import routes
import adminRoutes from "./modules/admin/routes";
import userRoutes from "./modules/user/routes";
import usersRoutes from "./modules/user/routes/users.routes"; // Import the new users routes
import accountsRoutes from "./modules/user/routes/accounts.routes"; // Import the accounts routes
import staffRoutes from "./modules/staff/routes";
import officeRoutes from "./modules/office/routes";
import loanRoutes from "./modules/loan/routes";
import accountingRoutes from "./modules/accounting/routes";
import expenseRoutes from "./modules/expense/routes";
import taxRoutes from "./modules/tax/routes";
import notificationRoutes from "./modules/notification/routes";
import reportRoutes from "./modules/report/routes";
import shareRoutes from "./modules/share/routes/share.routes";
import systemRoutes from "./modules/system/routes";
import centerRoutes from "./modules/center/center.routes";
import groupRoutes from "./modules/group/group.routes";
import syncRoutes from "./modules/sync/sync.routes";
import dashboardRoutes from "./modules/dashboard/dashboard.routes";

// Create Express app
const app: Express = express();
const port = process.env.PORT || 5000;

// Check critical environment variables
if (!process.env.JWT_SECRET) {
	logger.error(
		"JWT_SECRET environment variable is not set. Authentication will fail!",
	);
}

// Log environment mode
logger.info(`Server starting in ${process.env.NODE_ENV} mode`);

// Middleware
const corsOptions =
	process.env.NODE_ENV === "production"
		? {
			origin: ["http://82.180.144.91:4000", "http://82.180.144.91:3000"],
			methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
			credentials: true,
		}
		: {
			origin: ["http://localhost:3000", "http://127.0.0.1:3000", "http://82.180.144.91:3000", "http://82.180.144.91:4000"],
			methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
			credentials: true,
		};

app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Serve static files from uploads directory
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Basic route
app.get("/", (req, res) => {
	res.json({ message: "Welcome to AstroFinance API" });
});

// Health check route
app.get("/health", (req, res) => {
	res.json({ status: "ok", timestamp: new Date() });
});

// API routes
app.use("/api/admin", adminRoutes);
app.use("/api/user", userRoutes);
app.use("/api/users", usersRoutes); // Add the new users route
app.use("/api/accounts", accountsRoutes); // Add the accounts route
app.use("/api/staff", staffRoutes);
app.use("/api/office", officeRoutes); // New unified office routes
app.use("/api/loan", loanRoutes);
app.use("/api/accounting", accountingRoutes);
app.use("/api/expense", expenseRoutes);
app.use("/api/tax", taxRoutes);
app.use("/api/notification", notificationRoutes);
app.use("/api/report", reportRoutes);
app.use("/api/share", shareRoutes);
app.use("/api/system", systemRoutes);
app.use("/api/centers", centerRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/sync", syncRoutes);
app.use("/api/dashboard", dashboardRoutes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Start server
app.listen(port, () => {
	logger.info(`Server is running on port ${port}`);
});

// Handle shutdown gracefully
process.on("SIGINT", async () => {
	await prisma.$disconnect();
	logger.info("Disconnected from database");
	process.exit(0);
});

export default app;
