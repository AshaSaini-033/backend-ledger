const mongoose = require("mongoose")
const bcrypt = require('bcryptjs')

const userSchema = mongoose.Schema({
    email: {
        type: String,
        required: [true, "Email is required for creating user"],
        trim: true,
        lowercase: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid Email Address"],
        unique: [true, "Email Already exists"]
    },
    name: {
        type: String,
        required: [true, "Name is required for creating an account"]
    },
    password: {
        type: String,
        required: [true, "Password is required for creating account"],
        minlength: [6, "password should be contains 6 character"],
        select: false
    },
    systemUser: {
        type: Boolean,
        default: false,
        immutable: true,
        select: false
    }
}, {
    timestamps: true
})

userSchema.pre("save", async function () {
    if (!this.isModified("password")) {
        return
    }
    const hash = await bcrypt.hash(this.password, 10)
    this.password = hash
})

userSchema.methods.comparePassword = async function (password) {
    return bcrypt.compare(password, this.password)
}

const userModel = mongoose.model("user", userSchema)
module.exports = userModel