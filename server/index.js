import express from "express";
import cors from "cors";
import {
  fetchLatestRALA,
  parseGRIB2Data,
  generateDemoRadarData,
} from "./mrmsService.js";

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Endpoint to get latest MRMS RALA radar data
app.get("/api/radar", async (req, res) => {
  try {
    console.log("Fetching latest MRMS RALA data...");
    const gribData = await fetchLatestRALA();
    const radarData = await parseGRIB2Data(gribData);

    res.json({
      timestamp: new Date().toISOString(),
      data: radarData,
    });
  } catch (error) {
    console.error("Error fetching radar data:", error.message);
    console.error("Full error:", error.stack || error.toString());

    // Since we now support PNG compression, most MRMS data should work
    // Only fall back to demo data if absolutely necessary
    if (
      error.message.includes("PNG compression") ||
      error.message.includes("GRIB2 parsing")
    ) {
      console.log(
        "Attempting to use fallback demo data due to parsing error..."
      );

      try {
        const fallbackData = generateDemoRadarData();

        res.json({
          timestamp: new Date().toISOString(),
          data: fallbackData,
          warning: "Using simulated data due to parsing error",
          originalError: error.message,
        });
      } catch (fallbackError) {
        console.error("Even fallback failed:", fallbackError);
        res.status(500).json({
          error: "Failed to fetch radar data",
          message: error.message,
          fallbackError: fallbackError.message,
        });
      }
    } else {
      // For network errors or other issues, return proper error
      res.status(500).json({
        error: "Failed to fetch radar data",
        message: error.message,
      });
    }
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
