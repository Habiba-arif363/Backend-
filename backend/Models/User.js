const mongoose = require("mongoose");




const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    age: { type: Number,  },
    phoneNumber: { type: String,  },
    gender: { type: String, enum: ["Male", "Female", "Other"],  },
    height: { type: Number,  }, // in cm
    weight: { type: Number,  }, // in kg
    bmi: { type: Number }, // calculated field
    diabetesType: { type: String, enum: ["Type 1", "Type 2", "None"], default: "None" },
    healthcareProviderId: { type: String }, 
    createdAt: { type: Date, default: Date.now },
  });






  exports.User = mongoose.model("User", userSchema);
