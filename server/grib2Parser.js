/**
 * Custom GRIB2 Parser for MRMS RALA Data
 * 
 * This parser handles MRMS GRIB2 files that use unsupported product definition templates.
 * It extracts grid definitions and data values by directly reading GRIB2 sections.
 * Supports PNG compression (template 41) commonly used by MRMS.
 */

import { PNG } from 'pngjs';

/**
 * Parses MRMS GRIB2 data by extracting grid and data information
 * @param {Buffer} buffer - The GRIB2 file buffer
 * @returns {Object} Parsed radar data
 */
export function parseMRMSGrib2(buffer) {
  try {
    console.log('📡 Starting GRIB2 parsing...');
    console.log(`   Buffer length: ${buffer.length} bytes`);
    
    // Verify GRIB2 header
    const header = buffer.toString('ascii', 0, 4);
    if (header !== 'GRIB') {
      throw new Error(`Invalid GRIB2 header: expected 'GRIB', got '${header}'`);
    }
    
    // Get GRIB edition from byte 7
    const edition = buffer.readUInt8(7);
    console.log(`   GRIB edition: ${edition}`);
    
    if (edition !== 2) {
      throw new Error(`Unsupported GRIB edition: ${edition}`);
    }

    // Get discipline from byte 6
    const discipline = buffer.readUInt8(6);
    console.log(`   Discipline: ${discipline}`);
    
    // Get total message length from bytes 8-15
    const messageLength = buffer.readBigUInt64BE(8);
    console.log(`   Message length: ${messageLength}`);
    
    // Find sections
    let offset = 16; // Skip indicator section (16 bytes)
    const sections = {};
    let sectionCount = 0;
    
    while (offset < buffer.length - 4 && sectionCount < 20) { // Safety limit
      const sectionLength = buffer.readUInt32BE(offset);
      const sectionNumber = buffer.readUInt8(offset + 4);
      
      console.log(`   Section ${sectionNumber}: length ${sectionLength} at offset ${offset}`);
      
      if (sectionLength === 0 || sectionLength > buffer.length || offset + sectionLength > buffer.length) {
        console.warn(`   Invalid section length ${sectionLength}, breaking`);
        break;
      }
      
      sections[sectionNumber] = {
        offset: offset,
        length: sectionLength,
        data: buffer.slice(offset, offset + sectionLength)
      };
      
      offset += sectionLength;
      sectionCount++;
      
      // Section 8 is the end section
      if (sectionNumber === 8) {
        console.log('   Found end section, stopping');
        break;
      }
    }

    // Debug which sections we found
    console.log('🔍 GRIB2 Sections found:', Object.keys(sections).map(k => `${k}(${sections[k].length}b)`).join(', '));
    
    if (!sections[3]) {
      throw new Error('Missing Grid Definition Section (3)');
    }
    if (!sections[5]) {
      throw new Error('Missing Data Representation Section (5)');
    }
    if (!sections[7]) {
      throw new Error('Missing Data Section (7)');
    }
    
    // Parse Section 3 (Grid Definition Section)
    const gridDef = parseGridDefinitionSection(sections[3].data);
    console.log('🗺️ Grid Definition:', { nx: gridDef.nx, ny: gridDef.ny });
    
    // Parse Section 5 (Data Representation Section)
    const dataRep = parseDataRepresentationSection(sections[5].data);
    console.log('📊 Data Representation:', dataRep);
    
    // Parse Section 7 (Data Section)
    const values = parseDataSection(sections[7].data, dataRep, gridDef);
    console.log(`📋 Parsed ${values.length} data values`);

    return {
      discipline,
      gridDefinition: gridDef,
      values: values,
      parameterCategory: sections[4] ? sections[4].data.readUInt8(9) : 0,
      parameterNumber: sections[4] ? sections[4].data.readUInt8(10) : 0,
    };
  } catch (error) {
    console.error('❌ Error in custom GRIB2 parser:', error.message);
    console.error('   Stack:', error.stack);
    throw error;
  }
}

/**
 * Parses Grid Definition Section (Section 3)
 */
function parseGridDefinitionSection(section) {
  if (!section || section.length < 14) {
    throw new Error('Invalid grid definition section');
  }

  const gridTemplateNumber = section.readUInt16BE(12);
  
  // Most MRMS products use template 0 (Latitude/Longitude)
  if (gridTemplateNumber === 0 || gridTemplateNumber === 30) {
    return parseLatLonGrid(section);
  }
  
  // Try to parse as lat/lon anyway
  return parseLatLonGrid(section);
}

/**
 * Parses Latitude/Longitude grid template
 */
function parseLatLonGrid(section) {
  try {
    // GRIB2 Section 3 structure:
    // Bytes 0-3: Section length
    // Byte 4: Section number (3)
    // Byte 5: Source of grid definition
    // Bytes 6-9: Number of data points
    // Bytes 10-11: Number of octets for optional list
    // Byte 12: Interpretation of list
    // Bytes 13-14: Grid Definition Template Number
    // Bytes 15+: Grid Definition Template
    
    if (section.length < 72) {
      throw new Error(`Section too short: ${section.length} bytes`);
    }
    
    // Grid dimensions are in the template starting at byte 30 and 34
    const nx = section.readUInt32BE(30);
    const ny = section.readUInt32BE(34);
    
    // Basic angle and subdivisions
    const basicAngle = section.readUInt32BE(38);
    const subdivisions = section.readUInt32BE(42);
    
    // Lat/lon bounds (scaled integers)
    const la1 = section.readInt32BE(46);
    const lo1 = section.readInt32BE(50);
    const la2 = section.readInt32BE(55);
    const lo2 = section.readInt32BE(59);
    
    // Grid increments
    const dx = section.readInt32BE(63);
    const dy = section.readInt32BE(67);

    return {
      nx,
      ny,
      la1,
      lo1,
      la2,
      lo2,
      dx,
      dy
    };
  } catch (error) {
    console.warn('⚠️  Using default CONUS grid (parsing error:', error.message + ')');
    // Return CONUS defaults if parsing fails
    return {
      nx: 7000,
      ny: 3500,
      la1: 54500000,
      lo1: -127000000,
      la2: 20000000,
      lo2: -60000000,
      dx: 10000,
      dy: 10000
    };
  }
}

/**
 * Parses Data Representation Section (Section 5)
 */
function parseDataRepresentationSection(section) {
  if (!section || section.length < 11) {
    return {
      template: 0,
      binaryScaleFactor: 0,
      decimalScaleFactor: 0,
      bitsPerValue: 16
    };
  }

  const template = section.readUInt16BE(9);
  
  // Template 0 is simple packing
  if (template === 0) {
    const dataRep = {
      template: 0,
      referenceValue: section.readFloatBE(11),
      binaryScaleFactor: section.readInt16BE(15),
      decimalScaleFactor: section.readInt16BE(17),
      bitsPerValue: section.readUInt8(19)
    };
    
    console.log('📊 GRIB2 Data Representation:', dataRep);
    return dataRep;
  }
  
  // Template 41 is PNG compression
  if (template === 41) {
    const dataRep = {
      template: 41,
      referenceValue: section.readFloatBE(11),
      binaryScaleFactor: section.readInt16BE(15),
      decimalScaleFactor: section.readInt16BE(17),
      bitsPerValue: section.readUInt8(19)
    };
    
    console.log('📊 GRIB2 Data Representation (PNG):', dataRep);
    return dataRep;
  }

  return {
    template,
    bitsPerValue: 16
  };
}

/**
 * Parses Data Section (Section 7)
 */
function parseDataSection(section, dataRep, gridDef) {
  if (!section || section.length < 6) {
    console.warn('Invalid or missing data section');
    return [];
  }

  try {
    console.log(`📋 Parsing data section: ${section.length} bytes`);
    const dataOffset = 5; // Data starts at byte 5
    const dataBuffer = section.slice(dataOffset);
    console.log(`   Data buffer: ${dataBuffer.length} bytes`);
    
    const totalPoints = gridDef.nx * gridDef.ny;
    console.log(`   Expected data points: ${totalPoints}`);
    const values = new Array(totalPoints).fill(null);

    // Handle different data representation templates
    if (dataRep.template === 41) {
      // PNG compressed data - decode PNG first
      console.log('🖼️ Processing PNG compressed data (template 41)...');
      console.log(`   Reference: ${dataRep.referenceValue}, Binary Scale: ${dataRep.binaryScaleFactor}, Decimal Scale: ${dataRep.decimalScaleFactor}`);
      
      try {
        // Decode PNG data
        const pngData = PNG.sync.read(dataBuffer);
        console.log(`   PNG dimensions: ${pngData.width}x${pngData.height}`);
        
        const maxPoints = Math.min(totalPoints, pngData.width * pngData.height);
        console.log(`   Processing ${maxPoints} PNG values`);
        
        for (let i = 0; i < maxPoints; i++) {
          // PNG data is stored as RGBA, but for GRIB2 we usually only use the first component
          // Each pixel has 4 bytes (RGBA), so we read the red component (or luminance for grayscale)
          const pixelIndex = i * 4;
          if (pixelIndex + 1 < pngData.data.length) {
            const rawValue = (pngData.data[pixelIndex] << 8) | pngData.data[pixelIndex + 1]; // 16-bit value from two 8-bit components
            
            // Check for missing value indicators
            if (rawValue === 0 || rawValue === 65535) {
              values[i] = null;
            } else {
              // Apply GRIB2 scaling
              const referenceValue = dataRep.referenceValue || 0;
              const binaryScaleFactor = dataRep.binaryScaleFactor || 0;
              const decimalScaleFactor = dataRep.decimalScaleFactor || 0;
              
              const binaryScale = Math.pow(2, binaryScaleFactor);
              const decimalScale = Math.pow(10, decimalScaleFactor);
              
              const scaledValue = (referenceValue + rawValue * binaryScale) / decimalScale;
              
              // MRMS reflectivity is typically -30 to 80 dBZ
              if (scaledValue >= -50 && scaledValue <= 100) {
                values[i] = Math.round(scaledValue * 10) / 10;
              } else {
                values[i] = null;
              }
            }
          } else {
            values[i] = null;
          }
        }
      } catch (pngError) {
        console.error('🖼️ PNG decompression failed:', pngError.message);
        throw new Error(`PNG decompression failed: ${pngError.message}`);
      }
      
    } else if (dataRep.template === 0) {
      // Simple packing (most common)
      console.log('📦 Processing simple packing (template 0)...');
      console.log(`   Reference: ${dataRep.referenceValue}, Binary Scale: ${dataRep.binaryScaleFactor}, Decimal Scale: ${dataRep.decimalScaleFactor}, Bits: ${dataRep.bitsPerValue}`);
      
      if (dataRep.bitsPerValue === 16) {
        // 16-bit values
        const maxPoints = Math.min(totalPoints, Math.floor(dataBuffer.length / 2));
        console.log(`   Processing ${maxPoints} 16-bit values`);
        
        for (let i = 0; i < maxPoints; i++) {
          const rawValue = dataBuffer.readUInt16BE(i * 2);
          
          // Check for missing value indicators
          if (rawValue === 0 || rawValue === 65535) {
            values[i] = null;
          } else {
            // Apply GRIB2 scaling
            const referenceValue = dataRep.referenceValue || 0;
            const binaryScaleFactor = dataRep.binaryScaleFactor || 0;
            const decimalScaleFactor = dataRep.decimalScaleFactor || 0;
            
            const binaryScale = Math.pow(2, binaryScaleFactor);
            const decimalScale = Math.pow(10, decimalScaleFactor);
            
            const scaledValue = (referenceValue + rawValue * binaryScale) / decimalScale;
            
            // MRMS reflectivity is typically -30 to 80 dBZ
            if (scaledValue >= -50 && scaledValue <= 100) {
              values[i] = Math.round(scaledValue * 10) / 10;
            } else {
              values[i] = null;
            }
          }
        }
      } else if (dataRep.bitsPerValue === 8) {
        // 8-bit values
        const maxPoints = Math.min(totalPoints, dataBuffer.length);
        console.log(`   Processing ${maxPoints} 8-bit values`);
        
        for (let i = 0; i < maxPoints; i++) {
          const rawValue = dataBuffer.readUInt8(i);
          
          if (rawValue === 0 || rawValue === 255) {
            values[i] = null;
          } else {
            const referenceValue = dataRep.referenceValue || 0;
            const binaryScaleFactor = dataRep.binaryScaleFactor || 0;
            const decimalScaleFactor = dataRep.decimalScaleFactor || 0;
            
            const binaryScale = Math.pow(2, binaryScaleFactor);
            const decimalScale = Math.pow(10, decimalScaleFactor);
            
            const scaledValue = (referenceValue + rawValue * binaryScale) / decimalScale;
            
            if (scaledValue >= -50 && scaledValue <= 100) {
              values[i] = Math.round(scaledValue * 10) / 10;
            } else {
              values[i] = null;
            }
          }
        }
      } else {
        throw new Error(`Unsupported bits per value for simple packing: ${dataRep.bitsPerValue}`);
      }
    } else {
      throw new Error(`Unsupported data representation template: ${dataRep.template}`);
    }

    const validCount = values.filter(v => v !== null).length;
    console.log(`   Processed values: ${validCount}/${totalPoints} valid`);
    
    // If we have very few valid values, there might be an issue with our parsing
    if (validCount === 0) {
      console.warn('⚠️  No valid data points found!');
      // Log some raw bytes for debugging
      console.warn('   First 32 bytes of data buffer:');
      for (let i = 0; i < Math.min(32, dataBuffer.length); i += 16) {
        const chunk = dataBuffer.slice(i, Math.min(i + 16, dataBuffer.length));
        console.warn(`   ${i.toString(16).padStart(4, '0')}: ${chunk.toString('hex')} | ${chunk.toString('ascii').replace(/[^\x20-\x7E]/g, '.')}`);
      }
    }

    return values;
  } catch (error) {
    console.error('❌ Error parsing data section:', error.message);
    console.error('   Stack:', error.stack);
    throw error;
  }
}

/**
 * Validates that we have enough usable data points
 */
export function hasValidData(parsedData) {
  if (!parsedData || !parsedData.values || parsedData.values.length === 0) {
    return false;
  }

  // Count non-null values
  const validCount = parsedData.values.filter(v => v !== null && v !== undefined).length;
  const validPercentage = (validCount / parsedData.values.length) * 100;

  console.log(`Valid data points: ${validCount} / ${parsedData.values.length} (${validPercentage.toFixed(1)}%)`);

  // Require at least 1% valid data
  return validPercentage > 1;
}
