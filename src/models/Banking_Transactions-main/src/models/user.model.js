const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcryptjs");
const userSchema = new mongoose.Schema({

    email:{
        type :String,
        required :[true , "Email is required for Creating User.."],
        trim :true ,
        lowercase :true,
        validate :{
            validator : validator.isEmail ,
            message : "Please Enter A Valid Email."
        },
        unique : [true , "Email Already Exists."]
    },
    name : {
        type : String , 
        required : [true , "Name is required to creating a account."]
    },
    password :{
        type:String ,
        required : [true , "Password required to creating an user."],
        minlength : [6 ,"Password should be at least 6 char" ],
        select : false
    },
    systemUser:{
        type: Boolean,
        default:false,
        immutable:true,
        select:false
    }

},
{
timestamps: true }


);

userSchema.pre("save", async function () {

    if (!this.isModified("password")) {
        return;
    }

    const hash = await bcrypt.hash(this.password, 10); 
    this.password = hash;
});

userSchema.methods.comparePassword = async function(password){

    return await bcrypt.compare(password , this.password);
}

const userModel = mongoose.model("user" , userSchema);

module.exports = userModel;