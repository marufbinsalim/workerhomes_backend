'use strict';

/**
 * dwelling service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::dwelling.dwelling');
