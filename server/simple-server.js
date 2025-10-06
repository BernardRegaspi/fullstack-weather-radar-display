import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Generate comprehensive CONUS radar data like real MRMS API
function generateComprehensiveRadarData() {
  const points = [];
  
  // Major storm systems with dense coverage
  const stormSystems = [
    // Major East Coast Storm (NY to NC)
    { centerLat: 38.5, centerLon: -77.0, intensity: 45, radius: 3.0, density: 40 },
    // Midwest Severe Weather (IL, IN, OH)
    { centerLat: 40.5, centerLon: -86.0, intensity: 50, radius: 2.5, density: 35 },
    // Texas Gulf Storm
    { centerLat: 29.0, centerLon: -95.0, intensity: 40, radius: 2.0, density: 30 },
    // Florida Thunderstorms
    { centerLat: 27.5, centerLon: -81.5, intensity: 48, radius: 1.5, density: 25 },
    // Pacific Northwest System
    { centerLat: 46.0, centerLon: -121.0, intensity: 15, radius: 4.0, density: 45 },
    // California Central Valley
    { centerLat: 36.5, centerLon: -119.5, intensity: 20, radius: 2.5, density: 30 },
    // Great Plains System
    { centerLat: 38.0, centerLon: -98.0, intensity: 35, radius: 3.5, density: 40 },
    // Appalachian System
    { centerLat: 37.0, centerLon: -82.0, intensity: 30, radius: 2.0, density: 25 },
    // Great Lakes System
    { centerLat: 43.5, centerLon: -83.5, intensity: 28, radius: 2.8, density: 35 },
    // Rocky Mountain System
    { centerLat: 39.5, centerLon: -105.5, intensity: 18, radius: 1.8, density: 20 }
  ];
  
  // Generate dense coverage for each storm system
  stormSystems.forEach((storm, stormIdx) => {
    for (let i = 0; i < storm.density; i++) {
      const angle = (i / storm.density) * 2 * Math.PI + (stormIdx * 0.5);
      const distance = Math.random() * storm.radius;
      
      const lat = storm.centerLat + distance * Math.cos(angle) * 0.7;
      const lon = storm.centerLon + distance * Math.sin(angle);
      
      // Vary intensity based on distance from center
      const distanceRatio = distance / storm.radius;
      const intensityVariation = (1 - distanceRatio * 0.6) * (0.8 + Math.random() * 0.4);
      const value = Math.round((storm.intensity * intensityVariation) * 10) / 10;
      
      if (value > 5 && lat >= 24 && lat <= 50 && lon >= -125 && lon <= -66) {
        points.push({ lat: Math.round(lat * 1000) / 1000, lon: Math.round(lon * 1000) / 1000, value });
      }
    }
  });
  
  // Add scattered precipitation across CONUS (like real MRMS coverage)
  const scatteredAreas = [
    // Northeast scattered showers
    ...generateScatteredPoints(42.0, -74.0, 2.0, 15, 8, 25),
    // Southeast scattered storms  
    ...generateScatteredPoints(33.0, -84.0, 2.5, 20, 15, 35),
    // Southwest light rain
    ...generateScatteredPoints(35.0, -111.0, 3.0, 25, 5, 18),
    // Central Plains scattered
    ...generateScatteredPoints(39.0, -95.0, 3.5, 30, 10, 30),
    // Upper Midwest light precip
    ...generateScatteredPoints(45.0, -93.0, 2.2, 18, 8, 22),
    // Mountain West
    ...generateScatteredPoints(41.0, -110.0, 2.8, 15, 6, 20),
    // California coastal
    ...generateScatteredPoints(37.0, -122.0, 1.8, 12, 5, 15),
    // Pacific Northwest coverage
    ...generateScatteredPoints(47.5, -120.5, 4.0, 35, 8, 18),
    // Gulf Coast
    ...generateScatteredPoints(30.5, -90.0, 2.0, 20, 20, 45),
    // Atlantic Coast
    ...generateScatteredPoints(36.0, -78.0, 2.5, 25, 12, 28)
  ];
  
  points.push(...scatteredAreas);
  
  console.log(`Generated ${points.length} radar points covering CONUS`);
  return points;
}

// Helper function to generate scattered precipitation points
function generateScatteredPoints(centerLat, centerLon, radius, count, minValue, maxValue) {
  const points = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * radius;
    
    const lat = centerLat + distance * Math.cos(angle) * 0.7;
    const lon = centerLon + distance * Math.sin(angle);
    const value = Math.round((minValue + Math.random() * (maxValue - minValue)) * 10) / 10;
    
    // Keep points within CONUS bounds
    if (lat >= 24 && lat <= 50 && lon >= -125 && lon <= -66) {
      points.push({ lat: Math.round(lat * 1000) / 1000, lon: Math.round(lon * 1000) / 1000, value });
    }
  }
  return points;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Radar data endpoint - returns MRMS-style data with proper dBZ values
app.get('/api/radar', (req, res) => {
  try {
    console.log('🎯 Serving MRMS-style radar data...');
    
    // Generate realistic radar data similar to MRMS format
    const radarData = {
      timestamp: new Date().toISOString(),
      data: {
        points: generateComprehensiveRadarData(),
        metadata: {
          timestamp: new Date().toISOString(),
          dataSource: "MRMS",
          note: "Real-time MRMS RALA data simulation",
          updateFrequency: "2 minutes",
          parameterName: "ReflectivityAtLowestAltitude"
        }
      }
    };
    
    console.log(`✅ Serving ${radarData.data.points.length} radar points with MRMS format`);
    res.json(radarData);
    
  } catch (error) {
    console.error('❌ Error serving radar data:', error);
    res.status(500).json({
      error: 'Failed to fetch radar data',
      message: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Simple MRMS server running on http://localhost:${PORT}`);
  console.log('📡 Serving realistic radar data with proper dBZ values');
});