import https from "https";
import http from "http";
import zlib from "zlib";
import { promisify } from "util";
import { parseMRMSGrib2, hasValidData } from "./grib2Parser.js";

const gunzip = promisify(zlib.gunzip);

// MRMS RALA product URL - this is the Reflectivity at Lowest Altitude
const MRMS_BASE_URL =
  "https://mrms.ncep.noaa.gov/data/2D/ReflectivityAtLowestAltitude/";

/**
 * Fetches the latest available MRMS RALA GRIB2 file
 * @returns {Promise<Buffer>} The GRIB2 file data
 */
export async function fetchLatestRALA() {
  try {
    // First, get the list of available files
    const listUrl = MRMS_BASE_URL;
    const html = await fetchUrl(listUrl);

    // Parse HTML to find the latest .grib2.gz file
    const gribFiles = extractGribFiles(html);

    if (gribFiles.length === 0) {
      throw new Error("No GRIB2 files found");
    }

    // Get the most recent file (they're typically named with timestamps)
    const latestFile = gribFiles.sort().reverse()[0];
    console.log("Latest RALA file:", latestFile);

    // Download the GRIB2 file
    const fileUrl = MRMS_BASE_URL + latestFile;
    const compressedData = await fetchUrl(fileUrl, true);

    // Decompress if it's a .gz file
    let gribData;
    if (latestFile.endsWith(".gz")) {
      console.log("Decompressing gzip file...");
      gribData = await gunzip(compressedData);
      console.log(
        `Decompressed: ${compressedData.length} -> ${gribData.length} bytes`
      );
    } else {
      gribData = compressedData;
    }

    return gribData;
  } catch (error) {
    console.error("Error fetching MRMS data:", error);
    throw error;
  }
}

/**
 * Parses GRIB2 data and extracts radar reflectivity values
 * @param {Buffer} gribData - The GRIB2 file data
 * @returns {Promise<Object>} Parsed radar data with coordinates and values
 */
export async function parseGRIB2Data(gribData) {
  try {
    console.log("\n📡 Parsing GRIB2 data with custom MRMS parser...");
    
    // Use our custom parser that handles MRMS templates
    const parsed = parseMRMSGrib2(gribData);
    
    // Validate we have usable data
    if (!hasValidData(parsed)) {
      throw new Error("Insufficient valid data points in GRIB2 file");
    }

    console.log(`✓ Successfully parsed GRIB2 message`);

    // Extract grid information
    const { discipline, parameterCategory, parameterNumber, gridDefinition, values } = parsed;
    const { nx, ny, la1, lo1, la2, lo2, dx, dy } = gridDefinition;

    console.log(
      `✓ Grid: ${nx}x${ny}, Lat: ${la1 / 1e6} to ${la2 / 1e6}, Lon: ${
        lo1 / 1e6
      } to ${lo2 / 1e6}`
    );

    // Sample the data to reduce size (every nth point)
    const sampleRate = 4; // Reduce resolution for faster transfer
    const sampledData = [];

    for (let i = 0; i < ny; i += sampleRate) {
      for (let j = 0; j < nx; j += sampleRate) {
        const idx = i * nx + j;
        const value = values[idx];

        // Only include points with valid reflectivity data (typically > -30 dBZ)
        if (value !== null && value !== undefined && value > -30) {
          const lat = la1 / 1e6 - (i * dy) / 1e6;
          let lon = lo1 / 1e6 + (j * dx) / 1e6;
          
          // Convert longitude from 0-360 system to -180/+180 system
          if (lon > 180) {
            lon = lon - 360;
          }

          sampledData.push({
            lat,
            lon,
            value: Math.round(value * 10) / 10, // Round to 1 decimal
          });
        }
      }
    }

    console.log(`✓ Extracted ${sampledData.length} real radar points from MRMS data`);
    console.log(`✅ SUCCESS: Using REAL MRMS radar data!\n`);

    return {
      grid: { nx, ny, la1, lo1, la2, lo2, dx, dy },
      points: sampledData,
      metadata: {
        discipline,
        parameterCategory,
        parameterNumber,
        timestamp: new Date().toISOString(),
        dataSource: "MRMS",
        updateFrequency: "5 minutes",
        note: "Live MRMS RALA data from NOAA",
      },
    };
  } catch (error) {
    // Log the specific error type with full details
    const errorType = error.message || error.toString();
    console.error("\n⚠️  GRIB2 Parsing Error:");
    console.error("   Type:", errorType);
    console.error("   Stack:", error.stack || 'N/A');
    console.error("   GRIB2 Data Length:", gribData ? gribData.length : 'undefined');
    
    // Log first 100 bytes of GRIB2 data for debugging
    if (gribData && gribData.length > 0) {
      console.error("   First 16 bytes (hex):", gribData.slice(0, 16).toString('hex'));
      console.error("   First 16 bytes (ascii):", gribData.slice(0, 16).toString('ascii'));
    }
    
    console.log("\n→ GRIB2 parsing failed, will use fallback data if needed...\n");

    // Re-throw the error to let the main server handle fallback logic
    throw new Error(`GRIB2 parsing failed: ${errorType}`);
  }
}

/**
 * Generates dynamic, time-based radar data that changes with each request
 * This simulates real weather patterns that evolve over time
 * @returns {Object} Dynamic radar data with coordinates and values
 */
export function generateDemoRadarData() {
  console.log("📊 Generating dynamic radar data...");
  const sampledData = [];
  const now = Date.now();
  
  // Use current time to create dynamic, evolving weather patterns
  // Storms move and evolve based on time (simulate 1 degree per hour)
  const hoursSinceEpoch = now / (1000 * 60 * 60);
  const timeOffset = hoursSinceEpoch % 24; // 24-hour cycle
  
  // Create dynamic storm systems that move and change intensity over time
  const storms = generateDynamicStorms(timeOffset);
  
  console.log(`   Simulating ${storms.length} active storm systems at time offset: ${timeOffset.toFixed(2)}h`);

  // Generate points around each storm center with time-based variation
  storms.forEach((storm, idx) => {
    const pointsPerStorm = storm.points || 300;
    
    // Use storm-specific seed for consistent but evolving patterns
    const stormSeed = (now / 1000 + idx * 1000) % 10000;

    for (let i = 0; i < pointsPerStorm; i++) {
      // Use seeded randomness for time-based evolution
      const seed = stormSeed + i;
      const angle = (Math.sin(seed) * Math.PI * 2);
      const distance = (Math.abs(Math.cos(seed * 1.5)) * storm.radius);

      // Calculate lat/lon offset
      const latOffset = distance * Math.cos(angle);
      const lonOffset = distance * Math.sin(angle);

      const lat = storm.centerLat + latOffset;
      const lon = storm.centerLon + lonOffset;

      // Calculate reflectivity based on distance from center and time
      const distanceRatio = distance / storm.radius;
      const baseIntensity = storm.intensity * (1 - distanceRatio * 0.7);

      // Add time-based intensity variation (pulsing effect)
      const pulseEffect = Math.sin((now / 10000) + idx) * 5;
      const timeVariation = Math.sin(seed * 0.1) * 10;
      const value = Math.max(5, baseIntensity + pulseEffect + timeVariation);

      if (value > 5) {
        sampledData.push({
          lat: parseFloat(lat.toFixed(3)),
          lon: parseFloat(lon.toFixed(3)),
          value: parseFloat(value.toFixed(1)),
        });
      }
    }
  });

  console.log(`✓ Generated ${sampledData.length} dynamic radar points\n`);

  return {
    grid: {
      nx: 7000,
      ny: 3500,
      la1: 54500000,
      lo1: -127000000,
      la2: 20000000,
      lo2: -60000000,
      dx: 10000,
      dy: 10000,
    },
    points: sampledData,
    metadata: {
      discipline: 0,
      parameterCategory: 16,
      parameterNumber: 196,
      timestamp: new Date().toISOString(),
      note: "Dynamic simulated data - Updates in real-time (GRIB2 template limitation)",
      updateFrequency: "Real-time",
      dataSource: "Simulated",
    },
  };
}

/**
 * Generates dynamic storm systems that move and evolve over time
 * @param {number} timeOffset - Hours since epoch modulo 24
 * @returns {Array} Array of storm configurations
 */
function generateDynamicStorms(timeOffset) {
  const storms = [];
  
  // Storm 1: Severe thunderstorm moving east across Oklahoma/Kansas
  storms.push({
    centerLat: 36.0 + Math.sin(timeOffset * 0.5) * 0.5,
    centerLon: -97.5 + (timeOffset * 0.3), // Moves east over time
    intensity: 55 + Math.sin(timeOffset * 1.2) * 10, // Pulsing intensity
    radius: 1.5 + Math.cos(timeOffset * 0.8) * 0.3,
    points: 350,
  });
  
  // Storm 2: Moderate rain over Texas, slowly rotating
  storms.push({
    centerLat: 32.5 + Math.cos(timeOffset * 0.6) * 0.8,
    centerLon: -97.0 + Math.sin(timeOffset * 0.6) * 0.8,
    intensity: 40 + Math.sin(timeOffset * 0.9) * 8,
    radius: 2.0 + Math.sin(timeOffset * 0.5) * 0.4,
    points: 280,
  });
  
  // Storm 3: Fast-moving system over Arkansas
  storms.push({
    centerLat: 35.0 + Math.sin(timeOffset * 1.5) * 0.4,
    centerLon: -92.5 + (timeOffset * 0.4),
    intensity: 48 + Math.cos(timeOffset * 1.1) * 12,
    radius: 1.2 + Math.sin(timeOffset) * 0.2,
    points: 320,
  });
  
  // Storm 4: Scattered showers over Louisiana (intermittent)
  const louisianIntensity = Math.max(0, Math.sin(timeOffset * 0.7) * 40);
  if (louisianIntensity > 10) {
    storms.push({
      centerLat: 30.5 + Math.cos(timeOffset * 0.4) * 0.6,
      centerLon: -91.5 + Math.sin(timeOffset * 0.4) * 0.6,
      intensity: louisianIntensity,
      radius: 2.5,
      points: 250,
    });
  }
  
  // Storm 5: Light rain over Missouri, expanding/contracting
  storms.push({
    centerLat: 38.5 + Math.sin(timeOffset * 0.8) * 0.3,
    centerLon: -92.5 + Math.cos(timeOffset * 0.8) * 0.3,
    intensity: 22 + Math.abs(Math.sin(timeOffset * 1.3)) * 10,
    radius: 1.8 + Math.cos(timeOffset * 1.5) * 0.5,
    points: 200,
  });
  
  // Storm 6: Tennessee system - moves diagonally
  storms.push({
    centerLat: 36.0 + (timeOffset * 0.15),
    centerLon: -86.5 + (timeOffset * 0.25),
    intensity: 38 + Math.sin(timeOffset * 1.4) * 9,
    radius: 1.5 + Math.sin(timeOffset * 0.9) * 0.25,
    points: 280,
  });
  
  // Storm 7: New England coastal system (periodic appearance)
  const neIntensity = Math.max(0, 30 + Math.sin(timeOffset * 0.5 + 3) * 35);
  if (neIntensity > 15) {
    storms.push({
      centerLat: 42.0 + Math.cos(timeOffset * 0.6) * 0.4,
      centerLon: -71.0 + Math.sin(timeOffset * 0.6) * 0.5,
      intensity: neIntensity,
      radius: 1.3 + Math.sin(timeOffset * 1.2) * 0.3,
      points: 220,
    });
  }
  
  // Storm 8: Florida system (afternoon thunderstorms pattern)
  const flIntensity = 25 + Math.max(0, Math.sin((timeOffset - 12) * 0.6) * 30);
  if (flIntensity > 20) {
    storms.push({
      centerLat: 28.5 + Math.sin(timeOffset * 1.1) * 0.5,
      centerLon: -81.5 + Math.cos(timeOffset * 1.1) * 0.5,
      intensity: flIntensity,
      radius: 1.0 + Math.sin(timeOffset * 0.7) * 0.3,
      points: 240,
    });
  }
  
  return storms;
}

/**
 * Fetches content from a URL
 * @param {string} url - The URL to fetch
 * @param {boolean} isBinary - Whether to return binary data
 * @returns {Promise<string|Buffer>}
 */
function fetchUrl(url, isBinary = false) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;

    protocol
      .get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          // Handle redirects
          return fetchUrl(res.headers.location, isBinary)
            .then(resolve)
            .catch(reject);
        }

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          return;
        }

        const chunks = [];

        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const buffer = Buffer.concat(chunks);
          resolve(isBinary ? buffer : buffer.toString("utf-8"));
        });
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

/**
 * Extracts GRIB2 filenames from HTML directory listing
 * @param {string} html - HTML content
 * @returns {Array<string>} List of GRIB2 filenames
 */
function extractGribFiles(html) {
  const regex = /href="([^"]*\.grib2(?:\.gz)?)"/g;
  const files = [];
  let match;

  while ((match = regex.exec(html)) !== null) {
    files.push(match[1]);
  }

  return files;
}
