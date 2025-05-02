const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User } = require("../Models/User");
const Doctor = require("../Models/Doctor");
const mongoose = require("mongoose");
const router = express.Router();

// Register Route
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    console.log(name, email, password); 

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error or database error", error: error.message });
  }
});

// Login Route
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    // Generate token
    const token = jwt.sign({ id: user._id }, "secretKey", { expiresIn: "7d" });

    res.status(200).json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

const isValidDate = (dateString) => {
  return !isNaN(Date.parse(dateString));
};

router.post("/book-appointment", async (req, res) => {
  try {
    const { userId, doctorId, appointmentDate, appointmentTime,appointmentday } = req.body;

    if (!userId || !doctorId || !appointmentDate || !appointmentTime ) {
      return res.status(400).json({ message: "All fields are required." });
    }

    if (!isValidDate(appointmentDate)) {
      return res.status(400).json({ message: "Invalid appointment date format." });
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const newAppointment = {
      patientId: userId,
      appointmentday: appointmentday,
      appointmentDate: new Date(appointmentDate), // Ensure it's stored as a proper date
      appointmentTime,
      status: "Scheduled",
    };

    doctor.appointments.push(newAppointment);
    await doctor.save();

    res.status(201).json({ message: "Appointment booked successfully.", appointment: newAppointment });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
