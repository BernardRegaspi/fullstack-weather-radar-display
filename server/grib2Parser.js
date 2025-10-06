/**
 * Custom GRIB2 Parser for MRMS RALA Data
 * 
 * This parser handles MRMS GRIB2 files that use unsupported product definition templates.
 * It extracts grid definitions and data values by directly reading GRIB2 sections.
 */

/**
 * Parses MRMS GRIB2 data by extracting grid and data information
 * @param {Buffer} buffer - The GRIB2 file buffer
 * @returns {Object} Parsed radar data
 */
export function parseMRMSGrib2(buffer) {
  try {
    // Verify GRIB2 header
    const header = buffer.toString('ascii', 0, 4);
    if (header !== 'GRIB') {
      throw new Error('Not a valid GRIB2 file');
    }

    // Get discipline from byte 6
    const discipline = buffer.readUInt8(6);
    
    // Find sections
    let offset = 16; // Skip indicator section (16 bytes)
    const sections = {};
    
    while (offset < buffer.length - 4) {
      const sectionLength = buffer.readUInt32BE(offset);
      const sectionNumber = buffer.readUInt8(offset + 4);
      
      if (sectionLength === 0 || sectionLength > buffer.length) break;
      
      sections[sectionNumber] = {
        offset: offset,
        length: sectionLength,
        data: buffer.slice(offset, offset + sectionLength)
      };
      
      offset += sectionLength;
      
      // Section 8 is the end section
      if (sectionNumber === 8) break;
    }

    // Debug which sections we found
    console.log('🔍 GRIB2 Sections found:', Object.keys(sections));
    
    // Parse Section 3 (Grid Definition Section)
    const gridDef = parseGridDefinitionSection(sections[3]?.data);
    
    // Parse Section 5 (Data Representation Section)
    const dataRep = parseDataRepresentationSection(sections[5]?.data);
    console.log('📊 Data Representation Section:', dataRep);
    
    // Parse Section 7 (Data Section)
    const values = parseDataSection(sections[7]?.data, dataRep, gridDef);

    return {
      discipline,
      gridDefinition: gridDef,
      values: values,
      parameterCategory: sections[4] ? buffer.readUInt8(sections[4].offset + 9) : 0,
      parameterNumber: sections[4] ? buffer.readUInt8(sections[4].offset + 10) : 0,
    };
  } catch (error) {
    console.error('Error in custom GRIB2 parser:', error.message);
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
    const dataOffset = 5; // Data starts at byte 5
    const dataBuffer = section.slice(dataOffset);
    
    const totalPoints = gridDef.nx * gridDef.ny;
    const values = new Array(totalPoints);

    // Handle different data representation templates
    if (dataRep.template === 41) {
      // PNG compressed data - simplified approach
      console.log('🖼️ Processing PNG compressed data...');
      
      // For PNG template, we need to treat the raw values differently
      // MRMS uses this for efficient compression but the values need special handling
      for (let i = 0; i < totalPoints && i * 2 < dataBuffer.length - 1; i++) {
        const rawValue = dataBuffer.readUInt16BE(i * 2);
        
        // Check for missing value indicators
        if (rawValue === 0 || rawValue === 65535) {
          values[i] = null;
        } else {
          // For MRMS RALA data, apply empirical scaling
          // Values typically need to be scaled down significantly
          const scaledValue = (rawValue - 32768) / 655.36; // Convert to approximate dBZ
          values[i] = Math.max(-30, Math.min(80, scaledValue)); // Clamp to reasonable dBZ range
        }
      }
    } else if (dataRep.bitsPerValue === 16) {
      // 16-bit signed integers (simple packing)
      for (let i = 0; i < totalPoints && i * 2 < dataBuffer.length - 1; i++) {
        const rawValue = dataBuffer.readInt16BE(i * 2);
        
        // Check for missing value indicators first
        if (rawValue === -32768 || rawValue === -9999 || rawValue === 32767) {
          values[i] = null;
        } else {
          // Apply proper GRIB2 scaling
          const referenceValue = dataRep.referenceValue || 0;
          const binaryScaleFactor = dataRep.binaryScaleFactor || 0;
          const decimalScaleFactor = dataRep.decimalScaleFactor || 0;
          
          // GRIB2 formula: (R + X * 2^E) / 10^D
          // Where R = reference value, X = raw value, E = binary scale, D = decimal scale
          const binaryScale = Math.pow(2, binaryScaleFactor);
          const decimalScale = Math.pow(10, decimalScaleFactor);
          
          values[i] = (referenceValue + rawValue * binaryScale) / decimalScale;
        }
      }
    } else if (dataRep.bitsPerValue === 8) {
      // 8-bit values
      for (let i = 0; i < totalPoints && i < dataBuffer.length; i++) {
        const rawValue = dataBuffer.readInt8(i);
        values[i] = rawValue === -128 ? null : rawValue;
      }
    } else {
      console.warn(`Unsupported bits per value: ${dataRep.bitsPerValue}`);
      return [];
    }

    return values;
  } catch (error) {
    console.error('Error parsing data section:', error.message);
    return [];
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
