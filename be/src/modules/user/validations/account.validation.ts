import { body, param, query } from "express-validator";

/**
 * Validation schema for creating a user account
 */
export const createAccountValidation = [
	body("userId")
		.notEmpty()
		.withMessage("User ID is required")
		.isUUID()
		.withMessage("User ID must be a valid UUID"),

	body("accountType")
		.notEmpty()
		.withMessage("Account type is required")
		.isString()
		.withMessage("Account type must be a string"),
	body("interestRate")
		.notEmpty()
		.withMessage("Interest rate is required")
		.isFloat({ min: 0, max: 100 })
		.withMessage("Interest rate must be between 0 and 100"),

	body("openingDate")
		.optional()
		.isISO8601()
		.withMessage("Opening date must be a valid date"),

	body("balance")
		.optional()
		.isFloat({ min: 0 })
		.withMessage("Balance must be a positive number"),

	// BB Account specific fields
	body("bbAccountDetails")
		.optional()
		.isObject()
		.withMessage("BB account details must be an object"),

	body("bbAccountDetails.guardianName")
		.if(body("bbAccountDetails").exists())
		.notEmpty()
		.withMessage("Guardian name is required for BB accounts")
		.isLength({ min: 3, max: 100 })
		.withMessage("Guardian name must be between 3 and 100 characters"),

	body("bbAccountDetails.guardianRelation")
		.if(body("bbAccountDetails").exists())
		.notEmpty()
		.withMessage("Guardian relation is required for BB accounts")
		.isLength({ max: 50 })
		.withMessage("Guardian relation cannot exceed 50 characters"),

	body("bbAccountDetails.guardianContact")
		.if(body("bbAccountDetails").exists())
		.notEmpty()
		.withMessage("Guardian contact is required for BB accounts")
		.matches(/^\+?[0-9]{10,15}$/)
		.withMessage("Guardian contact must be a valid phone number"),

	body("bbAccountDetails.guardianIdType")
		.if(body("bbAccountDetails").exists())
		.notEmpty()
		.withMessage("Guardian ID type is required for BB accounts")
		.isIn(["NATIONAL_ID", "PASSPORT", "DRIVING_LICENSE", "OTHER"])
		.withMessage(
			"Guardian ID type must be one of: NATIONAL_ID, PASSPORT, DRIVING_LICENSE, OTHER",
		),

	body("bbAccountDetails.guardianIdNumber")
		.if(body("bbAccountDetails").exists())
		.notEmpty()
		.withMessage("Guardian ID number is required for BB accounts")
		.isLength({ max: 50 })
		.withMessage("Guardian ID number cannot exceed 50 characters"),

	body("bbAccountDetails.maturityDate")
		.if(body("bbAccountDetails").exists())
		.optional()
		.isISO8601()
		.withMessage("Maturity date must be a valid date"),

	// MB Account specific fields
	body("mbAccountDetails")
		.optional()
		.isObject()
		.withMessage("MB account details must be an object"),

	body("mbAccountDetails.monthlyDepositAmount")
		.if(body("mbAccountDetails").exists())
		.notEmpty()
		.withMessage("Monthly deposit amount is required for MB accounts")
		.isFloat({ min: 0 })
		.withMessage("Monthly deposit amount must be a positive number"),

	body("mbAccountDetails.depositDay")
		.if(body("mbAccountDetails").exists())
		.notEmpty()
		.withMessage("Deposit day is required for MB accounts")
		.isInt({ min: 1, max: 31 })
		.withMessage("Deposit day must be between 1 and 31"),

	body("mbAccountDetails.termMonths")
		.if(body("mbAccountDetails").exists())
		.notEmpty()
		.withMessage("Term months is required for MB accounts")
		.isInt({ min: 1 })
		.withMessage("Term months must be a positive integer"),

	body("mbAccountDetails.maturityDate")
		.if(body("mbAccountDetails").exists())
		.notEmpty()
		.withMessage("Maturity date is required for MB accounts")
		.isISO8601()
		.withMessage("Maturity date must be a valid date"),
];

/**
 * Validation schema for updating a user account
 */
export const updateAccountValidation = [
	param("id")
		.notEmpty()
		.withMessage("Account ID is required")
		.isUUID()
		.withMessage("Account ID must be a valid UUID"),

	body("interestRate")
		.optional()
		.isFloat({ min: 0, max: 100 })
		.withMessage("Interest rate must be between 0 and 100"),

	body("status")
		.optional()
		.isIn(["ACTIVE", "INACTIVE", "CLOSED", "FROZEN"])
		.withMessage("Status must be one of: ACTIVE, INACTIVE, CLOSED, FROZEN"),

	// BB Account specific fields
	body("bbAccountDetails")
		.optional()
		.isObject()
		.withMessage("BB account details must be an object"),

	body("bbAccountDetails.guardianName")
		.if(body("bbAccountDetails").exists())
		.optional()
		.isLength({ min: 3, max: 100 })
		.withMessage("Guardian name must be between 3 and 100 characters"),

	body("bbAccountDetails.guardianRelation")
		.if(body("bbAccountDetails").exists())
		.optional()
		.isLength({ max: 50 })
		.withMessage("Guardian relation cannot exceed 50 characters"),

	body("bbAccountDetails.guardianContact")
		.if(body("bbAccountDetails").exists())
		.optional()
		.matches(/^\+?[0-9]{10,15}$/)
		.withMessage("Guardian contact must be a valid phone number"),

	body("bbAccountDetails.guardianIdType")
		.if(body("bbAccountDetails").exists())
		.optional()
		.isIn(["NATIONAL_ID", "PASSPORT", "DRIVING_LICENSE", "OTHER"])
		.withMessage(
			"Guardian ID type must be one of: NATIONAL_ID, PASSPORT, DRIVING_LICENSE, OTHER",
		),

	body("bbAccountDetails.guardianIdNumber")
		.if(body("bbAccountDetails").exists())
		.optional()
		.isLength({ max: 50 })
		.withMessage("Guardian ID number cannot exceed 50 characters"),

	body("bbAccountDetails.maturityDate")
		.if(body("bbAccountDetails").exists())
		.optional()
		.isISO8601()
		.withMessage("Maturity date must be a valid date"),

	// MB Account specific fields
	body("mbAccountDetails")
		.optional()
		.isObject()
		.withMessage("MB account details must be an object"),

	body("mbAccountDetails.monthlyDepositAmount")
		.if(body("mbAccountDetails").exists())
		.optional()
		.isFloat({ min: 0 })
		.withMessage("Monthly deposit amount must be a positive number"),

	body("mbAccountDetails.depositDay")
		.if(body("mbAccountDetails").exists())
		.optional()
		.isInt({ min: 1, max: 31 })
		.withMessage("Deposit day must be between 1 and 31"),

	body("mbAccountDetails.termMonths")
		.if(body("mbAccountDetails").exists())
		.optional()
		.isInt({ min: 1 })
		.withMessage("Term months must be a positive integer"),

	body("mbAccountDetails.maturityDate")
		.if(body("mbAccountDetails").exists())
		.optional()
		.isISO8601()
		.withMessage("Maturity date must be a valid date"),
];

/**
 * Validation schema for getting user accounts
 */
export const getUserAccountsValidation = [
	param("userId")
		.notEmpty()
		.withMessage("User ID is required")
		.isUUID()
		.withMessage("User ID must be a valid UUID"),

	query("accountType")
		.optional()
		.isString()
		.withMessage("Account type must be a string"),

	query("status")
		.optional()
		.isIn(["ACTIVE", "INACTIVE", "CLOSED", "FROZEN"])
		.withMessage("Status must be one of: ACTIVE, INACTIVE, CLOSED, FROZEN"),

	query("page")
		.optional()
		.isInt({ min: 1 })
		.withMessage("Page must be a positive integer"),

	query("limit")
		.optional()
		.isInt({ min: 1, max: 100 })
		.withMessage("Limit must be between 1 and 100"),
];

/**
 * Validation schema for getting account by ID
 */
export const getAccountByIdValidation = [
	param("id")
		.notEmpty()
		.withMessage("Account ID is required")
		.isUUID()
		.withMessage("Account ID must be a valid UUID"),
];
