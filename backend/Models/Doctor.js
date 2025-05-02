const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const doctorSchema = new mongoose.Schema({
  // Personal Information
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true, minlength: 6 },
  phoneNumber: { type: String, required: true, trim: true },
  specialization: { type: String, required: true, trim: true },
  hospitalOrClinicName: { type: String, required: true, trim: true },
  address: { type: String, required: true, trim: true },
  city: { type: String, required: true, trim: true },
  state: { type: String, required: true, trim: true },
  zipCode: { type: String, required: true, trim: true },
  country: { type: String, required: true, trim: true },

  // Availability and Appointment Information
  availability: [
    {
      day: { type: String},
      date: { type: String },
      startTime: { type: String, required: true },
      endTime: { type: String, required: true },
    },
  ],

  // Appointments
  appointments: [
    {
      patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Change 'Patient' to 'User'
        required: true,
      },
      appointmentDate: { type: Date, required: true },
      appointmentTime: { type: String, required: true },
      status: { type: String, enum: ['Scheduled', 'Completed', 'Cancelled'], default: 'Scheduled' },
    },
  ],

  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Hash password before saving
doctorSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// Method to compare password for login
doctorSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const Doctor = mongoose.model('Doctor', doctorSchema);

module.exports = Doctor;
