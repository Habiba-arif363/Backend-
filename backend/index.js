const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const dotenv = require("dotenv");
const authRoutes = require("./routes/auth");
const mongoose = require("mongoose");
const Doctor = require("./Models/Doctor");
const {User} = require("./Models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

dotenv.config();
console.log('JWT_SECRET:', process.env.JWT_SECRET);
const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require('@google/generative-ai');
const { GoogleAIFileManager } = require('@google/generative-ai/server');
const { stat } = require('fs');

const app = express();
const port = 5000;
const corsOptions = {
    origin: '*', // Allow all origins. Replace with a specific domain if needed (e.g., 'https://example.com')
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed HTTP methods
    allowedHeaders: ['Content-Type', 'Authorization'], // Allowed headers
  };
  
  // Use CORS middleware
  app.use(cors(corsOptions));
  app.use(express.json());
app.use(express.urlencoded({ extended: true }));



mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.error(err));

  
  

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Save files in the 'uploads' folder
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname); // Unique filename
  },
});

const upload = multer({ 
    storage, 
    limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
  }).single('report');
  
  // Error-handling middleware
  app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: err.message });
    }
    if (err) {
      return res.status(500).json({ error: 'An unknown error occurred' });
    }
    next();
  });
  


// Initialize Gemini AI
const apiKey = 'AIzaSyCF6v_u2konQzp-sQX2lS6dQ7ADzZ6VEvk'; // Replace with your Gemini API key
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash-exp',
  systemInstruction:
    'Suggest the SOPs and indicate the disease according to the medical report. Also, suggest diet plans and exercise plans.',
});

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
  responseMimeType: 'text/plain',
};

/**
 * Uploads the given file to Gemini.
 */
async function uploadToGemini(path, mimeType) {
  const uploadResult = await fileManager.uploadFile(path, {
    mimeType,
    displayName: path,
  });
  const file = uploadResult.file;
  console.log(`Uploaded file ${file.displayName} as: ${file.name}`);
  return file;
}

/**
 * Analyzes the uploaded medical report using Gemini AI.
 */
async function analyzeReport(filePath, mimeType) {
    console.log("============",filePath);
    try {
      const file = await uploadToGemini(filePath, mimeType);
  
      const chatSession = model.startChat({
        generationConfig,
        history: [
          {
            role: 'user',
            parts: [
              {
                fileData: {
                  mimeType: file.mimeType,
                  fileUri: file.uri,
                },
              },
            ],
          },
          {
            role: 'model',
            parts: [
              {
                text: 'Okay, let\'s analyze this medical report and provide insights on the disease, severity, SOPs, diet, and exercise plans.',
              },
            ],
          },
        ],
      });
  
      const result = await chatSession.sendMessage('Analyze the medical report.');
      console.log("============0",result);
      return result.response.text();
    } catch (error) {
      console.error('Error analyzing report:', error);
      throw new Error('Failed to analyze the report');
    }
  }
// Endpoint to handle file uploads
app.post('/upload', upload, async (req, res) => {
    
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const mimeType = req.file.mimetype;

    // Return the file details (for testing)
    res.json({
      message: 'File uploaded successfully',
      filePath,
      mimeType,
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload the file' });
  }
});


app.use("/api/auth", authRoutes);



// Endpoint to analyze the uploaded file
app.post('/analyze', upload, async (req, res) => {
    try {
      console.log("============",req.file);
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
  
      const filePath = req.file.path;
      const mimeType = req.file.mimetype;
  
  
      // Analyze the report using Gemini AI
      const analysisResult = await analyzeReport(filePath, mimeType);
      console.log("============",analysisResult);
  
      // Return the analysis result
      res.json({ 
        status: 'success',
        message: 'Report analyzed successfully',
        result: analysisResult });
    } catch (error) {
      console.error('Error processing file:', error);
      res.status(500).json({ error: error.message || 'Failed to process the file' });
    }
  });



  app.post('/api/doctors/signup', async (req, res) => {
    try {
      const {
        firstName,
        lastName,
        email,
        password,
        phoneNumber,
        specialization,
        hospitalOrClinicName,
        address,
        city,
        state,
        zipCode,
        country,
      } = req.body;
      
      // Check if doctor already exists
      const existingDoctor = await Doctor.findOne({ email });
      if (existingDoctor) {
        return res.status(400).json({ message: 'Doctor already exists' });
      }
  
      // Create new doctor
      const doctor = new Doctor({
        firstName,
        lastName,
        email,
        password,
        phoneNumber,
        specialization,
        hospitalOrClinicName,
        address,
        city,
        state,
        zipCode,
        country,
      });

  
      console.log(doctor);

      console.log("============",process.env.JWT_SECRET);
      await doctor.save();
      const token = jwt.sign({ id: doctor._id }, process.env.JWT_SECRET, {
        expiresIn: '1h',
      });
  
      res.status(201).json({ message: 'Doctor registered successfully', token });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: error });
    }
  });
  
  // Login API
  app.post('/api/doctors/login', async (req, res) => {
    try {
      const { email, password } = req.body;
  
      // Check if doctor exists
      const doctor = await Doctor.findOne({ email });
      if (!doctor) {
        return res.status(400).json({ message: 'Doctor not found' });
      }
  
      // Compare passwords
      const isMatch = await doctor.comparePassword(password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }
      console.log("Doctor ID:", doctor._id.toString());

  
      // Generate JWT token
      const token = jwt.sign({ id: doctor._id }, process.env.JWT_SECRET, {
        expiresIn: '1h',
      });
  
      res.status(200).json({ message: 'Login successful', token, id:  doctor._id.toString() });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  });



  // Add Availability API
app.post('/api/doctors/:doctorId/availability', async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { day,date, startTime, endTime } = req.body;

    // Find the doctor by ID
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Add availability to the doctor's schedule
    doctor.availability.push({ date, startTime, endTime, day });
    await doctor.save();

    res.status(201).json({ message: 'Availability added successfully', doctor });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});


app.get('/api/appointments', async (req, res) => {
  try {
    // Fetch all doctors with their appointments
    const doctors = await Doctor.find().populate('appointments.patientId', 'firstName lastName email phoneNumber');

    // Extract and format appointments
    const allAppointments = doctors.map(doctor => ({
      doctorId: doctor._id,
      doctorName: `${doctor.firstName} ${doctor.lastName}`,
      specialization: doctor.specialization,
      appointments: doctor.appointments.map(appointment => ({
        patientId: appointment.patientId?._id || null,
        patientName: appointment.patientId ? `${appointment.patientId.firstName} ${appointment.patientId.lastName}` : 'Unknown',
        appointmentDate: appointment.appointmentDate,
        appointmentTime: appointment.appointmentTime,
        status: appointment.status
      }))
    }));

    res.status(200).json({ message: 'Appointments fetched successfully', appointments: allAppointments });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/availabilities', async (req, res) => {
  try {
    // Fetch all doctors with their availability
    const doctors = await Doctor.find();

    // Extract and format availability data
    const allAvailabilities = doctors.map(doctor => ({
      doctorId: doctor._id,
      doctorName: `${doctor.firstName} ${doctor.lastName}`,
      specialization: doctor.specialization,
      availability: doctor.availability.map(slot => ({
        day: slot.day,
        startTime: slot.startTime,
        endTime: slot.endTime
      }))
    }));

    res.status(200).json({ message: 'Availabilities fetched successfully', availabilities: allAvailabilities });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});


app.get("/doctor/:doctorId", async (req, res) => {
  try {
    const { doctorId } = req.params;
    const doctor = await Doctor.findById(doctorId).populate("appointments.patientId", "name age email phoneNumber");

      if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });

    res.status(200).json({ success: true, appointments: doctor.appointments });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
});

// ✅ Confirm an appointment
app.put("/confirm/:doctorId/:appointmentId", async (req, res) => {
  try {
    const { doctorId, appointmentId } = req.params;
    const doctor = await Doctor.findById(doctorId);

    if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });

    const appointment = doctor.appointments.id(appointmentId);
    if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found" });

    appointment.status = "Completed";
    await doctor.save();

    res.status(200).json({ success: true, message: "Appointment confirmed successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
});

app.get("/doctor/:doctorId/upcoming-appointments", async (req, res) => {
  try {
    const { doctorId } = req.params;
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to midnight for accurate comparison

    // Find the doctor and populate patient details
    const doctor = await Doctor.findById(doctorId).populate({
      path: "appointments.patientId",
      select: "name email",
    });

    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }

    // Filter appointments with dates today or in the future
    const upcomingAppointments = doctor.appointments.filter((appointment) => 
      new Date(appointment.appointmentDate) >= today
    );

    res.status(200).json({ success: true, appointments: upcomingAppointments });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
});
app.get("/doctor/:doctorId/profile", async (req, res) => {
  try {
      const doctor = await Doctor.findById(req.params.doctorId);
      if (!doctor) {
          return res.status(404).json({ success: false, message: "Doctor not found" });
      }

      res.json({
          success: true,
          doctor: {
              name: doctor.firstName + " " + doctor.lastName,
              specialization: doctor.specialization,
              experience: doctor.hospitalOrClinicName,
              email: doctor.email,
              phone: doctor.phoneNumber,
          }
      });
  } catch (error) {
      res.status(500).json({ success: false, message: "Server Error" });
  }
});


app.get("/doctor/:doctorId/availability", async (req, res) => {
  try {
      const doctorId = req.params.doctorId;
      const doctor = await Doctor.findOne({ _id: doctorId });

      if (!doctor) {
          return res.status(404).json({ success: false, message: "Doctor not found" });
      }

      res.json({ success: true, availabilities: doctor.availability });
  } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Server Error" });
  }
});






// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});