const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");

const AccountController = require("../controllers/account.controller");


// POST - api/accounts/    create a new account

router.post("/create" , authMiddleware.authMiddleware , AccountController.createAccountController);



/**
 * 
 * -GET /api/accounts
 * - Get all accounts of the logged-in user
 * -Protected route
 */


router.get("/" , authMiddleware.authMiddleware , AccountController.getuserAccountsController);


/**
 * 
 * -GET /api/accounts/balance/:account_id
 * - Get balance of the logged-in user
 * -Protected route
 */

router.get("/balance/:accountId" , authMiddleware.authMiddleware , AccountController.getuserAccountsBalanceController);


module.exports = router;