'use strict';

/**
 * pending-subscription service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::pending-subscription.pending-subscription');
