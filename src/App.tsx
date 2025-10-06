import { useState, useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";

interface RadarPoint {
  lat: number;
  lon: number;
  value: number;
}

interface RadarData {
  timestamp: string;
  data: {
    points: RadarPoint[];
    metadata: {
      timestamp: string;
      note?: string;
      dataSource?: string;
    };
  };
}

function App() {
  const [radarData, setRadarData] = useState<RadarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchRadarData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("http://localhost:3001/api/radar");

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setRadarData(data);
      setLastUpdate(new Date());
    } catch (err) {
      console.error("Error fetching radar data:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch radar data"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRadarData();

    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchRadarData, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const getColorForReflectivity = (value: number): string => {
    // NWS reflectivity color scale
    if (value < 5) return "#04e9e7"; // Light blue
    if (value < 10) return "#019ff4"; // Blue
    if (value < 15) return "#0300f4"; // Dark blue
    if (value < 20) return "#02fd02"; // Green
    if (value < 25) return "#01c501"; // Dark green
    if (value < 30) return "#008e00"; // Darker green
    if (value < 35) return "#fdf802"; // Yellow
    if (value < 40) return "#e5bc00"; // Dark yellow
    if (value < 45) return "#fd9500"; // Orange
    if (value < 50) return "#fd0000"; // Red
    if (value < 55) return "#d40000"; // Dark red
    if (value < 60) return "#bc0000"; // Darker red
    if (value < 65) return "#f800fd"; // Magenta
    return "#9854c6"; // Purple
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b-2 border-slate-200 shadow-md">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between py-4 gap-4">
            {/* Logo and Title */}
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex-shrink-0 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl p-2.5 sm:p-3 shadow-lg hover:shadow-xl transition-shadow duration-200">
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
                  />
                </svg>
              </div>
              <div className="flex flex-col justify-center">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight leading-tight">
                  MRMS Weather Radar
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 font-medium leading-tight mt-0.5">
                  Reflectivity at Lowest Altitude
                </p>
              </div>
            </div>

            {/* Right Side Controls */}
            <div className="flex items-center gap-3 sm:gap-4">
              {lastUpdate && (
                <div className="hidden md:flex items-center gap-2 sm:gap-2.5 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200 shadow-sm">
                  <svg
                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-xs sm:text-sm font-semibold text-slate-700 whitespace-nowrap">
                    {lastUpdate.toLocaleTimeString()}
                  </span>
                </div>
              )}
              <button
                onClick={fetchRadarData}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 sm:gap-2.5 px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 whitespace-nowrap"
              >
                <svg
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 ${
                    loading ? "animate-spin" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span className="hidden sm:inline">
                  {loading ? "Updating..." : "Refresh Data"}
                </span>
                <span className="sm:hidden">
                  {loading ? "Update" : "Refresh"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden">
        {/* Error Banner */}
        {error && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-lg px-6">
            <div className="bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-300 rounded-2xl p-5 shadow-lg backdrop-blur-sm animate-in slide-in-from-top duration-300">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center shadow-md">
                    <svg
                      className="w-6 h-6 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-red-900 mb-1.5">
                    Connection Error
                  </h3>
                  <p className="text-sm text-red-800 font-medium leading-relaxed">
                    {error}
                  </p>
                  <div className="mt-3 px-3 py-2 bg-red-200/50 rounded-lg border border-red-300">
                    <p className="text-xs text-red-700 font-semibold">
                      💡 Ensure the backend server is running on port 3001
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Data Source Notice */}
        {radarData?.data?.metadata?.dataSource &&
          (radarData.data.metadata.dataSource === "MRMS" ? (
            /* Real MRMS Data Badge */
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-2xl px-6">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-400 rounded-2xl p-5 shadow-lg backdrop-blur-sm animate-in slide-in-from-top duration-300">
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-md animate-pulse">
                      <svg
                        className="w-6 h-6 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="text-base font-bold text-green-900">
                        Live MRMS Data
                      </h3>
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-full border border-green-300 animate-pulse">
                        REAL-TIME
                      </span>
                    </div>
                    <p className="text-sm text-green-800 font-medium leading-relaxed mb-2">
                      Displaying actual radar data from NOAA's Multi-Radar
                      Multi-Sensor system.
                    </p>
                    <div className="flex items-center gap-4 text-xs text-green-700">
                      <div className="flex items-center gap-1">
                        <svg
                          className="w-3.5 h-3.5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="font-semibold">
                          Updates: Every 5 minutes
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <svg
                          className="w-3.5 h-3.5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
                        </svg>
                        <span className="font-semibold">Source: NOAA MRMS</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : radarData.data.metadata.dataSource === "Simulated" ? (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-2xl px-6">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-2xl p-5 shadow-lg backdrop-blur-sm animate-in slide-in-from-top duration-300">
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-md">
                      <svg
                        className="w-6 h-6 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="text-base font-bold text-blue-900">
                        Dynamic Simulation Mode
                      </h3>
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-full border border-green-300">
                        LIVE
                      </span>
                    </div>
                    <p className="text-sm text-blue-800 font-medium leading-relaxed mb-2">
                      Real-time simulated radar data - storms move and evolve
                      dynamically with each update.
                    </p>
                    <div className="flex items-center gap-4 text-xs text-blue-700">
                      <div className="flex items-center gap-1">
                        <svg
                          className="w-3.5 h-3.5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="font-semibold">
                          Updates: Real-time
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <svg
                          className="w-3.5 h-3.5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <span className="font-semibold">8 Active Storms</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null)}
        {/* Loading Overlay */}
        {loading && !radarData && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white/90 to-slate-50/90 backdrop-blur-md z-[1000]">
            <div className="bg-white rounded-2xl shadow-2xl border-2 border-slate-200 p-10 max-w-md mx-6 text-center">
              <div className="relative inline-block mb-6">
                <div className="w-20 h-20 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
                    />
                  </svg>
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">
                Loading Radar Data
              </h3>
              <p className="text-base text-slate-600 mb-5 leading-relaxed">
                Fetching latest weather data from MRMS
              </p>
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl px-5 py-3 border border-slate-200 shadow-inner">
                <p className="text-sm text-slate-600 font-medium">
                  ⏱️ First load may take 30-60 seconds
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Map Container */}
        {radarData && (
          <div className="h-full w-full">
            <MapContainer
              center={[38.0, -95.0]}
              zoom={5}
              className="h-full w-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {radarData.data.points.map((point, idx) => {
                const pointColor = getColorForReflectivity(point.value);
                return (
                  <CircleMarker
                    key={idx}
                    center={[point.lat, point.lon]}
                    radius={6}
                    fillColor={pointColor}
                    color="#ffffff"
                    weight={1}
                    opacity={0.8}
                    fillOpacity={0.9}
                  >
                  <Popup>
                    <div className="py-1">
                      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200">
                        <div
                          className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                          style={{
                            backgroundColor: getColorForReflectivity(
                              point.value
                            ),
                          }}
                        ></div>
                        <span className="font-bold text-base text-slate-900">
                          {point.value} dBZ
                        </span>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between gap-6">
                          <span className="text-slate-500 font-medium">
                            Latitude:
                          </span>
                          <span className="font-semibold text-slate-900">
                            {point.lat.toFixed(3)}°
                          </span>
                        </div>
                        <div className="flex justify-between gap-6">
                          <span className="text-slate-500 font-medium">
                            Longitude:
                          </span>
                          <span className="font-semibold text-slate-900">
                            {point.lon.toFixed(3)}°
                          </span>
                        </div>
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
                );
              })}
            </MapContainer>
          </div>
        )}
      </main>

      {/* Legend Panel */}
      {radarData && (
        <div className="absolute bottom-6 right-6 bg-white rounded-2xl shadow-2xl border-2 border-slate-200 w-72 z-[1000] overflow-hidden">
          {/* Legend Header */}
          <div className="px-5 py-4 bg-gradient-to-br from-blue-50 to-blue-100 border-b-2 border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center shadow-md">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                  />
                </svg>
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Reflectivity Scale
              </h3>
            </div>
          </div>

          {/* Legend Items */}
          <div className="px-5 py-4 max-h-96 overflow-y-auto custom-scrollbar">
            <div className="space-y-2">
              {[
                { label: "65+", color: "#9854c6", desc: "Severe" },
                { label: "60-65", color: "#f800fd", desc: "Very Heavy" },
                { label: "55-60", color: "#bc0000", desc: "Heavy" },
                { label: "50-55", color: "#d40000", desc: "Heavy" },
                { label: "45-50", color: "#fd0000", desc: "Moderate" },
                { label: "40-45", color: "#fd9500", desc: "Moderate" },
                { label: "35-40", color: "#e5bc00", desc: "Light" },
                { label: "30-35", color: "#fdf802", desc: "Light" },
                { label: "25-30", color: "#008e00", desc: "Very Light" },
                { label: "20-25", color: "#01c501", desc: "Very Light" },
                { label: "15-20", color: "#02fd02", desc: "Trace" },
                { label: "10-15", color: "#0300f4", desc: "Trace" },
                { label: "5-10", color: "#019ff4", desc: "Minimal" },
                { label: "<5", color: "#04e9e7", desc: "Minimal" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-slate-50 transition-all duration-150 cursor-pointer group"
                >
                  <div
                    className="w-8 h-5 rounded-md border-2 border-slate-300 flex-shrink-0 shadow-sm group-hover:scale-110 transition-transform duration-150"
                    style={{ backgroundColor: item.color }}
                  ></div>
                  <span className="text-sm font-bold text-slate-800 min-w-[3rem]">
                    {item.label}
                  </span>
                  <span className="text-sm text-slate-600 font-medium">
                    {item.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Legend Footer */}
          {radarData.data.points.length > 0 && (
            <div className="px-5 py-4 border-t-2 border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-600">
                  Data Points
                </span>
                <span className="text-base font-bold text-blue-600">
                  {radarData.data.points.length.toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
