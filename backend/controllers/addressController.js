const { Client } = require('@googlemaps/google-maps-services-js');
const client = new Client({});
const GOOGLE_API_KEY=process.env.GOOGLE_MAPS_API_KEY;

// Enhanced with better error handling and response formatting
// exports.autocomplete = async (req, res) => {
//   const { input, country = 'in' } = req.query;

//   if (!input || input.length < 3) {
//     return res.status(400).json({ 
//       error: 'Input parameter is required and must be at least 3 characters' 
//     });
//   }

//   try {
//     const response = await client.placeAutocomplete({
//       params: {
//         input,
//         key: GOOGLE_API_KEY,
//         components: [`country:${country}`],
//         sessiontoken: req.query.session_token,
//       },
//       timeout: 3000
//     });
// console.log('Google Predictions:', response.data.predictions);
//     res.json({
//       predictions: response.data.predictions.map(prediction => ({
//         description: prediction.description,
//         place_id: prediction.place_id,
//         structured_formatting: prediction.structured_formatting
//       }))
//     });

//   } catch (error) {
//     console.error('Autocomplete error:', {
//       status: error.response?.status,
//       data: error.response?.data,
//       message: error.message
//     });

//     res.status(500).json({ 
//       error: 'Autocomplete failed',
//       details: error.response?.data?.error_message || error.message
//     });
//   }
// };

exports.autocomplete = async (req, res) => {
  //  console.log('ENDPOINT HIT - Request received'); // Add this first
  // console.log('Query params:', req.query); // Log all incoming parameters
  const { input, country = 'in' } = req.query;

  if (!input || input.length < 3) {
    return res.status(400).json({ 
      error: 'Input parameter is required and must be at least 3 characters' 
    });
  }

  try {
    const response = await client.placeAutocomplete({
      params: {
        input,
        key: GOOGLE_API_KEY,
        components: [`country:${country}`],
        // Add these parameters:
        language: 'en',
        // Make session token optional:
        sessiontoken: req.query.session_token || undefined
      },
      timeout: 3000
    });

    // console.log('Full API Response:', JSON.stringify(response.data, null, 2));
    
    res.json({
      predictions: response.data.predictions.map(prediction => ({
        description: prediction.description,
        place_id: prediction.place_id,
        structured_formatting: prediction.structured_formatting
      }))
    });
  } catch (error) {
    console.error('Full error details:', {
      error: error.toString(),
      response: error.response?.data,
      stack: error.stack
    });
    res.status(500).json({ 
      error: 'Autocomplete failed',
      details: error.response?.data?.error_message || error.message
    });
  }
};

exports.geocode = async (req, res) => {
  const { place_id } = req.query;

  if (!place_id) {
    return res.status(400).json({ 
      error: 'Valid place_id parameter is required' 
    });
  }

  try {
    const response = await client.placeDetails({
      params: {
        place_id,
        key: GOOGLE_API_KEY,
        fields: [
          'formatted_address',
          'address_components',
          'geometry',
          'name',
          'plus_code'
        ],
        sessiontoken: req.query.session_token
      },
      timeout: 1000
    });
    console.log(response.data);
    const { result } = response.data;

    if (!result) {
      return res.status(404).json({ 
        error: 'No geocoding results found for this place_id' 
      });
    }

    // Enhanced address component parser
    const getComponent = (types) => {
      const component = result.address_components.find(c => 
        types.some(type => c.types.includes(type))
      );
      return component ? component.long_name : '';
    };

    res.json({
      result: {
        formatted_address: result.formatted_address,
        place_name: result.name,
        geometry: result.geometry,
        address_components: {
          street: getComponent(['route', 'street_address']),
          city: getComponent(['locality', 'postal_town', 'sublocality_level_1']),
          state: getComponent(['administrative_area_level_1']),
          postalCode: getComponent(['postal_code']),
          country: getComponent(['country'])
        }
      }
    });

  } catch (error) {
    console.error('Geocode error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });

    res.status(500).json({ 
      error: 'Geocoding failed',
      details: error.response?.data?.error_message || error.message
    });
  }
};
