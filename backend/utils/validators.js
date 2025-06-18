exports.validateLocation = (coordinates, address) => {
  const errors = {};
  
  // Validate coordinates
  if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
    errors.coordinates = 'Invalid coordinates format. Expected [longitude, latitude]';
  } else {
    const [longitude, latitude] = coordinates;
    if (longitude < -180 || longitude > 180) {
      errors.longitude = 'Longitude must be between -180 and 180';
    }
    if (latitude < -90 || latitude > 90) {
      errors.latitude = 'Latitude must be between -90 and 90';
    }
  }

  // Validate address (optional)
  if (address && typeof address !== 'string') {
    errors.address = 'Address must be a string';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
};