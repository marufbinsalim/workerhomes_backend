'use strict';

/**
 * amenity service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::amenity.amenity');
