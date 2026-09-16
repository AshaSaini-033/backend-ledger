const express = require("express")
const authMiddleware = require("../middelware/auth.middleware")
const accountController = require('../controllers/account.controller')

const router = express.Router()

// POST /api/account/ - Create a new account
router.post("/", authMiddleware.authMiddleware, accountController.createAccountController)

// GET /api/account/ - Get all user accounts
router.get("/", authMiddleware.authMiddleware, accountController.getUserAccountsController)

// GET /api/account/balance - Get balance for logged-in user
router.get('/balance', authMiddleware.authMiddleware, accountController.getAccountBalanceController)

// GET /api/account/balance/:accountId - Get balance by Account ID or User ID
router.get('/balance/:accountId', authMiddleware.authMiddleware, accountController.getAccountBalanceController)

module.exports = router