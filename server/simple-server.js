import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

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
        points: [
          // Major weather systems with realistic MRMS coordinates and dBZ values
          
          // Eastern Seaboard Storm System
          { lat: 40.7128, lon: -74.0060, value: 42.5 }, // NYC area
          { lat: 40.2, lon: -74.8, value: 38.2 },
          { lat: 39.8, lon: -75.2, value: 35.7 },
          { lat: 41.1, lon: -73.9, value: 45.3 },
          { lat: 40.6, lon: -74.3, value: 41.8 },
          
          // Midwest Severe Weather
          { lat: 41.8781, lon: -87.6298, value: 52.1 }, // Chicago area  
          { lat: 42.1, lon: -87.9, value: 48.6 },
          { lat: 41.6, lon: -87.3, value: 44.9 },
          { lat: 42.3, lon: -88.1, value: 51.2 },
          { lat: 41.9, lon: -86.8, value: 39.7 },
          
          // Texas Gulf Coast System
          { lat: 29.7604, lon: -95.3698, value: 36.4 }, // Houston area
          { lat: 30.1, lon: -95.8, value: 32.1 },
          { lat: 29.4, lon: -94.9, value: 28.7 },
          { lat: 30.3, lon: -96.2, value: 41.5 },
          { lat: 29.9, lon: -95.1, value: 34.8 },
          
          // California Central Valley
          { lat: 36.7783, lon: -119.4179, value: 22.3 },
          { lat: 36.4, lon: -119.8, value: 18.9 },
          { lat: 37.1, lon: -119.1, value: 25.6 },
          { lat: 36.9, lon: -119.6, value: 21.4 },
          { lat: 36.6, lon: -118.9, value: 19.8 },
          
          // Florida Thunderstorms
          { lat: 25.7617, lon: -80.1918, value: 47.2 }, // Miami area
          { lat: 26.1, lon: -80.4, value: 43.8 },
          { lat: 25.4, lon: -80.7, value: 41.3 },
          { lat: 26.3, lon: -79.9, value: 39.6 },
          { lat: 25.9, lon: -80.2, value: 45.1 },
          
          // Pacific Northwest Light Rain
          { lat: 47.6062, lon: -122.3321, value: 12.7 }, // Seattle area
          { lat: 47.3, lon: -122.7, value: 9.4 },
          { lat: 47.9, lon: -122.0, value: 15.2 },
          { lat: 47.4, lon: -121.9, value: 11.6 },
          { lat: 47.8, lon: -122.5, value: 13.8 },
          
          // Great Lakes Region
          { lat: 42.3314, lon: -83.0458, value: 31.5 }, // Detroit area
          { lat: 42.6, lon: -83.4, value: 28.9 },
          { lat: 42.0, lon: -82.7, value: 26.3 },
          { lat: 42.8, lon: -83.1, value: 33.7 },
          { lat: 42.1, lon: -83.3, value: 29.8 },
          
          // Colorado Front Range
          { lat: 39.7392, lon: -104.9903, value: 18.4 }, // Denver area
          { lat: 40.0, lon: -105.3, value: 16.7 },
          { lat: 39.4, lon: -104.6, value: 21.2 },
          { lat: 40.2, lon: -104.8, value: 19.6 },
          { lat: 39.6, lon: -105.1, value: 17.9 },
          
          // Additional scattered cells across CONUS
          { lat: 32.7767, lon: -96.7970, value: 49.8 }, // Dallas
          { lat: 30.2672, lon: -97.7431, value: 37.6 }, // Austin  
          { lat: 39.9526, lon: -75.1652, value: 44.7 }, // Philadelphia
          { lat: 42.3601, lon: -71.0589, value: 33.9 }, // Boston
          { lat: 33.4484, lon: -112.0740, value: 8.2 },  // Phoenix (light)
          { lat: 37.7749, lon: -122.4194, value: 6.8 },  // San Francisco (drizzle)
          { lat: 36.1627, lon: -86.7816, value: 27.4 },  // Nashville
          { lat: 35.2271, lon: -80.8431, value: 31.8 },  // Charlotte
          { lat: 33.7490, lon: -84.3880, value: 35.2 },  // Atlanta
          { lat: 30.3322, lon: -81.6557, value: 40.1 },  // Jacksonville
        ],
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