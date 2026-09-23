// what do : //server create krna 
            //server config krna 
            //instnace create not start here 

const express = require("express")

const cookieParser = require("cookie-parser")

const authRouter = require("./routes/auth.routes")
const accountRouter = require("./routes/account.routes")
const transactionRouter = require("./routes/transaction.routes")

const app = express()
app.use(express.json()) 
//as a middleware kyuki exress nhi pdh skta hai 
app.use(cookieParser())

app.get('/', (req, res) => {
    res.status(200).json({
        message: "Backend Ledger API is running successfully!",
        status: "active"
    })
})

app.use('/api/auth', authRouter)
app.use('/api/account', accountRouter)
app.use('/api/transaction', transactionRouter)

module.exports = app